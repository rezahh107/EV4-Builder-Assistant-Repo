#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

import {
  attachRunEvidence,
  completeRun,
  emitRunBatch,
  inspectRunGenerations,
  recoverRunLock
} from './lib/runtime/canonical-run-runtime.mjs';
import { acquireRunLock, releaseRunLock } from './lib/runtime/run-lock-ownership.mjs';
import {
  ROOT,
  activeRun,
  createEvidenceSources,
  initializeManualRun,
  progressToCompletable,
  progressToConfirmed,
  readJson,
  writeJson
} from './lib/runtime/runtime-test-fixtures.mjs';

const CLI = path.join(ROOT, 'scripts', 'builder-inspector.mjs');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-coordinated-final-repair-'));
const failures = [];
let count = 0;

function test(id, title, fn) {
  count += 1;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => console.log(`PASS ${id}: ${title}`)).catch((error) => {
        failures.push(`FAIL ${id}: ${title}: ${error.message}`);
      });
    }
    console.log(`PASS ${id}: ${title}`);
  } catch (error) {
    failures.push(`FAIL ${id}: ${title}: ${error.message}`);
  }
  return Promise.resolve();
}

function spawnCli(args, env = {}) {
  const child = spawn(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  const done = new Promise((resolve) => {
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => {
      let output = null;
      try { output = JSON.parse(stdout); } catch { /* Preserve raw output. */ }
      resolve({ status, stdout, stderr, output });
    });
  });
  return { child, done };
}

async function waitForPath(target, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(target)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${target}`);
}

function crashCli(args, point) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, EV4_BUILDER_CRASH_POINT: point }
  });
}

function sha(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function snapshotTree(root) {
  const entries = [];
  function visit(directory, relative = '') {
    for (const name of fs.readdirSync(directory).sort()) {
      if (name === '.mutation-lock' || name === '.mutation-lock-recovery' || name.startsWith('.mutation-lock.')) continue;
      const absolute = path.join(directory, name);
      const ref = relative ? `${relative}/${name}` : name;
      const stat = fs.statSync(absolute);
      if (stat.isDirectory()) {
        entries.push({ ref, kind: 'directory' });
        visit(absolute, ref);
      } else entries.push({ ref, kind: 'file', sha256: sha(fs.readFileSync(absolute)) });
    }
  }
  visit(root);
  return entries;
}

function assertReplayConflict(result) {
  assert.equal(result.passed, false);
  assert.equal(result.diagnostics.some((entry) => entry.code === 'RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT'), true, JSON.stringify(result.diagnostics));
}

function evidenceByClaim(files, claim) {
  const file = files.find((candidate) => (readJson(candidate).claim_classes || []).includes(claim));
  assert.ok(file, `Missing Evidence fixture for ${claim}`);
  return file;
}

try {
  await test('T-LOCK-LIVE-OWNER', 'live owner blocks explicit recovery without changing authority', async () => {
    const value = initializeManualRun(TEMP, 'lock-live-owner');
    const beforeCurrent = fs.readFileSync(path.join(value.runDirectory, 'CURRENT.json'));
    const running = spawnCli(['emit-batch', value.runDirectory], { EV4_BUILDER_TEST_HOLD_LOCK_MS: '800' });
    const lockDirectory = path.join(value.runDirectory, '.mutation-lock');
    await waitForPath(path.join(lockDirectory, 'lock.json'));
    const recovery = recoverRunLock({ runDirectory: value.runDirectory });
    assert.equal(recovery.passed, false);
    assert.equal(recovery.diagnostics[0].code, 'RUN-LOCK-RECOVERY-LIVE-OWNER');
    assert.equal(fs.existsSync(lockDirectory), true);
    assert.equal(fs.readFileSync(path.join(value.runDirectory, 'CURRENT.json')).equals(beforeCurrent), true);
    const completed = await running.done;
    assert.equal(completed.status, 0, completed.stderr || completed.stdout);
  });

  await test('T-LOCK-CRASHED-OWNER', 'proven-dead owner can be recovered and command retried', () => {
    const value = initializeManualRun(TEMP, 'lock-crashed-owner');
    const crashed = crashCli(['emit-batch', value.runDirectory], 'after_lock_acquisition');
    assert.equal(crashed.status, 97, crashed.stderr || crashed.stdout);
    assert.equal(activeRun(value.runDirectory).current.generation, 1);
    const recovery = recoverRunLock({ runDirectory: value.runDirectory });
    assert.equal(recovery.passed, true, JSON.stringify(recovery.diagnostics));
    const retry = emitRunBatch({ runDirectory: value.runDirectory });
    assert.equal(retry.passed, true, JSON.stringify(retry.diagnostics));
    assert.equal(activeRun(value.runDirectory).current.generation, 2);
  });

  await test('T-LOCK-ABA-RELEASE', 'old lock handle cannot remove a replacement lock', () => {
    const value = initializeManualRun(TEMP, 'lock-aba-release');
    const oldHandle = acquireRunLock(value.runDirectory, 'test-old-owner');
    assert.equal(oldHandle.passed, true);
    const displaced = `${oldHandle.lockDirectory}.test-old`;
    fs.renameSync(oldHandle.lockDirectory, displaced);
    const replacement = acquireRunLock(value.runDirectory, 'test-replacement-owner');
    assert.equal(replacement.passed, true);
    const released = releaseRunLock(oldHandle);
    assert.equal(released.released, false);
    assert.equal(fs.existsSync(replacement.lockDirectory), true);
    assert.equal(readJson(path.join(replacement.lockDirectory, 'lock.json')).lock_id, replacement.lock_id);
    assert.equal(releaseRunLock(replacement).released, true);
    fs.rmSync(displaced, { recursive: true, force: true });
  });

  await test('T-LOCK-RECOVERY-RACE', 'competing recovery attempts cannot remove a replacement lock', async () => {
    const value = initializeManualRun(TEMP, 'lock-recovery-race');
    const crashed = crashCli(['emit-batch', value.runDirectory], 'after_lock_acquisition');
    assert.equal(crashed.status, 97, crashed.stderr || crashed.stdout);
    const left = spawnCli(['recover-run-lock', value.runDirectory]);
    const right = spawnCli(['recover-run-lock', value.runDirectory]);
    const results = await Promise.all([left.done, right.done]);
    assert.equal(results.filter((entry) => entry.status === 0).length, 1, JSON.stringify(results));
    assert.equal(fs.existsSync(path.join(value.runDirectory, '.mutation-lock')), false);
    assert.equal(activeRun(value.runDirectory).current.generation, 1);
  });

  await test('T-EVIDENCE-FOREIGN-SUBJECT', 'Builder-wide foreign subjects are rejected without publication', () => {
    const value = progressToConfirmed(TEMP, 'evidence-foreign-subject');
    const sources = createEvidenceSources(TEMP, value.runDirectory, 'evidence-foreign-subject');
    for (const claim of ['layout_verified', 'export_verified']) {
      const source = readJson(evidenceByClaim(sources, claim));
      source.subject_ref = `foreign-${claim}`;
      const file = writeJson(path.join(TEMP, `foreign-${claim}.json`), source);
      const before = snapshotTree(value.runDirectory);
      const result = attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: file });
      assert.equal(result.passed, false);
      assert.equal(result.diagnostics.some((entry) => entry.code === 'RUN-EVIDENCE-017'), true, JSON.stringify(result.diagnostics));
      assert.deepEqual(snapshotTree(value.runDirectory), before);
    }
  });

  await test('T-EVIDENCE-SUBJECT-POSITIVE', 'canonical Builder and Action subjects complete successfully', () => {
    const value = progressToCompletable(TEMP, 'evidence-subject-positive');
    const completed = completeRun({ runDirectory: value.runDirectory });
    assert.equal(completed.passed, true, JSON.stringify(completed.diagnostics));
    const loaded = activeRun(value.runDirectory);
    const gate = readJson(path.join(value.runDirectory, loaded.manifest.completion_gate_ref));
    assert.equal(gate.proofs.layout_verified.subject_ref, 'builder-output');
    assert.equal(gate.proofs.export_verified.subject_ref, 'builder-output');
  });

  await test('T-EVIDENCE-ASSERTION-DRIFT', 'persisted Evidence subject drift fails closed', () => {
    const value = progressToCompletable(TEMP, 'evidence-assertion-drift');
    const loaded = activeRun(value.runDirectory);
    const ref = loaded.manifest.evidence_snapshot_refs.find((candidate) => (readJson(path.join(value.runDirectory, candidate)).claim_classes || []).includes('layout_verified'));
    const source = readJson(path.join(value.runDirectory, ref));
    source.subject_ref = 'foreign-layout-output';
    writeJson(path.join(value.runDirectory, ref), source);
    const before = snapshotTree(value.runDirectory);
    const result = completeRun({ runDirectory: value.runDirectory });
    assertReplayConflict(result);
    assert.deepEqual(snapshotTree(value.runDirectory), before);
  });

  await test('T-HISTORY-MISSING-PREDECESSOR', 'missing committed predecessor blocks the next mutation', () => {
    const value = progressToConfirmed(TEMP, 'history-missing-predecessor');
    const evidence = createEvidenceSources(TEMP, value.runDirectory, 'history-missing-predecessor')[0];
    fs.rmSync(path.join(value.runDirectory, 'generations', '000001'), { recursive: true, force: true });
    const before = snapshotTree(value.runDirectory);
    const result = attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: evidence });
    assertReplayConflict(result);
    assert.deepEqual(snapshotTree(value.runDirectory), before);
  });

  await test('T-HISTORY-TAMPERED-PREDECESSOR', 'tampered committed predecessor blocks the next mutation', () => {
    const value = progressToConfirmed(TEMP, 'history-tampered-predecessor');
    const evidence = createEvidenceSources(TEMP, value.runDirectory, 'history-tampered-predecessor')[0];
    const manifestFile = path.join(value.runDirectory, 'generations', '000001', 'run-manifest.json');
    const manifest = readJson(manifestFile);
    manifest.selected_candidate_id = 'CANDIDATE-TAMPERED';
    writeJson(manifestFile, manifest);
    const before = snapshotTree(value.runDirectory);
    const result = attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: evidence });
    assertReplayConflict(result);
    assert.deepEqual(snapshotTree(value.runDirectory), before);
  });

  await test('T-HISTORY-NONMUTATION', 'history failure creates no canonical or auxiliary path', () => {
    const value = progressToConfirmed(TEMP, 'history-nonmutation');
    const evidence = createEvidenceSources(TEMP, value.runDirectory, 'history-nonmutation')[0];
    const manifestFile = path.join(value.runDirectory, 'generations', '000001', 'run-manifest.json');
    fs.appendFileSync(manifestFile, ' ');
    const before = snapshotTree(value.runDirectory);
    const result = attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: evidence });
    assertReplayConflict(result);
    assert.deepEqual(snapshotTree(value.runDirectory), before);
  });

  await test('T-GENERATION-CLASSIFICATION', 'inspection separates history, active generation and future orphan', () => {
    const value = progressToConfirmed(TEMP, 'generation-classification');
    let inspection = inspectRunGenerations({ runDirectory: value.runDirectory });
    assert.equal(inspection.passed, true);
    assert.deepEqual(inspection.result.historical_generations, [1, 2]);
    assert.equal(inspection.result.active_generation, 3);
    assert.deepEqual(inspection.result.orphan_generations, []);
    const evidence = createEvidenceSources(TEMP, value.runDirectory, 'generation-classification')[0];
    const interrupted = attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: evidence, failureInjection: 'before_CURRENT_rename' });
    assert.equal(interrupted.passed, false);
    inspection = inspectRunGenerations({ runDirectory: value.runDirectory });
    assert.deepEqual(inspection.result.historical_generations, [1, 2]);
    assert.equal(inspection.result.active_generation, 3);
    assert.deepEqual(inspection.result.orphan_generations, [4]);
    assert.equal(inspection.result.invalid_generations.length, 0);
  });
} finally {
  fs.rmSync(TEMP, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Coordinated final repair tests failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Passed ${count - failures.length}/${count} tests.`);
  process.exit(1);
}

console.log(`Coordinated final repair tests passed: ${count}/${count}.`);
