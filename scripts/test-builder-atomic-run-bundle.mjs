#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { computeCanonicalDigest, computePackageDigest, sha256Bytes } from './lib/canonical-builder-package.mjs';
import {
  completeRun,
  confirmRunBatch,
  emitRunBatch,
  initializeAtomicRun
} from './lib/runtime/canonical-run-runtime.mjs';

const ROOT = process.cwd();
const CLI = path.join(ROOT, 'scripts', 'builder-inspector.mjs');
const BUILDER_FIXTURE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'builder_context_package.json');
const CE_FIXTURE = path.join(ROOT, 'tests', 'valid', 'ce_builder_package_adapter_valid.json');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-atomic-run-bundle-'));
const failures = [];
let count = 0;

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
};
const clone = (value) => structuredClone(value);

function test(title, fn) {
  count += 1;
  try {
    fn();
    console.log(`PASS ${count}: ${title}`);
  } catch (error) {
    failures.push(`FAIL ${count}: ${title}: ${error.message}`);
  }
}

function runCli(args, expectedSuccess = true) {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, shell: false });
  if (expectedSuccess && (result.error || result.status !== 0)) throw new Error(result.error?.message || result.stderr || result.stdout);
  if (!expectedSuccess && result.status === 0) throw new Error(`Command unexpectedly succeeded: ${args.join(' ')}`);
  let output = null;
  try { output = JSON.parse(result.stdout); } catch { /* usage failures may write stderr only */ }
  return { ...result, output };
}

function cleanBuilderPackage() {
  const pkg = read(BUILDER_FIXTURE);
  for (const entry of pkg.source_payload_ledger || []) entry.source_ref = `operator-content:${entry.payload_name}`;
  pkg.input_authorization.package_digest.value = computePackageDigest(pkg);
  return pkg;
}

function sourceCase(mode, name) {
  const directory = path.join(TEMP, name);
  fs.mkdirSync(directory, { recursive: true });
  if (mode === 'manual-builder-input') {
    const builder = write(path.join(directory, 'builder-input.json'), cleanBuilderPackage());
    return { sourceArg: '-', builderArg: builder, externalFiles: [builder] };
  }
  if (mode === 'project-gate') {
    const pkg = cleanBuilderPackage();
    const builder = write(path.join(directory, 'builder-input.json'), pkg);
    const receipt = write(path.join(directory, 'project-gate-receipt.json'), {
      schema: 'ev4-project-gate-c2b-receipt@1.0.0',
      receipt_id: `PG-${name}`,
      producer_repository: 'metadata-not-authority/example',
      producer_commit_sha: '0'.repeat(40),
      source_file_sha256: sha256Bytes(fs.readFileSync(builder)),
      canonical_package_digest: computePackageDigest(pkg)
    });
    return { sourceArg: receipt, builderArg: builder, externalFiles: [receipt, builder] };
  }
  const wrapper = read(CE_FIXTURE);
  wrapper.content_sha256 = computeCanonicalDigest(wrapper.ce_builder_executable_package);
  wrapper.producer_repository = 'metadata-not-authority/example';
  const source = write(path.join(directory, 'direct-ce-source.json'), wrapper);
  return { sourceArg: source, builderArg: '-', externalFiles: [source] };
}

function evidenceSources(runDirectory, name) {
  const context = read(path.join(runDirectory, 'runtime-context.json'));
  const session = read(path.join(runDirectory, 'session-state.json'));
  const directory = path.join(TEMP, `${name}-evidence`);
  const sources = [];
  function add(label, evidenceType, claimIds, claimClasses, subjectRef, actionId = null) {
    sources.push(write(path.join(directory, `${label}.json`), {
      schema: 'ev4-builder-evidence-source@1.0.0',
      evidence_type: evidenceType,
      claim_ids: claimIds,
      claim_classes: claimClasses,
      subject_ref: subjectRef,
      session_id: session.session_id,
      package_digest: context.canonical_package_digest,
      ...(actionId ? { action_id: actionId } : {}),
      status: 'verified'
    }));
  }
  for (const actionId of context.action_batch.action_ids) add(`action-${actionId}`, 'diagnostic', [`ASSERT-${actionId}`], ['required_action_execution'], actionId, actionId);
  add('scaffold', 'diagnostic', ['ASSERT-SCAFFOLD'], ['scaffold_built'], 'builder-output');
  add('structure', 'structure_panel_screenshot', ['ASSERT-STRUCTURE'], ['structure_built'], 'builder-output');
  add('content', 'editor_screenshot', ['ASSERT-CONTENT'], ['content_filled'], 'builder-output');
  add('layout', 'frontend_screenshot', ['ASSERT-LAYOUT'], ['desktop_layout_established', 'layout_verified'], 'builder-output');
  add('export', 'export_json', ['ASSERT-EXPORT'], ['export_checked', 'export_verified'], 'builder-output');
  return sources;
}

function executeHappyFlow(mode, name, deleteExternal = true) {
  const source = sourceCase(mode, name);
  const runDirectory = path.join(TEMP, `run-${name}`);
  const intake = runCli(['real-intake', mode, source.sourceArg, source.builderArg, runDirectory]).output;
  assert.equal(intake.runtime_state, 'BUILD_ACTIVE');
  assert.equal(intake.resulting_checkpoint.checkpoint_sequence, 1);
  assert.equal(intake.resulting_checkpoint.parent_checkpoint_id, null);
  if (deleteExternal) for (const file of source.externalFiles) fs.rmSync(file, { force: true });
  const emitted = runCli(['emit-batch', runDirectory]).output;
  assert.equal(emitted.runtime_state, 'WAITING_FOR_CONFIRMATION');
  const context = read(path.join(runDirectory, 'runtime-context.json'));
  const confirmed = runCli(['confirm-batch', runDirectory, context.confirmation.expected_user_token]).output;
  assert.equal(confirmed.runtime_state, 'BUILD_ACTIVE');
  const evidenceFiles = evidenceSources(runDirectory, name);
  for (const evidenceFile of evidenceFiles) {
    runCli(['attach-evidence', runDirectory, evidenceFile]);
    fs.rmSync(evidenceFile, { force: true });
  }
  const completed = runCli(['real-completion', runDirectory]).output;
  assert.equal(completed.runtime_state, 'COMPLETED');
  assert.equal(completed.builder_build_complete, true);
  assert.equal(completed.responsive_complete, false);
  assert.equal(completed.production_ready, false);
  runCli([path.join(ROOT, 'scripts', 'validate-canonical-run-artifacts.mjs'), runDirectory]);
  return { runDirectory, intake, emitted, confirmed, completed };
}

function copyRun(source, name) {
  const target = path.join(TEMP, name);
  fs.cpSync(source, target, { recursive: true });
  return target;
}

function refreshManifest(runDirectory, mutate) {
  const file = path.join(runDirectory, 'run-manifest.json');
  const manifest = read(file);
  mutate(manifest);
  manifest.manifest_digest = null;
  const cloneManifest = clone(manifest);
  delete cloneManifest.manifest_digest;
  manifest.manifest_digest = computeCanonicalDigest(cloneManifest);
  write(file, manifest);
}

function mutateContextCoherently(runDirectory, mutate) {
  const contextFile = path.join(runDirectory, 'runtime-context.json');
  const sessionFile = path.join(runDirectory, 'session-state.json');
  const checkpointFile = path.join(runDirectory, 'checkpoint.json');
  const context = read(contextFile);
  const session = read(sessionFile);
  const checkpoint = read(checkpointFile);
  mutate(context);
  delete context.context_digest;
  context.context_digest = computeCanonicalDigest(context);
  checkpoint.package_digest = context.canonical_package_digest;
  checkpoint.selected_candidate_id = context.selected_candidate_id;
  checkpoint.batch_id = context.action_batch.batch_id;
  checkpoint.unconfirmed_action_ids = [...context.action_batch.action_ids];
  session.package_digest = context.canonical_package_digest;
  session.selected_candidate_id = context.selected_candidate_id;
  session.last_verified_checkpoint = checkpoint;
  write(contextFile, context);
  write(checkpointFile, checkpoint);
  write(sessionFile, session);
  refreshManifest(runDirectory, (manifest) => {
    manifest.runtime_context_digest = context.context_digest;
    manifest.canonical_package_digest = context.canonical_package_digest;
    manifest.selected_candidate_id = context.selected_candidate_id;
    manifest.active_batch_id = context.action_batch.batch_id;
  });
}

function manualInitial(name) {
  const source = sourceCase('manual-builder-input', name);
  const runDirectory = path.join(TEMP, `run-${name}`);
  const result = initializeAtomicRun({ sourceMode: 'manual-builder-input', builderInputFile: source.builderArg, runDirectory });
  assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
  return { runDirectory, source };
}

try {
  for (const mode of ['project-gate', 'direct-ce', 'manual-builder-input']) {
    test(`public canonical end-to-end flow preserves ${mode}`, () => executeHappyFlow(mode, `happy-${mode}`));
  }

  test('failed Intake publishes no partial Run', () => {
    const source = sourceCase('manual-builder-input', 'partial-intake');
    const runDirectory = path.join(TEMP, 'run-partial-intake');
    const result = initializeAtomicRun({ sourceMode: 'manual-builder-input', builderInputFile: source.builderArg, runDirectory, failureInjection: 'before_commit' });
    assert.equal(result.passed, false);
    assert.equal(fs.existsSync(runDirectory), false);
  });

  test('duplicate Run initialization is rejected', () => {
    const c = manualInitial('duplicate-intake');
    const result = initializeAtomicRun({ sourceMode: 'manual-builder-input', builderInputFile: c.source.builderArg, runDirectory: c.runDirectory });
    assert.equal(result.passed, false);
  });

  for (const [label, mutation] of [
    ['Context drift', (c) => { c.origin_assurance = 'not_independently_verified'; }],
    ['Package drift', (c) => { c.canonical_package_digest = 'a'.repeat(64); }],
    ['Candidate drift', (c) => { c.selected_candidate_id = 'CANDIDATE-FOREIGN'; }],
    ['Action ID drift', (c) => { c.action_batch.action_ids[0] = `${c.action_batch.action_ids[0]}-FOREIGN`; }],
    ['Action body drift', (c) => { c.action_batch.action_digests[c.action_batch.action_ids[0]] = 'b'.repeat(64); }],
    ['Confirmation drift', (c) => { c.confirmation.confirmation_id = 'CONFIRM-FOREIGN'; }]
  ]) {
    test(`${label} blocks emit-batch before Action emission`, () => {
      const c = manualInitial(`drift-${label.replaceAll(' ', '-').toLowerCase()}`);
      mutateContextCoherently(c.runDirectory, mutation);
      assert.equal(emitRunBatch({ runDirectory: c.runDirectory }).passed, false);
    });
  }

  test('internal source snapshot drift blocks emit-batch', () => {
    const c = manualInitial('snapshot-drift');
    fs.appendFileSync(path.join(c.runDirectory, 'source', 'selected-source.json'), ' ');
    assert.equal(emitRunBatch({ runDirectory: c.runDirectory }).passed, false);
  });

  test('manifest source hash drift blocks emit-batch', () => {
    const c = manualInitial('manifest-hash-drift');
    refreshManifest(c.runDirectory, (manifest) => { manifest.source_snapshot_sha256 = 'c'.repeat(64); });
    assert.equal(emitRunBatch({ runDirectory: c.runDirectory }).passed, false);
  });

  test('active blocker blocks emit-batch and is exposed', () => {
    const c = manualInitial('blocker-before-emit');
    const checkpoint = read(path.join(c.runDirectory, 'checkpoint.json'));
    const session = read(path.join(c.runDirectory, 'session-state.json'));
    checkpoint.unresolved_blockers = ['BLOCKER-001'];
    session.unresolved_evidence = ['BLOCKER-001'];
    session.last_verified_checkpoint = checkpoint;
    write(path.join(c.runDirectory, 'checkpoint.json'), checkpoint);
    write(path.join(c.runDirectory, 'session-state.json'), session);
    const result = emitRunBatch({ runDirectory: c.runDirectory });
    assert.equal(result.passed, false);
    assert.deepEqual(result.active_blockers, ['BLOCKER-001']);
  });

  test('wrong WAITING Checkpoint blocks Confirmation', () => {
    const c = manualInitial('wrong-waiting');
    assert.equal(emitRunBatch({ runDirectory: c.runDirectory }).passed, true);
    const checkpoint = read(path.join(c.runDirectory, 'checkpoint.json'));
    const session = read(path.join(c.runDirectory, 'session-state.json'));
    checkpoint.checkpoint_id = 'CP-WRONG-WAITING';
    session.last_verified_checkpoint = checkpoint;
    write(path.join(c.runDirectory, 'checkpoint.json'), checkpoint);
    write(path.join(c.runDirectory, 'session-state.json'), session);
    refreshManifest(c.runDirectory, (manifest) => { manifest.current_checkpoint_id = checkpoint.checkpoint_id; });
    const context = read(path.join(c.runDirectory, 'runtime-context.json'));
    assert.equal(confirmRunBatch({ runDirectory: c.runDirectory, userToken: context.confirmation.expected_user_token }).passed, false);
  });

  test('wrong operator token blocks Confirmation', () => {
    const c = manualInitial('wrong-token');
    assert.equal(emitRunBatch({ runDirectory: c.runDirectory }).passed, true);
    assert.equal(confirmRunBatch({ runDirectory: c.runDirectory, userToken: 'WRONG' }).passed, false);
  });

  test('Confirmation Context mismatch blocks Confirmation', () => {
    const c = manualInitial('confirm-context-drift');
    assert.equal(emitRunBatch({ runDirectory: c.runDirectory }).passed, true);
    const manifest = read(path.join(c.runDirectory, 'run-manifest.json'));
    const emitFile = path.join(c.runDirectory, manifest.active_emit_result_ref);
    const emitResult = read(emitFile);
    emitResult.context_digest = 'd'.repeat(64);
    write(emitFile, emitResult);
    const context = read(path.join(c.runDirectory, 'runtime-context.json'));
    assert.equal(confirmRunBatch({ runDirectory: c.runDirectory, userToken: context.confirmation.expected_user_token }).passed, false);
  });

  test('unverified Evidence status is rejected before snapshot publication', () => {
    const c = manualInitial('unverified-evidence');
    emitRunBatch({ runDirectory: c.runDirectory });
    const context = read(path.join(c.runDirectory, 'runtime-context.json'));
    confirmRunBatch({ runDirectory: c.runDirectory, userToken: context.confirmation.expected_user_token });
    const session = read(path.join(c.runDirectory, 'session-state.json'));
    const source = write(path.join(TEMP, 'unverified.json'), { schema: 'ev4-builder-evidence-source@1.0.0', evidence_type: 'diagnostic', claim_ids: ['ASSERT-X'], claim_classes: ['required_action_execution'], subject_ref: context.action_batch.action_ids[0], action_id: context.action_batch.action_ids[0], session_id: session.session_id, package_digest: context.canonical_package_digest, status: 'pending' });
    const result = runCli(['attach-evidence', c.runDirectory, source], false).output;
    assert.equal(result.status, 'blocked');
  });

  test('generic-subject Action Evidence is rejected', () => {
    const c = manualInitial('generic-action-evidence');
    emitRunBatch({ runDirectory: c.runDirectory });
    const context = read(path.join(c.runDirectory, 'runtime-context.json'));
    confirmRunBatch({ runDirectory: c.runDirectory, userToken: context.confirmation.expected_user_token });
    const session = read(path.join(c.runDirectory, 'session-state.json'));
    const source = write(path.join(TEMP, 'generic-action.json'), { schema: 'ev4-builder-evidence-source@1.0.0', evidence_type: 'diagnostic', claim_ids: ['ASSERT-X'], claim_classes: ['required_action_execution'], subject_ref: 'builder-output', action_id: context.action_batch.action_ids[0], session_id: session.session_id, package_digest: context.canonical_package_digest, status: 'verified' });
    assert.equal(runCli(['attach-evidence', c.runDirectory, source], false).output.status, 'blocked');
  });

  test('Evidence snapshot drift blocks Completion', () => {
    const c = executeHappyFlow('manual-builder-input', 'evidence-drift-base', false);
    const completedCopy = copyRun(c.runDirectory, 'evidence-drift-copy');
    const manifest = read(path.join(completedCopy, 'run-manifest.json'));
    const evidenceRef = manifest.evidence_snapshot_refs[0];
    fs.appendFileSync(path.join(completedCopy, evidenceRef), ' ');
    const checkpoint = read(path.join(completedCopy, 'checkpoint.json'));
    checkpoint.runtime_state = 'BUILD_ACTIVE';
    const session = read(path.join(completedCopy, 'session-state.json'));
    session.runtime_state = 'BUILD_ACTIVE';
    session.current_state = 'BUILD_ACTIVE';
    session.last_verified_checkpoint = checkpoint;
    write(path.join(completedCopy, 'checkpoint.json'), checkpoint);
    write(path.join(completedCopy, 'session-state.json'), session);
    refreshManifest(completedCopy, (m) => { m.current_runtime_state = 'BUILD_ACTIVE'; m.completion_result_ref = null; m.completion_status_ref = null; m.completion_gate_ref = null; });
    assert.equal(completeRun({ runDirectory: completedCopy }).passed, false);
  });

  test('Batch drift before Completion is rejected', () => {
    const c = manualInitial('batch-drift-completion');
    emitRunBatch({ runDirectory: c.runDirectory });
    const context = read(path.join(c.runDirectory, 'runtime-context.json'));
    confirmRunBatch({ runDirectory: c.runDirectory, userToken: context.confirmation.expected_user_token });
    const checkpoint = read(path.join(c.runDirectory, 'checkpoint.json'));
    const session = read(path.join(c.runDirectory, 'session-state.json'));
    checkpoint.batch_id = 'BATCH-FOREIGN';
    session.last_verified_checkpoint = checkpoint;
    write(path.join(c.runDirectory, 'checkpoint.json'), checkpoint);
    write(path.join(c.runDirectory, 'session-state.json'), session);
    assert.equal(completeRun({ runDirectory: c.runDirectory }).passed, false);
  });

  test('sequence/parent corruption is rejected', () => {
    const c = manualInitial('sequence-corruption');
    const checkpoint = read(path.join(c.runDirectory, 'checkpoint.json'));
    const session = read(path.join(c.runDirectory, 'session-state.json'));
    checkpoint.checkpoint_sequence = 2;
    checkpoint.parent_checkpoint_id = null;
    session.last_verified_checkpoint = checkpoint;
    write(path.join(c.runDirectory, 'checkpoint.json'), checkpoint);
    write(path.join(c.runDirectory, 'session-state.json'), session);
    refreshManifest(c.runDirectory, (manifest) => { manifest.current_checkpoint_sequence = 2; });
    assert.equal(emitRunBatch({ runDirectory: c.runDirectory }).passed, false);
  });

  test('Legacy real-completion multi-carrier API is inactive', () => {
    runCli(['real-completion', 'manual-builder-input', '-', 'builder.json', 'context.json', 'session.json', 'checkpoint.json', 'receipt.json', 'output'], false);
  });

  test('failed atomic Confirmation preserves active Run pointers', () => {
    const c = manualInitial('partial-confirmation');
    emitRunBatch({ runDirectory: c.runDirectory });
    const before = fs.readFileSync(path.join(c.runDirectory, 'run-manifest.json'));
    const context = read(path.join(c.runDirectory, 'runtime-context.json'));
    const result = confirmRunBatch({ runDirectory: c.runDirectory, userToken: context.confirmation.expected_user_token, failureInjection: 'before_commit' });
    assert.equal(result.passed, false);
    assert.equal(fs.readFileSync(path.join(c.runDirectory, 'run-manifest.json')).equals(before), true);
  });

  test('failed atomic Completion preserves active Run pointers', () => {
    const c = executeHappyFlow('manual-builder-input', 'partial-completion-base', false);
    const runDirectory = copyRun(c.runDirectory, 'partial-completion-copy');
    const checkpoint = read(path.join(runDirectory, 'checkpoint.json'));
    const session = read(path.join(runDirectory, 'session-state.json'));
    checkpoint.runtime_state = 'BUILD_ACTIVE';
    session.runtime_state = 'BUILD_ACTIVE';
    session.current_state = 'BUILD_ACTIVE';
    session.last_verified_checkpoint = checkpoint;
    write(path.join(runDirectory, 'checkpoint.json'), checkpoint);
    write(path.join(runDirectory, 'session-state.json'), session);
    refreshManifest(runDirectory, (manifest) => { manifest.current_runtime_state = 'BUILD_ACTIVE'; manifest.completion_result_ref = null; manifest.completion_status_ref = null; manifest.completion_gate_ref = null; });
    const before = fs.readFileSync(path.join(runDirectory, 'run-manifest.json'));
    const result = completeRun({ runDirectory, failureInjection: 'before_commit' });
    assert.equal(result.passed, false);
    assert.equal(fs.readFileSync(path.join(runDirectory, 'run-manifest.json')).equals(before), true);
  });
} finally {
  fs.rmSync(TEMP, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Atomic Run Bundle tests failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(`Passed ${count - failures.length}/${count} tests.`);
  process.exit(1);
}
console.log(`Atomic Run Bundle tests passed: ${count}/${count}.`);
