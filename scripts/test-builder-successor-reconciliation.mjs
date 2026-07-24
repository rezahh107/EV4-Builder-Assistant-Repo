#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { computeCanonicalDigest } from './lib/canonical-builder-package.mjs';
import {
  attachRunEvidence,
  completeRun,
  confirmRunBatch,
  emitRunBatch,
  recoverRunLock
} from './lib/runtime/canonical-run-runtime.mjs';
import {
  ROOT,
  activeRun,
  completeHappyRun,
  createEvidenceSources,
  initializeManualRun,
  progressToConfirmed,
  progressToWaiting,
  readJson,
  writeJson
} from './lib/runtime/runtime-test-fixtures.mjs';

const CLI = path.join(ROOT, 'scripts', 'builder-inspector.mjs');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-successor-reconciliation-'));
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

function hasCode(result, code) {
  return (result.diagnostics || []).some((entry) => entry.code === code);
}

function digestWithout(value, field) {
  const clone = structuredClone(value);
  delete clone[field];
  return computeCanonicalDigest(clone);
}

function orphanEmit(name, point = 'after_successor_generation_rename') {
  const value = initializeManualRun(TEMP, name);
  const result = emitRunBatch({ runDirectory: value.runDirectory, failureInjection: point });
  assert.equal(result.passed, false);
  assert.equal(activeRun(value.runDirectory).current.generation, 1);
  return value;
}

function generationFiles(runDirectory, number) {
  const directory = path.join(runDirectory, 'generations', String(number).padStart(6, '0'));
  return ['runtime-context.json', 'session-state.json', 'checkpoint.json', 'run-manifest.json'].map((name) => path.join(directory, name));
}

function snapshotFiles(files) {
  return new Map(files.map((file) => [file, {
    bytes: fs.readFileSync(file),
    mtimeMs: fs.statSync(file).mtimeMs,
    ino: fs.statSync(file).ino
  }]));
}

function assertUnchanged(snapshot) {
  for (const [file, before] of snapshot) {
    assert.equal(fs.readFileSync(file).equals(before.bytes), true, file);
    assert.equal(fs.statSync(file).mtimeMs, before.mtimeMs, file);
    assert.equal(fs.statSync(file).ino, before.ino, file);
  }
}

function mutateJson(file, mutate) {
  const value = readJson(file);
  mutate(value);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function crashCli(args, point) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, EV4_BUILDER_CRASH_POINT: point }
  });
}

try {
  test('normal publication advances CURRENT exactly once and preserves predecessor bytes', () => {
    const value = initializeManualRun(TEMP, 'normal');
    const predecessor = snapshotFiles(generationFiles(value.runDirectory, 1));
    const result = emitRunBatch({ runDirectory: value.runDirectory });
    assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
    assert.equal(result.generation_created, true);
    assert.equal(result.generation_reused, false);
    assert.equal(activeRun(value.runDirectory).current.generation, 2);
    assert.equal(fs.readdirSync(path.join(value.runDirectory, 'generations')).filter((name) => /^\d{6}$/.test(name)).length, 2);
    assertUnchanged(predecessor);
  });

  test('exact existing N+1 and auxiliary bytes are reused without rewrite', () => {
    const value = orphanEmit('exact-reuse');
    const loadedOrphan = readJson(path.join(value.runDirectory, 'generations', '000002', 'run-manifest.json'));
    const resultFile = path.join(value.runDirectory, loadedOrphan.active_emit_result_ref);
    const snapshot = snapshotFiles([...generationFiles(value.runDirectory, 2), resultFile]);
    const retry = emitRunBatch({ runDirectory: value.runDirectory });
    assert.equal(retry.passed, true, JSON.stringify(retry.diagnostics));
    assert.equal(retry.publication_recovery, 'finalized_existing_exact_successor');
    assert.equal(retry.generation_created, false);
    assert.equal(retry.generation_reused, true);
    assert.equal(activeRun(value.runDirectory).current.generation, 2);
    assertUnchanged(snapshot);
  });

  test('exact pre-existing auxiliary bytes before generation rename are accepted', () => {
    const value = orphanEmit('aux-before-generation', 'after_successor_temp_write');
    assert.equal(fs.readdirSync(path.join(value.runDirectory, 'generations')).filter((name) => /^\d{6}$/.test(name)).length, 1);
    const retry = emitRunBatch({ runDirectory: value.runDirectory });
    assert.equal(retry.passed, true, JSON.stringify(retry.diagnostics));
    assert.equal(activeRun(value.runDirectory).current.generation, 2);
  });

  test('different pre-existing auxiliary bytes block without CURRENT mutation', () => {
    const value = orphanEmit('aux-conflict', 'after_successor_temp_write');
    const transitionRoot = path.join(value.runDirectory, 'transitions', 'emit-batch');
    const transitionDirectories = fs.readdirSync(transitionRoot).filter((name) => fs.statSync(path.join(transitionRoot, name)).isDirectory());
    assert.equal(transitionDirectories.length, 1);
    const resultFile = path.join(transitionRoot, transitionDirectories[0], 'emit-batch-result.json');
    assert.equal(fs.existsSync(resultFile), true);
    mutateJson(resultFile, (result) => { result.status = 'blocked'; });
    const retry = emitRunBatch({ runDirectory: value.runDirectory });
    assert.equal(retry.passed, false);
    assert.equal(hasCode(retry, 'RUN_UNCOMMITTED_SUCCESSOR_CONFLICT'), true);
    assert.equal(activeRun(value.runDirectory).current.generation, 1);
  });

  test('different operation result bytes in N+1 are rejected', () => {
    const value = orphanEmit('result-conflict');
    const manifest = readJson(path.join(value.runDirectory, 'generations', '000002', 'run-manifest.json'));
    mutateJson(path.join(value.runDirectory, manifest.active_emit_result_ref), (result) => { result.transition_id = `EMIT-${'f'.repeat(16)}`; });
    const retry = emitRunBatch({ runDirectory: value.runDirectory });
    assert.equal(retry.passed, false);
    assert.equal(hasCode(retry, 'RUN_UNCOMMITTED_SUCCESSOR_CONFLICT'), true);
    assert.equal(activeRun(value.runDirectory).current.generation, 1);
  });

  test('wrong predecessor identity in valid N+1 is rejected', () => {
    const value = orphanEmit('predecessor-conflict');
    const file = path.join(value.runDirectory, 'generations', '000002', 'run-manifest.json');
    mutateJson(file, (manifest) => {
      manifest.generation.predecessor_checkpoint_id = 'CP-FOREIGN';
      manifest.manifest_digest = null;
      manifest.manifest_digest = digestWithout(manifest, 'manifest_digest');
    });
    const retry = emitRunBatch({ runDirectory: value.runDirectory });
    assert.equal(retry.passed, false);
    assert.equal(hasCode(retry, 'RUN_UNCOMMITTED_SUCCESSOR_CONFLICT'), true);
    assert.equal(activeRun(value.runDirectory).current.generation, 1);
  });

  test('modified Context in N+1 is never promoted', () => {
    const value = orphanEmit('context-conflict');
    mutateJson(path.join(value.runDirectory, 'generations', '000002', 'runtime-context.json'), (context) => { context.selected_candidate_id = 'FOREIGN-CANDIDATE'; });
    const retry = emitRunBatch({ runDirectory: value.runDirectory });
    assert.equal(retry.passed, false);
    assert.equal(hasCode(retry, 'RUN_UNCOMMITTED_SUCCESSOR_INCOMPLETE') || hasCode(retry, 'RUN_UNCOMMITTED_SUCCESSOR_CONFLICT'), true);
    assert.equal(activeRun(value.runDirectory).current.generation, 1);
  });

  test('incomplete N+1 is rejected without pointer advancement', () => {
    const value = orphanEmit('incomplete');
    fs.rmSync(path.join(value.runDirectory, 'generations', '000002', 'checkpoint.json'));
    const retry = emitRunBatch({ runDirectory: value.runDirectory });
    assert.equal(retry.passed, false);
    assert.equal(hasCode(retry, 'RUN_UNCOMMITTED_SUCCESSOR_INCOMPLETE'), true);
    assert.equal(activeRun(value.runDirectory).current.generation, 1);
  });

  test('multiple future generations are ambiguous and never auto-promoted', () => {
    const value = orphanEmit('ambiguous');
    fs.cpSync(path.join(value.runDirectory, 'generations', '000002'), path.join(value.runDirectory, 'generations', '000003'), { recursive: true });
    const retry = emitRunBatch({ runDirectory: value.runDirectory });
    assert.equal(retry.passed, false);
    assert.equal(hasCode(retry, 'RUN_AMBIGUOUS_FUTURE_GENERATIONS'), true);
    assert.equal(activeRun(value.runDirectory).current.generation, 1);
  });

  test('temporary generation debris is explicitly removed before retry', () => {
    const value = initializeManualRun(TEMP, 'temp-generation');
    const child = crashCli(['emit-batch', value.runDirectory], 'after_successor_temp_write');
    assert.equal(child.status, 97);
    assert.equal(fs.existsSync(path.join(value.runDirectory, '.mutation-lock')), true);
    assert.equal(fs.readdirSync(path.join(value.runDirectory, 'generations')).some((name) => name.startsWith('.tmp-')), true);
    const recovery = recoverRunLock({ runDirectory: value.runDirectory });
    assert.equal(recovery.passed, true, JSON.stringify(recovery.diagnostics));
    assert.equal(recovery.result.temporary_paths_removed.some((name) => name.startsWith('generations/.tmp-')), true);
    assert.equal(activeRun(value.runDirectory).current.generation, 1);
    assert.equal(emitRunBatch({ runDirectory: value.runDirectory }).passed, true);
  });

  test('same emit-batch replay is accepted without mutation', () => {
    const value = initializeManualRun(TEMP, 'emit-replay');
    assert.equal(emitRunBatch({ runDirectory: value.runDirectory }).passed, true);
    const before = activeRun(value.runDirectory).current.generation;
    const replay = emitRunBatch({ runDirectory: value.runDirectory });
    assert.equal(replay.passed, true, JSON.stringify(replay.diagnostics));
    assert.equal(replay.replayed_existing_transition, true);
    assert.equal(replay.state_modified, false);
    assert.equal(activeRun(value.runDirectory).current.generation, before);
  });

  test('same Confirmation token replays; different token does not', () => {
    const value = progressToWaiting(TEMP, 'confirm-replay');
    const token = activeRun(value.runDirectory).context.confirmation.expected_user_token;
    assert.equal(confirmRunBatch({ runDirectory: value.runDirectory, userToken: token }).passed, true);
    const before = activeRun(value.runDirectory).current.generation;
    const replay = confirmRunBatch({ runDirectory: value.runDirectory, userToken: token });
    assert.equal(replay.passed, true);
    assert.equal(replay.replayed_existing_transition, true);
    assert.equal(activeRun(value.runDirectory).current.generation, before);
    const different = confirmRunBatch({ runDirectory: value.runDirectory, userToken: `${token}-different` });
    assert.equal(different.passed, false);
    assert.equal(different.replayed_existing_transition, undefined);
    assert.equal(activeRun(value.runDirectory).current.generation, before);
  });

  test('identical Evidence replays; different bytes are a distinct transition', () => {
    const value = progressToConfirmed(TEMP, 'evidence-replay');
    const evidence = createEvidenceSources(TEMP, value.runDirectory, 'evidence-replay')[0];
    assert.equal(attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: evidence }).passed, true);
    const before = activeRun(value.runDirectory).current.generation;
    const replay = attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: evidence });
    assert.equal(replay.passed, true);
    assert.equal(replay.replayed_existing_transition, true);
    assert.equal(activeRun(value.runDirectory).current.generation, before);

    const changed = readJson(evidence);
    changed.claim_ids = [`${changed.claim_ids[0]}-DISTINCT`];
    const changedFile = writeJson(path.join(TEMP, 'evidence-replay-distinct.json'), changed);
    const distinct = attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: changedFile });
    assert.equal(distinct.replayed_existing_transition, undefined);
    assert.equal(distinct.passed, true, JSON.stringify(distinct.diagnostics));
    assert.equal(activeRun(value.runDirectory).current.generation, before + 1);
  });

  test('exact Completion replay returns accepted without another generation', () => {
    const value = completeHappyRun(TEMP, 'completion-replay');
    const before = activeRun(value.runDirectory).current.generation;
    const replay = completeRun({ runDirectory: value.runDirectory });
    assert.equal(replay.passed, true, JSON.stringify(replay.diagnostics));
    assert.equal(replay.replayed_existing_transition, true);
    assert.equal(replay.state_modified, false);
    assert.equal(activeRun(value.runDirectory).current.generation, before);
  });
} finally {
  fs.rmSync(TEMP, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Successor reconciliation tests failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Passed ${count - failures.length}/${count} tests.`);
  process.exit(1);
}

console.log(`Successor reconciliation tests passed: ${count}/${count}.`);
