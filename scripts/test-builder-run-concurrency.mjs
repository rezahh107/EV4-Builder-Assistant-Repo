#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

import {
  attachRunEvidence,
  emitRunBatch
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
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-run-concurrency-'));
const failures = [];
let count = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnCli(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => {
      let output = null;
      try { output = JSON.parse(stdout); } catch { /* preserve raw output */ }
      resolve({ status, stdout, stderr, output });
    });
  });
}

async function contention(args, firstEnv = {}) {
  const first = spawnCli(args, { EV4_BUILDER_TEST_HOLD_LOCK_MS: '500', ...firstEnv });
  await sleep(80);
  const second = spawnCli(args);
  return Promise.all([first, second]);
}

async function test(title, fn) {
  count += 1;
  try {
    await fn();
    console.log(`PASS ${count}: ${title}`);
  } catch (error) {
    failures.push(`FAIL ${count}: ${title}: ${error.message}`);
  }
}

function assertBusy(result) {
  assert.notEqual(result.status, 0);
  assert.equal(result.output?.status, 'blocked');
  assert.equal(result.output?.blocking_diagnostics?.some((entry) => entry.code === 'RUN_BUSY_OR_STALE_LOCK'), true);
}

try {
  await test('same-path Intake race preserves exactly one complete Run', async () => {
    const source = createSourceCase(TEMP, 'manual-builder-input', 'intake-race-source');
    const runDirectory = path.join(TEMP, 'run-intake-race');
    const args = ['real-intake', 'manual-builder-input', '-', source.builderArg, runDirectory];
    const [left, right] = await Promise.all([spawnCli(args), spawnCli(args)]);
    const accepted = [left, right].filter((entry) => entry.status === 0);
    const rejected = [left, right].filter((entry) => entry.status !== 0);
    assert.equal(accepted.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(['RUN_ALREADY_EXISTS', 'RUN_BUSY_OR_STALE_LOCK'].includes(rejected[0].output?.blocking_diagnostics?.[0]?.code), true);
    const loaded = activeRun(runDirectory, true);
    assert.equal(loaded.current.generation, 1);
    assert.equal(fs.existsSync(runDirectory), true);
  });

  await test('concurrent emit-batch has one writer and one RUN_BUSY', async () => {
    const source = createSourceCase(TEMP, 'manual-builder-input', 'emit-race-source');
    const runDirectory = path.join(TEMP, 'run-emit-race');
    const intake = await spawnCli(['real-intake', 'manual-builder-input', '-', source.builderArg, runDirectory]);
    assert.equal(intake.status, 0);
    const [first, second] = await contention(['emit-batch', runDirectory]);
    assert.equal(first.status, 0);
    assertBusy(second);
    const loaded = activeRun(runDirectory, true);
    assert.equal(loaded.current.generation, 2);
    assert.equal(loaded.checkpoint.runtime_state, 'WAITING_FOR_CONFIRMATION');
  });

  await test('concurrent confirm-batch cannot create competing active Checkpoints', async () => {
    const value = progressToWaiting(TEMP, 'confirm-race');
    const token = activeRun(value.runDirectory).context.confirmation.expected_user_token;
    const [first, second] = await contention(['confirm-batch', value.runDirectory, token]);
    assert.equal(first.status, 0);
    assertBusy(second);
    const loaded = activeRun(value.runDirectory, true);
    assert.equal(loaded.current.generation, 3);
    assert.equal(loaded.checkpoint.runtime_state, 'BUILD_ACTIVE');
    assert.equal(loaded.checkpoint.confirmed_action_ids.length > 0, true);
  });

  await test('concurrent Evidence attachments never lose an accepted update', async () => {
    const value = progressToConfirmed(TEMP, 'evidence-race');
    const evidence = createEvidenceSources(TEMP, value.runDirectory, 'evidence-race');
    const [first, second] = await Promise.all([
      spawnCli(['attach-evidence', value.runDirectory, evidence[0]], { EV4_BUILDER_TEST_HOLD_LOCK_MS: '500' }),
      (async () => {
        await sleep(80);
        return spawnCli(['attach-evidence', value.runDirectory, evidence[1]]);
      })()
    ]);
    assert.equal(first.status, 0);
    assertBusy(second);
    let loaded = activeRun(value.runDirectory, true);
    assert.equal(loaded.checkpoint.evidence_ledger.length, 1);
    const retry = attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: evidence[1] });
    assert.equal(retry.passed, true, JSON.stringify(retry.diagnostics));
    loaded = activeRun(value.runDirectory, true);
    assert.equal(loaded.checkpoint.evidence_ledger.length, 2);
    assert.equal(new Set(loaded.checkpoint.evidence_ledger.map((entry) => entry.evidence_id)).size, 2);
  });

  await test('concurrent Completion has one terminal writer and no competing generation', async () => {
    const value = progressToCompletable(TEMP, 'completion-race');
    const before = activeRun(value.runDirectory).current.generation;
    const [first, second] = await contention(['real-completion', value.runDirectory]);
    assert.equal(first.status, 0);
    assertBusy(second);
    const loaded = activeRun(value.runDirectory, true);
    assert.equal(loaded.current.generation, before + 1);
    assert.equal(loaded.checkpoint.runtime_state, 'COMPLETED');
    assert.equal(loaded.current.checkpoint_id, loaded.checkpoint.checkpoint_id);
  });

  await test('mutation State is loaded only after lock acquisition', async () => {
    const source = createSourceCase(TEMP, 'manual-builder-input', 'load-order-source');
    const runDirectory = path.join(TEMP, 'run-load-order');
    const intake = await spawnCli(['real-intake', 'manual-builder-input', '-', source.builderArg, runDirectory]);
    assert.equal(intake.status, 0);
    const first = spawnCli(['emit-batch', runDirectory], { EV4_BUILDER_TEST_HOLD_LOCK_MS: '500' });
    await sleep(80);
    const direct = emitRunBatch({ runDirectory });
    assert.equal(direct.passed, false);
    assert.equal(direct.diagnostics[0].code, 'RUN_BUSY_OR_STALE_LOCK');
    const completed = await first;
    assert.equal(completed.status, 0);
    assert.equal(activeRun(runDirectory).current.generation, 2);
  });
} finally {
  fs.rmSync(TEMP, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Run concurrency tests failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Passed ${count - failures.length}/${count} tests.`);
  process.exit(1);
}

console.log(`Run concurrency tests passed: ${count}/${count}.`);
