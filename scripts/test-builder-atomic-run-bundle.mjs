#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  attachRunEvidence,
  completeRun,
  confirmRunBatch,
  emitRunBatch,
  initializeAtomicRun,
  validateCanonicalRun
} from './lib/runtime/canonical-run-runtime.mjs';
import {
  ROOT,
  activeRun,
  createEvidenceSources,
  createSourceCase,
  progressToConfirmed,
  progressToCompletable,
  readJson,
  writeJson
} from './lib/runtime/runtime-test-fixtures.mjs';
import {
  publishRealCompletion,
  resolveRealBuilderSource,
  writeRealIntake
} from './lib/builder-truth-spine.mjs';

const CLI = path.join(ROOT, 'scripts', 'builder-inspector.mjs');
const VALIDATOR = path.join(ROOT, 'scripts', 'validate-canonical-run-artifacts.mjs');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-atomic-run-bundle-'));
const failures = [];
let count = 0;

function test(title, fn) {
  count += 1;
  try {
    fn();
    console.log(`PASS ${count}: ${title}`);
  } catch (error) {
    failures.push(`FAIL ${count}: ${title}: ${error.message}`);
  }
}

function runCli(args, expectedSuccess = true, env = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: false,
    env: { ...process.env, ...env }
  });
  if (expectedSuccess && (result.error || result.status !== 0)) throw new Error(result.error?.message || result.stderr || result.stdout);
  if (!expectedSuccess && result.status === 0) throw new Error(`Command unexpectedly succeeded: ${args.join(' ')}`);
  let output = null;
  try { output = JSON.parse(result.stdout); } catch { /* keep null */ }
  return { ...result, output };
}

function executeHappyFlow(mode, name) {
  const source = createSourceCase(TEMP, mode, `${name}-source`);
  const runDirectory = path.join(TEMP, `run-${name}`);
  const intake = runCli(['real-intake', mode, source.sourceArg, source.builderArg, runDirectory]).output;
  assert.equal(intake.runtime_state, 'BUILD_ACTIVE');
  assert.equal(intake.resulting_checkpoint.checkpoint_sequence, 1);
  assert.equal(intake.resulting_checkpoint.parent_checkpoint_id, null);
  for (const file of source.externalFiles) fs.rmSync(file, { force: true });
  let loaded = activeRun(runDirectory, true);
  assert.equal(loaded.current.generation, 1);
  assert.equal(loaded.current.generation_ref, 'generations/000001');
  for (const filename of ['run-manifest.json', 'runtime-context.json', 'session-state.json', 'checkpoint.json']) assert.equal(fs.existsSync(path.join(runDirectory, filename)), false);

  const emitted = runCli(['emit-batch', runDirectory]).output;
  assert.equal(emitted.runtime_state, 'WAITING_FOR_CONFIRMATION');
  loaded = activeRun(runDirectory, true);
  assert.equal(loaded.current.generation, 2);

  const confirmed = runCli(['confirm-batch', runDirectory, loaded.context.confirmation.expected_user_token]).output;
  assert.equal(confirmed.runtime_state, 'BUILD_ACTIVE');
  loaded = activeRun(runDirectory);
  assert.equal(loaded.current.generation, 3);

  const evidence = createEvidenceSources(TEMP, runDirectory, name);
  for (const file of evidence) runCli(['attach-evidence', runDirectory, file]);
  loaded = activeRun(runDirectory);
  assert.equal(loaded.checkpoint.evidence_ledger.length, evidence.length);

  const completed = runCli(['real-completion', runDirectory]).output;
  assert.equal(completed.runtime_state, 'COMPLETED');
  assert.equal(completed.builder_build_complete, true);
  assert.equal(completed.responsive_complete, false);
  assert.equal(completed.production_ready, false);
  loaded = activeRun(runDirectory, true);
  assert.equal(loaded.current.runtime_state, 'COMPLETED');
  runCli([VALIDATOR, runDirectory]);
  return { runDirectory, source, completed };
}

try {
  for (const mode of ['project-gate', 'direct-ce', 'manual-builder-input']) test(`public canonical flow preserves ${mode}`, () => executeHappyFlow(mode, `happy-${mode}`));

  test('failed Intake removes only its own stage and publishes no Run', () => {
    const source = createSourceCase(TEMP, 'manual-builder-input', 'partial-intake-source');
    const runDirectory = path.join(TEMP, 'run-partial-intake');
    const result = initializeAtomicRun({ sourceMode: source.sourceMode, builderInputFile: source.builderInputFile, runDirectory, failureInjection: 'after_successor_validation' });
    assert.equal(result.passed, false);
    assert.equal(result.failure_stage, 'after_successor_validation');
    assert.equal(fs.existsSync(runDirectory), false);
  });

  test('duplicate Run initialization preserves existing target', () => {
    const source = createSourceCase(TEMP, 'manual-builder-input', 'duplicate-source');
    const runDirectory = path.join(TEMP, 'run-duplicate');
    assert.equal(initializeAtomicRun({ sourceMode: source.sourceMode, builderInputFile: source.builderInputFile, runDirectory }).passed, true);
    const before = fs.readFileSync(path.join(runDirectory, 'CURRENT.json'), 'utf8');
    const duplicate = initializeAtomicRun({ sourceMode: source.sourceMode, builderInputFile: source.builderInputFile, runDirectory });
    assert.equal(duplicate.passed, false);
    assert.equal(duplicate.diagnostics[0].code, 'RUN_ALREADY_EXISTS');
    assert.equal(fs.readFileSync(path.join(runDirectory, 'CURRENT.json'), 'utf8'), before);
  });

  test('internal source snapshot drift blocks emit at intended diagnostic', () => {
    const source = createSourceCase(TEMP, 'manual-builder-input', 'snapshot-drift-source');
    const runDirectory = path.join(TEMP, 'run-snapshot-drift');
    assert.equal(initializeAtomicRun({ sourceMode: source.sourceMode, builderInputFile: source.builderInputFile, runDirectory }).passed, true);
    fs.appendFileSync(path.join(runDirectory, 'source', 'selected-source.json'), ' ');
    const result = emitRunBatch({ runDirectory });
    assert.equal(result.passed, false);
    assert.equal(result.diagnostics.some((entry) => entry.code === 'RUN-SNAPSHOT-002'), true);
    assert.equal(readJson(path.join(runDirectory, 'CURRENT.json')).generation, 1);
  });

  test('blocker gate prevents emit without advancing CURRENT', () => {
    const source = createSourceCase(TEMP, 'manual-builder-input', 'blocker-source');
    const runDirectory = path.join(TEMP, 'run-blocker');
    assert.equal(initializeAtomicRun({ sourceMode: source.sourceMode, builderInputFile: source.builderInputFile, runDirectory }).passed, true);
    const loaded = activeRun(runDirectory);
    const checkpointFile = path.join(loaded.generationDirectory, 'checkpoint.json');
    const sessionFile = path.join(loaded.generationDirectory, 'session-state.json');
    const checkpoint = readJson(checkpointFile);
    const session = readJson(sessionFile);
    checkpoint.unresolved_blockers = ['BLOCKER-TEST'];
    session.last_verified_checkpoint = checkpoint;
    session.unresolved_evidence = ['BLOCKER-TEST'];
    writeJson(checkpointFile, checkpoint);
    writeJson(sessionFile, session);
    const result = emitRunBatch({ runDirectory });
    assert.equal(result.passed, false);
    assert.equal(result.diagnostics.some((entry) => entry.code === 'RUN-EMIT-004'), true);
    assert.equal(readJson(path.join(runDirectory, 'CURRENT.json')).generation, 1);
  });

  test('wrong operator token reaches Confirmation token guard', () => {
    const source = createSourceCase(TEMP, 'manual-builder-input', 'wrong-token-source');
    const runDirectory = path.join(TEMP, 'run-wrong-token');
    assert.equal(initializeAtomicRun({ sourceMode: source.sourceMode, builderInputFile: source.builderInputFile, runDirectory }).passed, true);
    assert.equal(emitRunBatch({ runDirectory }).passed, true);
    const result = confirmRunBatch({ runDirectory, userToken: 'WRONG' });
    assert.equal(result.passed, false);
    assert.equal(result.diagnostics.some((entry) => entry.code === 'RUN-CONFIRM-011'), true);
    assert.equal(readJson(path.join(runDirectory, 'CURRENT.json')).generation, 2);
  });

  test('unverified Evidence reaches exact status guard', () => {
    const value = progressToConfirmed(TEMP, 'unverified-evidence');
    const loaded = activeRun(value.runDirectory);
    const file = writeJson(path.join(TEMP, 'unverified-evidence.json'), {
      schema: 'ev4-builder-evidence-source@1.0.0', evidence_type: 'diagnostic', claim_ids: ['ASSERT-UNVERIFIED'], claim_classes: ['scaffold_built'], subject_ref: 'builder-output', session_id: loaded.session.session_id, package_digest: loaded.context.canonical_package_digest, status: 'unverified'
    });
    const result = attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: file });
    assert.equal(result.passed, false);
    assert.equal(result.diagnostics.some((entry) => entry.code === 'RUN-EVIDENCE-002'), true);
  });

  test('generic subject cannot prove Action execution', () => {
    const value = progressToConfirmed(TEMP, 'generic-action');
    const loaded = activeRun(value.runDirectory);
    const actionId = loaded.context.action_batch.action_ids[0];
    const file = writeJson(path.join(TEMP, 'generic-action.json'), {
      schema: 'ev4-builder-evidence-source@1.0.0', evidence_type: 'diagnostic', claim_ids: ['ASSERT-GENERIC-ACTION'], claim_classes: ['required_action_execution'], subject_ref: 'builder-output', action_id: actionId, session_id: loaded.session.session_id, package_digest: loaded.context.canonical_package_digest, status: 'verified'
    });
    const result = attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: file });
    assert.equal(result.passed, false);
    assert.equal(result.diagnostics.some((entry) => entry.code === 'RUN-EVIDENCE-009'), true);
  });

  test('failure before CURRENT rename leaves exact predecessor active', () => {
    const source = createSourceCase(TEMP, 'manual-builder-input', 'pointer-failure-source');
    const runDirectory = path.join(TEMP, 'run-pointer-failure');
    assert.equal(initializeAtomicRun({ sourceMode: source.sourceMode, builderInputFile: source.builderInputFile, runDirectory }).passed, true);
    const result = emitRunBatch({ runDirectory, failureInjection: 'before_CURRENT_rename' });
    assert.equal(result.passed, false);
    assert.equal(result.failure_stage, 'before_CURRENT_rename');
    assert.equal(result.diagnostics[0].code, 'RUN-INJECTED-FAILURE');
    const loaded = activeRun(runDirectory);
    assert.equal(loaded.current.generation, 1);
    assert.equal(loaded.checkpoint.runtime_state, 'BUILD_ACTIVE');
  });

  test('Legacy real-authority APIs are inactive', () => {
    for (const result of [resolveRealBuilderSource({}), writeRealIntake({}), publishRealCompletion({})]) {
      assert.equal(result.passed, false);
      assert.equal(result.diagnostics[0].code, 'BUILDER-LEGACY-AUTHORITY-INACTIVE');
      assert.equal(result.builder_build_complete, false);
    }
  });

  test('Completion cannot run without full internal Evidence', () => {
    const value = progressToConfirmed(TEMP, 'incomplete-completion');
    const result = completeRun({ runDirectory: value.runDirectory });
    assert.equal(result.passed, false);
    assert.equal(result.diagnostics.some((entry) => entry.code === 'RUN-COMPLETE-EVIDENCE-007' || entry.code === 'RUN-COMPLETE-EVIDENCE-008'), true);
  });

  test('all generations remain immutable and CURRENT selects exactly one', () => {
    const value = progressToCompletable(TEMP, 'generation-history');
    const before = fs.readFileSync(path.join(value.runDirectory, 'generations', '000001', 'checkpoint.json'), 'utf8');
    assert.equal(completeRun({ runDirectory: value.runDirectory }).passed, true);
    assert.equal(fs.readFileSync(path.join(value.runDirectory, 'generations', '000001', 'checkpoint.json'), 'utf8'), before);
    const current = readJson(path.join(value.runDirectory, 'CURRENT.json'));
    assert.equal(fs.existsSync(path.join(value.runDirectory, current.generation_ref)), true);
    assert.equal(validateCanonicalRun(value.runDirectory, { fullDerivation: true }).passed, true);
  });
} finally {
  fs.rmSync(TEMP, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Atomic Run Bundle tests failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Passed ${count - failures.length}/${count} tests.`);
  process.exit(1);
}

console.log(`Atomic Run Bundle tests passed: ${count}/${count}.`);
