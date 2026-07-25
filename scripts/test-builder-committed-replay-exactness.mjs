#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { computeCanonicalDigest, sha256Bytes } from './lib/canonical-builder-package.mjs';
import { attachRunEvidence, completeRun, confirmRunBatch, emitRunBatch, validateCanonicalRun } from './lib/runtime/canonical-run-runtime.mjs';
import { verifyCommittedTransitionReplay } from './lib/runtime/committed-transition-replay.mjs';
import { activeRun, completeHappyRun, createEvidenceSources, initializeManualRun, progressToConfirmed, progressToWaiting } from './lib/runtime/runtime-test-fixtures.mjs';

const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-committed-replay-exactness-'));
const failures = [];
let count = 0;

function test(title, fn) {
  count += 1;
  try { fn(); console.log(`PASS ${count}: ${title}`); }
  catch (error) { failures.push(`FAIL ${count}: ${title}: ${error.stack || error.message}`); }
}
function hasCode(result, code) { return (result?.diagnostics || []).some((entry) => entry.code === code); }
function fileBytes(file) { return fs.readFileSync(file); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function reverseTopLevelJson(file) { writeJson(file, Object.fromEntries(Object.entries(readJson(file)).reverse())); }
function replaceLastCharacter(value) { return typeof value === 'string' && value ? `${value.slice(0, -1)}${value.endsWith('0') ? '1' : '0'}` : value; }
function digestWithout(value, field) { const clone = structuredClone(value); delete clone[field]; return computeCanonicalDigest(clone); }
function restoreRun(runDirectory, backupDirectory) { fs.rmSync(runDirectory, { recursive: true, force: true }); fs.cpSync(backupDirectory, runDirectory, { recursive: true, preserveTimestamps: true }); }
function generationCount(runDirectory) { return fs.readdirSync(path.join(runDirectory, 'generations')).filter((name) => /^\d{6}$/.test(name)).length; }
function canonicalTargets(runDirectory, expected) {
  return [
    ...[...expected.generationFiles.keys()].map((name) => ({ label: `generation:${name}`, file: path.join(runDirectory, expected.nextRef, name) })),
    ...[...expected.auxiliary.keys()].map((ref) => ({ label: `auxiliary:${ref}`, file: path.join(runDirectory, ref) })),
    { label: 'CURRENT.json', file: path.join(runDirectory, 'CURRENT.json') }
  ];
}
function snapshotTargets(targets) { return new Map(targets.map((entry) => [entry.file, fileBytes(entry.file)])); }
function assertSnapshotUnchanged(snapshot) { for (const [file, before] of snapshot) assert.equal(fileBytes(file).equals(before), true, `Runtime rewrote ${file}`); }
function mutateResult(file, mutate) { const value = readJson(file); mutate(value); writeJson(file, value); }
function mutateFirstDigest(value) {
  const key = Object.keys(value.action_digests || {})[0];
  assert.ok(key, 'Result has no action digest to mutate.');
  value.action_digests[key] = value.action_digests[key] === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64);
}

function operationCase(operation) {
  if (operation === 'emit-batch') {
    const value = initializeManualRun(TEMP, 'exact-emit');
    assert.equal(emitRunBatch({ runDirectory: value.runDirectory }).passed, true);
    return { operation, runDirectory: value.runDirectory, commandInput: {}, invoke: (runDirectory) => emitRunBatch({ runDirectory }) };
  }
  if (operation === 'confirm-batch') {
    const value = progressToWaiting(TEMP, 'exact-confirm');
    const token = activeRun(value.runDirectory).context.confirmation.expected_user_token;
    assert.equal(confirmRunBatch({ runDirectory: value.runDirectory, userToken: token }).passed, true);
    return { operation, runDirectory: value.runDirectory, commandInput: { userToken: token }, invoke: (runDirectory) => confirmRunBatch({ runDirectory, userToken: token }) };
  }
  if (operation === 'attach-evidence') {
    const value = progressToConfirmed(TEMP, 'exact-evidence');
    const evidenceSourceFile = createEvidenceSources(TEMP, value.runDirectory, 'exact-evidence')[0];
    const evidenceBytes = fileBytes(evidenceSourceFile);
    const evidenceSha = sha256Bytes(evidenceBytes);
    assert.equal(attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile }).passed, true);
    return { operation, runDirectory: value.runDirectory, commandInput: { evidenceBytes, evidenceRef: `evidence/EV-${evidenceSha.slice(0, 20)}.json` }, invoke: (runDirectory) => attachRunEvidence({ runDirectory, evidenceSourceFile }) };
  }
  const value = completeHappyRun(TEMP, 'exact-completion');
  return { operation: 'real-completion', runDirectory: value.runDirectory, commandInput: {}, invoke: (runDirectory) => completeRun({ runDirectory }) };
}

function buildBaseline(operation) {
  const value = operationCase(operation);
  const replay = verifyCommittedTransitionReplay({ active: activeRun(value.runDirectory), operation: value.operation, commandInput: value.commandInput });
  assert.equal(replay.matched, true);
  assert.equal(replay.outcome?.passed, true, JSON.stringify(replay.outcome?.diagnostics));
  assert.ok(replay.expected);
  const backupDirectory = `${value.runDirectory}.backup`;
  fs.cpSync(value.runDirectory, backupDirectory, { recursive: true, preserveTimestamps: true });
  return { ...value, expected: replay.expected, backupDirectory };
}

function assertExactPositiveReplay(baseline) {
  const targets = canonicalTargets(baseline.runDirectory, baseline.expected);
  const before = snapshotTargets(targets);
  const beforeGenerationCount = generationCount(baseline.runDirectory);
  const result = baseline.invoke(baseline.runDirectory);
  assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
  assert.equal(result.replayed_existing_transition, true);
  assert.equal(result.publication_recovery, 'post_commit_replay');
  assert.equal(result.state_modified, false);
  assert.equal(result.generation_created, false);
  assert.equal(result.generation_reused, true);
  assert.equal(result.current_pointer_advanced, false);
  assert.equal(generationCount(baseline.runDirectory), beforeGenerationCount);
  assertSnapshotUnchanged(before);
}

function assertTamperBlocked(baseline, target, mutate, { checkValidator = false, requireSharedConflict = false } = {}) {
  restoreRun(baseline.runDirectory, baseline.backupDirectory);
  const targets = canonicalTargets(baseline.runDirectory, baseline.expected);
  const selected = targets.find((entry) => entry.label === target.label);
  assert.ok(selected, target.label);
  mutate(selected.file);
  if (checkValidator) {
    const validator = validateCanonicalRun(baseline.runDirectory, { fullDerivation: true });
    assert.equal(validator.passed, false, `independent validator accepted tamper: ${target.label}`);
    if (requireSharedConflict) assert.equal(hasCode(validator, 'RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT'), true, JSON.stringify(validator.diagnostics));
  }
  const beforeInvoke = snapshotTargets(targets);
  const beforeGenerationCount = generationCount(baseline.runDirectory);
  const result = baseline.invoke(baseline.runDirectory);
  assert.equal(result.passed, false, `tamper unexpectedly replayed: ${target.label}`);
  assert.equal(hasCode(result, 'RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT'), true, JSON.stringify(result.diagnostics));
  assert.equal(result.state_modified, false);
  assert.equal(result.current_pointer_advanced, false);
  assert.equal(result.generation_created, false);
  assert.equal(generationCount(baseline.runDirectory), beforeGenerationCount);
  assertSnapshotUnchanged(beforeInvoke);
}

function assertMissingAuxiliaryBlocked(baseline, checkValidator) {
  restoreRun(baseline.runDirectory, baseline.backupDirectory);
  const targets = canonicalTargets(baseline.runDirectory, baseline.expected);
  const ref = [...baseline.expected.auxiliary.keys()][0];
  const target = path.join(baseline.runDirectory, ref);
  const nonTargetSnapshot = snapshotTargets(targets.filter((entry) => entry.file !== target));
  const beforeGenerationCount = generationCount(baseline.runDirectory);
  fs.rmSync(target);
  if (checkValidator) {
    const validator = validateCanonicalRun(baseline.runDirectory, { fullDerivation: true });
    assert.equal(validator.passed, false, `independent validator accepted missing auxiliary: ${ref}`);
  }
  const result = baseline.invoke(baseline.runDirectory);
  assert.equal(result.passed, false, `missing auxiliary unexpectedly replayed: ${ref}`);
  assert.equal(hasCode(result, 'RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT'), true, JSON.stringify(result.diagnostics));
  assert.equal(result.state_modified, false);
  assert.equal(result.current_pointer_advanced, false);
  assert.equal(result.generation_created, false);
  assert.equal(generationCount(baseline.runDirectory), beforeGenerationCount);
  assert.equal(fs.existsSync(target), false, `Runtime recreated missing committed auxiliary: ${ref}`);
  assertSnapshotUnchanged(nonTargetSnapshot);
}

function rawTamper(file) { fs.appendFileSync(file, '\nRAW-TAMPER\n'); }
function semanticMutations(baseline) {
  const manifest = readJson(path.join(baseline.runDirectory, baseline.expected.nextRef, 'run-manifest.json'));
  const emitValidator = baseline.operation === 'emit-batch';
  const cases = [
    { name: 'runtime Context canonical bytes', label: 'generation:runtime-context.json', mutate: reverseTopLevelJson },
    { name: 'Session canonical bytes', label: 'generation:session-state.json', mutate: reverseTopLevelJson },
    { name: 'Checkpoint canonical bytes', label: 'generation:checkpoint.json', mutate: reverseTopLevelJson },
    { name: 'Manifest canonical bytes', label: 'generation:run-manifest.json', mutate: reverseTopLevelJson },
    { name: 'CURRENT canonical bytes', label: 'CURRENT.json', mutate: reverseTopLevelJson },
    { name: 'Manifest predecessor binding', label: 'generation:run-manifest.json', checkValidator: emitValidator, mutate: (file) => mutateResult(file, (value) => { value.generation.predecessor_checkpoint_id = replaceLastCharacter(value.generation.predecessor_checkpoint_id); value.manifest_digest = digestWithout(value, 'manifest_digest'); }) },
    { name: 'CURRENT semantic pointer', label: 'CURRENT.json', checkValidator: emitValidator, mutate: (file) => mutateResult(file, (value) => { value.checkpoint_id = replaceLastCharacter(value.checkpoint_id); value.pointer_digest = digestWithout(value, 'pointer_digest'); }) }
  ];
  const resultRef = baseline.expected.auxiliaryFiles.find((entry) => entry.ref.endsWith('result.json'))?.ref || baseline.expected.auxiliaryFiles.find((entry) => entry.ref.includes('result'))?.ref;
  if (resultRef) {
    const resultLabel = `auxiliary:${resultRef}`;
    cases.push({ name: 'transition_id', label: resultLabel, mutate: (file) => mutateResult(file, (value) => { value.transition_id = replaceLastCharacter(value.transition_id); }) });
    cases.push({ name: 'predecessor_checkpoint', label: resultLabel, mutate: (file) => mutateResult(file, (value) => { value.predecessor_checkpoint.checkpoint_sequence += 1; }) });
    cases.push({ name: 'resulting_checkpoint', label: resultLabel, mutate: (file) => mutateResult(file, (value) => { value.resulting_checkpoint.checkpoint_sequence += 1; }) });
    cases.push({ name: 'publication.files order', label: resultLabel, mutate: (file) => mutateResult(file, (value) => { value.publication.files = [...value.publication.files].reverse(); }) });
    cases.push({ name: 'wrong publication file set', label: resultLabel, checkValidator: emitValidator, requireSharedConflict: emitValidator, mutate: (file) => mutateResult(file, (value) => { value.publication.files = value.publication.files.slice(0, -1); }) });
    cases.push({ name: 'Result identity fields', label: resultLabel, mutate: (file) => mutateResult(file, (value) => { value.context_digest = value.context_digest === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64); }) });
    cases.push({ name: 'Result Action bindings', label: resultLabel, mutate: (file) => mutateResult(file, mutateFirstDigest) });
    cases.push({ name: 'valid JSON Schema-invalid Result', label: resultLabel, checkValidator: emitValidator, requireSharedConflict: emitValidator, mutate: (file) => mutateResult(file, (value) => { delete value.status; }) });
  }
  if (baseline.operation === 'confirm-batch') {
    cases.push({ name: 'Confirmation operator token', label: `auxiliary:${manifest.active_confirmation_receipt_ref}`, checkValidator: true, requireSharedConflict: true, mutate: (file) => mutateResult(file, (value) => { value.operator_token = `${value.operator_token}-tampered`; }) });
    cases.push({ name: 'Confirmation Receipt digest', label: `auxiliary:${manifest.active_confirmation_receipt_ref}`, checkValidator: true, requireSharedConflict: true, mutate: (file) => mutateResult(file, (value) => { value.receipt_digest = '0'.repeat(64); }) });
    cases.push({ name: 'Confirmation Result receipt binding', label: `auxiliary:${manifest.active_confirmation_result_ref}`, mutate: (file) => mutateResult(file, (value) => { value.receipt_digest = '0'.repeat(64); }) });
  }
  if (baseline.operation === 'attach-evidence') {
    cases.push({ name: 'Evidence snapshot bytes', label: `auxiliary:${manifest.evidence_snapshot_refs.at(-1)}`, checkValidator: true, requireSharedConflict: true, mutate: reverseTopLevelJson });
    cases.push({ name: 'Evidence attachment Result', label: `auxiliary:${manifest.evidence_attachment_result_refs.at(-1)}`, checkValidator: true, requireSharedConflict: true, mutate: (file) => mutateResult(file, (value) => { value.evidence_snapshot_sha256 = '0'.repeat(64); }) });
  }
  if (baseline.operation === 'real-completion') {
    cases.push({ name: 'Completion verified_evidence_ids', label: `auxiliary:${manifest.completion_result_ref}`, checkValidator: true, requireSharedConflict: true, mutate: (file) => mutateResult(file, (value) => { value.verified_evidence_ids = [...value.verified_evidence_ids].reverse(); }) });
    cases.push({ name: 'Completion truth flags', label: `auxiliary:${manifest.completion_result_ref}`, mutate: (file) => mutateResult(file, (value) => { value.builder_build_complete = false; }) });
    cases.push({ name: 'completion-status.json', label: `auxiliary:${manifest.completion_status_ref}`, checkValidator: true, requireSharedConflict: true, mutate: (file) => mutateResult(file, (value) => { value.states.export_checked = false; }) });
    cases.push({ name: 'completion-gate.json', label: `auxiliary:${manifest.completion_gate_ref}`, checkValidator: true, requireSharedConflict: true, mutate: (file) => mutateResult(file, (value) => { value.proofs.layout_verified.derived_status = 'missing'; }) });
  }
  return cases;
}

try {
  for (const operation of ['emit-batch', 'confirm-batch', 'attach-evidence', 'real-completion']) {
    const baseline = buildBaseline(operation);
    test(`${operation} exact committed replay is non-mutating`, () => { restoreRun(baseline.runDirectory, baseline.backupDirectory); assertExactPositiveReplay(baseline); });
    for (const target of canonicalTargets(baseline.runDirectory, baseline.expected)) test(`${operation} raw tamper blocks exact replay at ${target.label}`, () => assertTamperBlocked(baseline, target, rawTamper));
    test(`${operation} missing committed auxiliary blocks replay`, () => assertMissingAuxiliaryBlocked(baseline, operation === 'real-completion'));
    for (const mutation of semanticMutations(baseline)) test(`${operation} ${mutation.name} tamper blocks replay`, () => assertTamperBlocked(baseline, mutation, mutation.mutate, { checkValidator: mutation.checkValidator, requireSharedConflict: mutation.requireSharedConflict }));
    if (operation === 'confirm-batch') {
      test('confirm-batch different command token conflicts without another transition', () => {
        restoreRun(baseline.runDirectory, baseline.backupDirectory);
        const targets = canonicalTargets(baseline.runDirectory, baseline.expected);
        const before = snapshotTargets(targets);
        const beforeCount = generationCount(baseline.runDirectory);
        const result = confirmRunBatch({ runDirectory: baseline.runDirectory, userToken: `${baseline.commandInput.userToken}-different` });
        assert.equal(result.passed, false);
        assert.equal(hasCode(result, 'RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT'), true, JSON.stringify(result.diagnostics));
        assert.equal(result.state_modified, false);
        assert.equal(generationCount(baseline.runDirectory), beforeCount);
        assertSnapshotUnchanged(before);
      });
    }
  }
} finally { fs.rmSync(TEMP, { recursive: true, force: true }); }

if (failures.length) {
  console.error('Committed replay exactness tests failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Passed ${count - failures.length}/${count} tests.`);
  process.exit(1);
}
console.log(`Committed replay exactness tests passed: ${count}/${count}.`);
