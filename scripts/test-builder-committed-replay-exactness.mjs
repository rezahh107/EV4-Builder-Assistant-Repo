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

const RESULT_SHAPE_POLICIES = Object.freeze({
  LOAD_FAILURE_FLAGS_OPTIONAL: 'LOAD_FAILURE_FLAGS_OPTIONAL',
  MUTATION_OUTCOME_FLAGS_REQUIRED: 'MUTATION_OUTCOME_FLAGS_REQUIRED'
});
const NON_MUTATION_FIELDS = Object.freeze([
  'state_modified',
  'current_pointer_advanced',
  'generation_created'
]);

const DIAGNOSTIC_EXPECTATIONS = Object.freeze({
  CURRENT_LOADING: Object.freeze({
    boundary: 'CURRENT loading',
    codes: Object.freeze(['RUN-LOAD-003']),
    resultShapePolicy: RESULT_SHAPE_POLICIES.LOAD_FAILURE_FLAGS_OPTIONAL
  }),
  ACTIVE_GENERATION_PARSING: Object.freeze({
    boundary: 'active-generation parsing',
    codes: Object.freeze(['RUN-GENERATION-001']),
    resultShapePolicy: RESULT_SHAPE_POLICIES.LOAD_FAILURE_FLAGS_OPTIONAL
  }),
  ACTIVE_POINTER_DIGEST_RECONCILIATION: Object.freeze({
    boundary: 'active-pointer digest reconciliation',
    codes: Object.freeze(['RUN-LOAD-006']),
    resultShapePolicy: RESULT_SHAPE_POLICIES.LOAD_FAILURE_FLAGS_OPTIONAL
  }),
  ACTIVE_POINTER_RECONCILIATION: Object.freeze({
    boundary: 'active-pointer reconciliation',
    codes: Object.freeze(['RUN-LOAD-007']),
    resultShapePolicy: RESULT_SHAPE_POLICIES.LOAD_FAILURE_FLAGS_OPTIONAL
  }),
  EXACT_COMMITTED_BYTE_COMPARISON: Object.freeze({
    boundary: 'exact committed-byte comparison',
    codes: Object.freeze(['RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT']),
    resultShapePolicy: RESULT_SHAPE_POLICIES.MUTATION_OUTCOME_FLAGS_REQUIRED
  })
});

function test(title, fn) {
  count += 1;
  try { fn(); console.log(`PASS ${count}: ${title}`); }
  catch (error) { failures.push(`FAIL ${count}: ${title}: ${error.stack || error.message}`); }
}
function hasCode(result, code) { return (result?.diagnostics || []).some((entry) => entry.code === code); }
function diagnosticCodes(result) { return [...new Set((result?.diagnostics || []).map((entry) => entry?.code).filter(Boolean))].sort(); }
function assertDiagnosticBoundary(result, expectation, label) {
  assert.ok(expectation?.boundary, `Missing diagnostic boundary for ${label}`);
  assert.ok(Array.isArray(expectation?.codes) && expectation.codes.length > 0, `Missing diagnostic code set for ${label}`);
  assert.ok(Object.values(RESULT_SHAPE_POLICIES).includes(expectation?.resultShapePolicy), `Missing result-shape policy for ${label}`);
  assert.deepEqual(
    diagnosticCodes(result),
    [...expectation.codes].sort(),
    `${label} was not rejected at the expected ${expectation.boundary} boundary: ${JSON.stringify(result?.diagnostics || [])}`
  );
}
function assertNonMutatingOutcome(result, resultShapePolicy, label) {
  assert.ok(Object.values(RESULT_SHAPE_POLICIES).includes(resultShapePolicy), `Unknown result-shape policy for ${label}`);
  const outcome = result && typeof result === 'object' ? result : {};
  for (const field of NON_MUTATION_FIELDS) {
    const present = field in outcome;
    const own = Object.hasOwn(outcome, field);
    if (resultShapePolicy === RESULT_SHAPE_POLICIES.MUTATION_OUTCOME_FLAGS_REQUIRED) {
      assert.equal(own, true, `${label} omitted required ${field}`);
    } else if (present) {
      assert.equal(own, true, `${label} inherited ${field} instead of exposing an own property`);
    }
    if (own) assert.equal(outcome[field], false, `${label} set ${field} to a non-false value`);
  }
}
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

function rawTamperExpectation(label) {
  if (label === 'CURRENT.json') return DIAGNOSTIC_EXPECTATIONS.CURRENT_LOADING;
  if (label.startsWith('generation:')) return DIAGNOSTIC_EXPECTATIONS.ACTIVE_GENERATION_PARSING;
  return DIAGNOSTIC_EXPECTATIONS.EXACT_COMMITTED_BYTE_COMPARISON;
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

function assertTamperBlocked(baseline, target, mutate, {
  expectedDiagnostic,
  checkValidator = false,
  requireSharedConflict = false
} = {}) {
  assert.ok(expectedDiagnostic, `Caller must classify the authoritative rejection boundary for ${target.label}`);
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
  assertDiagnosticBoundary(result, expectedDiagnostic, target.label);
  assertNonMutatingOutcome(result, expectedDiagnostic.resultShapePolicy, target.label);
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
  assertDiagnosticBoundary(result, DIAGNOSTIC_EXPECTATIONS.EXACT_COMMITTED_BYTE_COMPARISON, `missing auxiliary:${ref}`);
  assertNonMutatingOutcome(result, DIAGNOSTIC_EXPECTATIONS.EXACT_COMMITTED_BYTE_COMPARISON.resultShapePolicy, `missing auxiliary:${ref}`);
  assert.equal(generationCount(baseline.runDirectory), beforeGenerationCount);
  assert.equal(fs.existsSync(target), false, `Runtime recreated missing committed auxiliary: ${ref}`);
  assertSnapshotUnchanged(nonTargetSnapshot);
}

function rawTamper(file) { fs.appendFileSync(file, '\nRAW-TAMPER\n'); }
function semanticMutations(baseline) {
  const manifest = readJson(path.join(baseline.runDirectory, baseline.expected.nextRef, 'run-manifest.json'));
  const emitValidator = baseline.operation === 'emit-batch';
  const replayConflict = DIAGNOSTIC_EXPECTATIONS.EXACT_COMMITTED_BYTE_COMPARISON;
  const cases = [
    { name: 'runtime Context canonical bytes', label: 'generation:runtime-context.json', expectedDiagnostic: replayConflict, mutate: reverseTopLevelJson },
    { name: 'Session canonical bytes', label: 'generation:session-state.json', expectedDiagnostic: replayConflict, mutate: reverseTopLevelJson },
    { name: 'Checkpoint canonical bytes', label: 'generation:checkpoint.json', expectedDiagnostic: replayConflict, mutate: reverseTopLevelJson },
    { name: 'Manifest canonical bytes', label: 'generation:run-manifest.json', expectedDiagnostic: replayConflict, mutate: reverseTopLevelJson },
    { name: 'CURRENT canonical bytes', label: 'CURRENT.json', expectedDiagnostic: replayConflict, mutate: reverseTopLevelJson },
    { name: 'Manifest predecessor binding', label: 'generation:run-manifest.json', expectedDiagnostic: DIAGNOSTIC_EXPECTATIONS.ACTIVE_POINTER_DIGEST_RECONCILIATION, checkValidator: emitValidator, mutate: (file) => mutateResult(file, (value) => { value.generation.predecessor_checkpoint_id = replaceLastCharacter(value.generation.predecessor_checkpoint_id); value.manifest_digest = digestWithout(value, 'manifest_digest'); }) },
    { name: 'CURRENT semantic pointer', label: 'CURRENT.json', expectedDiagnostic: DIAGNOSTIC_EXPECTATIONS.ACTIVE_POINTER_RECONCILIATION, checkValidator: emitValidator, mutate: (file) => mutateResult(file, (value) => { value.checkpoint_id = replaceLastCharacter(value.checkpoint_id); value.pointer_digest = digestWithout(value, 'pointer_digest'); }) }
  ];
  const resultRef = baseline.expected.auxiliaryFiles.find((entry) => entry.ref.endsWith('result.json'))?.ref || baseline.expected.auxiliaryFiles.find((entry) => entry.ref.includes('result'))?.ref;
  if (resultRef) {
    const resultLabel = `auxiliary:${resultRef}`;
    cases.push({ name: 'transition_id', label: resultLabel, expectedDiagnostic: replayConflict, mutate: (file) => mutateResult(file, (value) => { value.transition_id = replaceLastCharacter(value.transition_id); }) });
    cases.push({ name: 'predecessor_checkpoint', label: resultLabel, expectedDiagnostic: replayConflict, mutate: (file) => mutateResult(file, (value) => { value.predecessor_checkpoint.checkpoint_sequence += 1; }) });
    cases.push({ name: 'resulting_checkpoint', label: resultLabel, expectedDiagnostic: replayConflict, mutate: (file) => mutateResult(file, (value) => { value.resulting_checkpoint.checkpoint_sequence += 1; }) });
    cases.push({ name: 'publication.files order', label: resultLabel, expectedDiagnostic: replayConflict, mutate: (file) => mutateResult(file, (value) => { value.publication.files = [...value.publication.files].reverse(); }) });
    cases.push({ name: 'wrong publication file set', label: resultLabel, expectedDiagnostic: replayConflict, checkValidator: emitValidator, requireSharedConflict: emitValidator, mutate: (file) => mutateResult(file, (value) => { value.publication.files = value.publication.files.slice(0, -1); }) });
    cases.push({ name: 'Result identity fields', label: resultLabel, expectedDiagnostic: replayConflict, mutate: (file) => mutateResult(file, (value) => { value.context_digest = value.context_digest === '0'.repeat(64) ? '1'.repeat(64) : '0'.repeat(64); }) });
    cases.push({ name: 'Result Action bindings', label: resultLabel, expectedDiagnostic: replayConflict, mutate: (file) => mutateResult(file, mutateFirstDigest) });
    cases.push({ name: 'valid JSON Schema-invalid Result', label: resultLabel, expectedDiagnostic: replayConflict, checkValidator: emitValidator, requireSharedConflict: emitValidator, mutate: (file) => mutateResult(file, (value) => { delete value.status; }) });
  }
  if (baseline.operation === 'confirm-batch') {
    cases.push({ name: 'Confirmation operator token', label: `auxiliary:${manifest.active_confirmation_receipt_ref}`, expectedDiagnostic: replayConflict, checkValidator: true, requireSharedConflict: true, mutate: (file) => mutateResult(file, (value) => { value.operator_token = `${value.operator_token}-tampered`; }) });
    cases.push({ name: 'Confirmation Receipt digest', label: `auxiliary:${manifest.active_confirmation_receipt_ref}`, expectedDiagnostic: replayConflict, checkValidator: true, requireSharedConflict: true, mutate: (file) => mutateResult(file, (value) => { value.receipt_digest = '0'.repeat(64); }) });
    cases.push({ name: 'Confirmation Result receipt binding', label: `auxiliary:${manifest.active_confirmation_result_ref}`, expectedDiagnostic: replayConflict, mutate: (file) => mutateResult(file, (value) => { value.receipt_digest = '0'.repeat(64); }) });
  }
  if (baseline.operation === 'attach-evidence') {
    cases.push({ name: 'Evidence snapshot bytes', label: `auxiliary:${manifest.evidence_snapshot_refs.at(-1)}`, expectedDiagnostic: replayConflict, checkValidator: true, requireSharedConflict: true, mutate: reverseTopLevelJson });
    cases.push({ name: 'Evidence attachment Result', label: `auxiliary:${manifest.evidence_attachment_result_refs.at(-1)}`, expectedDiagnostic: replayConflict, checkValidator: true, requireSharedConflict: true, mutate: (file) => mutateResult(file, (value) => { value.evidence_snapshot_sha256 = '0'.repeat(64); }) });
  }
  if (baseline.operation === 'real-completion') {
    cases.push({ name: 'Completion verified_evidence_ids', label: `auxiliary:${manifest.completion_result_ref}`, expectedDiagnostic: replayConflict, checkValidator: true, requireSharedConflict: true, mutate: (file) => mutateResult(file, (value) => { value.verified_evidence_ids = [...value.verified_evidence_ids].reverse(); }) });
    cases.push({ name: 'Completion truth flags', label: `auxiliary:${manifest.completion_result_ref}`, expectedDiagnostic: replayConflict, mutate: (file) => mutateResult(file, (value) => { value.builder_build_complete = false; }) });
    cases.push({ name: 'completion-status.json', label: `auxiliary:${manifest.completion_status_ref}`, expectedDiagnostic: replayConflict, checkValidator: true, requireSharedConflict: true, mutate: (file) => mutateResult(file, (value) => { value.states.export_checked = false; }) });
    cases.push({ name: 'completion-gate.json', label: `auxiliary:${manifest.completion_gate_ref}`, expectedDiagnostic: replayConflict, checkValidator: true, requireSharedConflict: true, mutate: (file) => mutateResult(file, (value) => { value.proofs.layout_verified.derived_status = 'missing'; }) });
  }
  return cases;
}

try {
  test('load-boundary result shape accepts absent non-mutation fields', () => {
    assertNonMutatingOutcome(
      { passed: false, diagnostics: [{ code: 'RUN-LOAD-003' }] },
      DIAGNOSTIC_EXPECTATIONS.CURRENT_LOADING.resultShapePolicy,
      'synthetic CURRENT-loading failure'
    );
  });
  test('load-boundary result shape rejects every present true non-mutation field', () => {
    for (const field of NON_MUTATION_FIELDS) {
      assert.throws(
        () => assertNonMutatingOutcome(
          { passed: false, diagnostics: [{ code: 'RUN-LOAD-003' }], [field]: true },
          DIAGNOSTIC_EXPECTATIONS.CURRENT_LOADING.resultShapePolicy,
          `synthetic CURRENT-loading failure with ${field}`
        ),
        { name: 'AssertionError' }
      );
    }
  });
  for (const missingField of NON_MUTATION_FIELDS) {
    test(`replay-conflict result shape rejects missing ${missingField}`, () => {
      const outcome = {
        passed: false,
        diagnostics: [{ code: 'RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT' }],
        state_modified: false,
        current_pointer_advanced: false,
        generation_created: false
      };
      delete outcome[missingField];
      assert.throws(
        () => assertNonMutatingOutcome(
          outcome,
          DIAGNOSTIC_EXPECTATIONS.EXACT_COMMITTED_BYTE_COMPARISON.resultShapePolicy,
          `synthetic replay conflict missing ${missingField}`
        ),
        { name: 'AssertionError' }
      );
    });
  }

  for (const operation of ['emit-batch', 'confirm-batch', 'attach-evidence', 'real-completion']) {
    const baseline = buildBaseline(operation);
    test(`${operation} exact committed replay is non-mutating`, () => { restoreRun(baseline.runDirectory, baseline.backupDirectory); assertExactPositiveReplay(baseline); });
    for (const target of canonicalTargets(baseline.runDirectory, baseline.expected)) {
      test(`${operation} raw tamper blocks exact replay at ${target.label}`, () => assertTamperBlocked(
        baseline,
        target,
        rawTamper,
        { expectedDiagnostic: rawTamperExpectation(target.label) }
      ));
    }
    test(`${operation} missing committed auxiliary blocks replay`, () => assertMissingAuxiliaryBlocked(baseline, operation === 'real-completion'));
    for (const mutation of semanticMutations(baseline)) {
      test(`${operation} ${mutation.name} tamper blocks replay`, () => assertTamperBlocked(
        baseline,
        mutation,
        mutation.mutate,
        {
          expectedDiagnostic: mutation.expectedDiagnostic,
          checkValidator: mutation.checkValidator,
          requireSharedConflict: mutation.requireSharedConflict
        }
      ));
    }
    if (operation === 'confirm-batch') {
      test('confirm-batch different command token conflicts without another transition', () => {
        restoreRun(baseline.runDirectory, baseline.backupDirectory);
        const targets = canonicalTargets(baseline.runDirectory, baseline.expected);
        const before = snapshotTargets(targets);
        const beforeCount = generationCount(baseline.runDirectory);
        const result = confirmRunBatch({ runDirectory: baseline.runDirectory, userToken: `${baseline.commandInput.userToken}-different` });
        assert.equal(result.passed, false);
        assertDiagnosticBoundary(result, DIAGNOSTIC_EXPECTATIONS.EXACT_COMMITTED_BYTE_COMPARISON, 'different confirm command token');
        assertNonMutatingOutcome(result, DIAGNOSTIC_EXPECTATIONS.EXACT_COMMITTED_BYTE_COMPARISON.resultShapePolicy, 'different confirm command token');
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
