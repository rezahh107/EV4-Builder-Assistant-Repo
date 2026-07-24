#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  emitRunBatch,
  inspectRunGenerations,
  recoverRunLock,
  validateCanonicalRun
} from './lib/runtime/canonical-run-runtime.mjs';
import {
  ROOT,
  createSourceCase
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

function assertAuthoritativeState(runDirectory, expectedGeneration) {
  assert.equal(fs.existsSync(runDirectory), true);
  assert.equal(fs.existsSync(path.join(runDirectory, 'CURRENT.json')), true);
  const loaded = validateCanonicalRun(runDirectory, { fullDerivation: true });
  assert.equal(loaded.passed, true, JSON.stringify(loaded.diagnostics));
  assert.equal(loaded.current.generation, expectedGeneration);
  assert.equal(fs.existsSync(path.join(runDirectory, loaded.current.generation_ref)), true);
  for (const file of ['run-manifest.json', 'runtime-context.json', 'session-state.json', 'checkpoint.json']) assert.equal(fs.existsSync(path.join(runDirectory, loaded.current.generation_ref, file)), true);
  assert.equal(fs.existsSync(path.join(runDirectory, 'generations', '000001')), true);
  return loaded;
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
    test(`in-process failure at ${point} leaves exactly predecessor or successor`, () => {
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

  test('child-process abrupt termination before CURRENT advance preserves predecessor and recoverable lock', () => {
    const { runDirectory } = createInitial('child-before-current');
    const child = spawnSync(process.execPath, [CLI, 'emit-batch', runDirectory], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: false,
      env: { ...process.env, EV4_BUILDER_CRASH_POINT: 'after_successor_generation_rename' }
    });
    assert.equal(child.status, 97);
    assertAuthoritativeState(runDirectory, 1);
    assert.equal(fs.existsSync(path.join(runDirectory, '.mutation-lock')), true);
    const inspection = inspectRunGenerations({ runDirectory });
    assert.equal(inspection.result.orphan_generations.includes(2), true);
    const recovery = recoverRunLock({ runDirectory });
    assert.equal(recovery.passed, true, JSON.stringify(recovery.diagnostics));
    assert.equal(fs.existsSync(path.join(runDirectory, '.mutation-lock')), false);
    const retry = emitRunBatch({ runDirectory });
    assert.equal(retry.passed, false);
    assert.equal(retry.diagnostics.some((entry) => /generation already exists/i.test(entry.detail || entry.message)), true);
    assertAuthoritativeState(runDirectory, 1);
  });

  test('child-process abrupt termination after CURRENT advance preserves complete successor', () => {
    const { runDirectory } = createInitial('child-after-current');
    const child = spawnSync(process.execPath, [CLI, 'emit-batch', runDirectory], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: false,
      env: { ...process.env, EV4_BUILDER_CRASH_POINT: 'after_CURRENT_rename' }
    });
    assert.equal(child.status, 97);
    const loaded = assertAuthoritativeState(runDirectory, 2);
    assert.equal(loaded.checkpoint.runtime_state, 'WAITING_FOR_CONFIRMATION');
    assert.equal(fs.existsSync(path.join(runDirectory, '.mutation-lock')), true);
    const recovery = recoverRunLock({ runDirectory });
    assert.equal(recovery.passed, true, JSON.stringify(recovery.diagnostics));
    assert.equal(fs.existsSync(path.join(runDirectory, '.mutation-lock')), false);
  });

  test('normal loading never promotes highest orphan generation', () => {
    const { runDirectory } = createInitial('no-auto-promote');
    const result = emitRunBatch({ runDirectory, failureInjection: 'before_CURRENT_rename' });
    assert.equal(result.passed, false);
    const loaded = assertAuthoritativeState(runDirectory, 1);
    assert.equal(loaded.current.generation, 1);
    const inspection = inspectRunGenerations({ runDirectory });
    assert.equal(inspection.result.orphan_generations.includes(2), true);
  });

  test('lock recovery refuses temporary CURRENT pointer state', () => {
    const { runDirectory } = createInitial('recovery-current-temp');
    fs.mkdirSync(path.join(runDirectory, '.mutation-lock'));
    fs.writeFileSync(path.join(runDirectory, 'CURRENT.tmp-test'), '{}');
    const recovery = recoverRunLock({ runDirectory });
    assert.equal(recovery.passed, false);
    assert.equal(recovery.diagnostics[0].code, 'RUN-LOCK-RECOVERY-002');
    fs.rmSync(path.join(runDirectory, 'CURRENT.tmp-test'), { force: true });
    assert.equal(recoverRunLock({ runDirectory }).passed, true);
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
