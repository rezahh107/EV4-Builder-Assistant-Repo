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
  inspectRunGenerations,
  recoverRunLock,
  validateCanonicalRun
} from './lib/runtime/canonical-run-runtime.mjs';
import {
  ROOT,
  activeRun,
  createEvidenceSources,
  createSourceCase,
  progressToCompletable,
  progressToConfirmed,
  progressToWaiting
} from './lib/runtime/runtime-test-fixtures.mjs';

const CLI = path.join(ROOT, 'scripts', 'builder-inspector.mjs');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-run-crash-recovery-'));
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

function createInitial(name) {
  const source = createSourceCase(TEMP, 'manual-builder-input', `${name}-source`);
  const runDirectory = path.join(TEMP, `run-${name}`);
  const result = spawnSync(process.execPath, [CLI, 'real-intake', 'manual-builder-input', '-', source.builderArg, runDirectory], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: false
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { source, runDirectory };
}

function crashCli(args, point) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, EV4_BUILDER_CRASH_POINT: point }
  });
}

function assertAuthoritativeState(runDirectory, expectedGeneration, expectedState = null) {
  assert.equal(fs.existsSync(runDirectory), true);
  assert.equal(fs.existsSync(path.join(runDirectory, 'CURRENT.json')), true);
  const loaded = validateCanonicalRun(runDirectory, { fullDerivation: true });
  assert.equal(loaded.passed, true, JSON.stringify(loaded.diagnostics));
  assert.equal(loaded.current.generation, expectedGeneration);
  if (expectedState) assert.equal(loaded.checkpoint.runtime_state, expectedState);
  return loaded;
}

function assertRecoveredFinalization(result, expectedGeneration) {
  assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
  assert.equal(result.publication_recovery, 'finalized_existing_exact_successor');
  assert.equal(result.generation_created, false);
  assert.equal(result.generation_reused, true);
  assert.equal(result.current_pointer_advanced, true);
  assert.equal(result.state_modified, true);
  assert.equal(result.generation, expectedGeneration);
}

const PREDECESSOR_POINTS = new Set([
  'after_lock_acquisition',
  'after_active_generation_load',
  'after_successor_temp_write',
  'after_successor_validation',
  'before_successor_generation_rename',
  'after_successor_generation_rename',
  'before_CURRENT_temp_write',
  'after_CURRENT_temp_write',
  'before_CURRENT_rename'
]);
const SUCCESSOR_POINTS = new Set(['after_CURRENT_rename', 'before_lock_release']);

try {
  for (const point of [...PREDECESSOR_POINTS, ...SUCCESSOR_POINTS]) {
    test(`in-process failure at ${point} leaves exactly predecessor or successor authoritative`, () => {
      const { runDirectory } = createInitial(`inject-${point}`);
      const result = emitRunBatch({ runDirectory, failureInjection: point });
      assert.equal(result.passed, false);
      assert.equal(result.failure_stage, point);
      assert.equal(result.diagnostics.some((entry) => entry.code === 'RUN-INJECTED-FAILURE'), true);
      const expectedGeneration = PREDECESSOR_POINTS.has(point) ? 1 : 2;
      const loaded = assertAuthoritativeState(runDirectory, expectedGeneration);
      assert.equal(loaded.checkpoint.runtime_state, expectedGeneration === 1 ? 'BUILD_ACTIVE' : 'WAITING_FOR_CONFIRMATION');
      const inspection = inspectRunGenerations({ runDirectory });
      assert.equal(inspection.passed, true);
      if (['after_successor_generation_rename', 'before_CURRENT_temp_write', 'after_CURRENT_temp_write', 'before_CURRENT_rename'].includes(point)) {
        assert.equal(inspection.result.orphan_generations.includes(2), true);
        assert.equal(loaded.current.generation, 1);
      }
      assert.equal(inspection.result.invalid_generations.length, 0);
    });
  }

  test('abrupt crash after successor rename is finalized by exact same-transition retry', () => {
    const { runDirectory } = createInitial('child-after-generation');
    const child = crashCli(['emit-batch', runDirectory], 'after_successor_generation_rename');
    assert.equal(child.status, 97);
    assertAuthoritativeState(runDirectory, 1, 'BUILD_ACTIVE');
    assert.equal(fs.existsSync(path.join(runDirectory, '.mutation-lock')), true);
    assert.equal(inspectRunGenerations({ runDirectory }).result.orphan_generations.includes(2), true);
    const recovery = recoverRunLock({ runDirectory });
    assert.equal(recovery.passed, true, JSON.stringify(recovery.diagnostics));
    assert.deepEqual(recovery.result.temporary_paths_removed, []);
    const retry = emitRunBatch({ runDirectory });
    assertRecoveredFinalization(retry, 2);
    assertAuthoritativeState(runDirectory, 2, 'WAITING_FOR_CONFIRMATION');
  });

  test('abrupt crash after CURRENT temporary write cleans debris then finalizes exact successor', () => {
    const { runDirectory } = createInitial('child-current-temp');
    const child = crashCli(['emit-batch', runDirectory], 'after_CURRENT_temp_write');
    assert.equal(child.status, 97);
    assertAuthoritativeState(runDirectory, 1, 'BUILD_ACTIVE');
    assert.equal(fs.readdirSync(runDirectory).some((name) => name.startsWith('CURRENT.tmp-')), true);
    const recovery = recoverRunLock({ runDirectory });
    assert.equal(recovery.passed, true, JSON.stringify(recovery.diagnostics));
    assert.equal(recovery.result.temporary_paths_removed.some((name) => name.startsWith('CURRENT.tmp-')), true);
    assert.equal(fs.readdirSync(runDirectory).some((name) => name.startsWith('CURRENT.tmp-')), false);
    const retry = emitRunBatch({ runDirectory });
    assertRecoveredFinalization(retry, 2);
  });

  test('abrupt crash after CURRENT advance replays committed emit without new generation', () => {
    const { runDirectory } = createInitial('child-after-current');
    const child = crashCli(['emit-batch', runDirectory], 'after_CURRENT_rename');
    assert.equal(child.status, 97);
    assertAuthoritativeState(runDirectory, 2, 'WAITING_FOR_CONFIRMATION');
    const recovery = recoverRunLock({ runDirectory });
    assert.equal(recovery.passed, true, JSON.stringify(recovery.diagnostics));
    const replay = emitRunBatch({ runDirectory });
    assert.equal(replay.passed, true, JSON.stringify(replay.diagnostics));
    assert.equal(replay.replayed_existing_transition, true);
    assert.equal(replay.state_modified, false);
    assertAuthoritativeState(runDirectory, 2, 'WAITING_FOR_CONFIRMATION');
  });

  test('shared publisher reconciles interrupted confirm-batch', () => {
    const value = progressToWaiting(TEMP, 'confirm-reconcile');
    const before = activeRun(value.runDirectory).current.generation;
    const token = activeRun(value.runDirectory).context.confirmation.expected_user_token;
    const child = crashCli(['confirm-batch', value.runDirectory, token], 'after_successor_generation_rename');
    assert.equal(child.status, 97);
    assert.equal(recoverRunLock({ runDirectory: value.runDirectory }).passed, true);
    const retry = confirmRunBatch({ runDirectory: value.runDirectory, userToken: token });
    assertRecoveredFinalization(retry, before + 1);
    assertAuthoritativeState(value.runDirectory, before + 1, 'BUILD_ACTIVE');
  });

  test('shared publisher reconciles interrupted attach-evidence', () => {
    const value = progressToConfirmed(TEMP, 'evidence-reconcile');
    const before = activeRun(value.runDirectory).current.generation;
    const evidence = createEvidenceSources(TEMP, value.runDirectory, 'evidence-reconcile')[0];
    const child = crashCli(['attach-evidence', value.runDirectory, evidence], 'after_successor_generation_rename');
    assert.equal(child.status, 97);
    assert.equal(recoverRunLock({ runDirectory: value.runDirectory }).passed, true);
    const retry = attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: evidence });
    assertRecoveredFinalization(retry, before + 1);
    assertAuthoritativeState(value.runDirectory, before + 1, 'BUILD_ACTIVE');
  });

  test('shared publisher reconciles interrupted real-completion', () => {
    const value = progressToCompletable(TEMP, 'completion-reconcile');
    const before = activeRun(value.runDirectory).current.generation;
    const child = crashCli(['real-completion', value.runDirectory], 'after_successor_generation_rename');
    assert.equal(child.status, 97);
    assert.equal(recoverRunLock({ runDirectory: value.runDirectory }).passed, true);
    const retry = completeRun({ runDirectory: value.runDirectory });
    assertRecoveredFinalization(retry, before + 1);
    assertAuthoritativeState(value.runDirectory, before + 1, 'COMPLETED');
  });

  test('normal loading never promotes the numerically highest orphan generation', () => {
    const { runDirectory } = createInitial('no-auto-promote');
    const result = emitRunBatch({ runDirectory, failureInjection: 'before_CURRENT_rename' });
    assert.equal(result.passed, false);
    assertAuthoritativeState(runDirectory, 1, 'BUILD_ACTIVE');
    const inspection = inspectRunGenerations({ runDirectory });
    assert.equal(inspection.result.orphan_generations.includes(2), true);
  });
} finally {
  fs.rmSync(TEMP, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Run crash-recovery tests failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Passed ${count - failures.length}/${count} tests.`);
  process.exit(1);
}

console.log(`Run crash-recovery tests passed: ${count}/${count}.`);
