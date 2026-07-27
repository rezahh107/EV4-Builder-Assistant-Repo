#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { emitRunBatch, confirmRunBatch } from './lib/runtime/canonical-run-runtime.mjs';
import { activeRun, initializeManualRun, progressToWaiting } from './lib/runtime/runtime-test-fixtures.mjs';

const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-replay-semantic-fields-'));
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function hasConflict(result) { return (result.diagnostics || []).some((entry) => entry.code === 'RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT'); }
function restore(run, backup) { fs.rmSync(run, { recursive: true, force: true }); fs.cpSync(backup, run, { recursive: true, preserveTimestamps: true }); }
function assertBlocked(run, beforeGeneration, invoke) {
  const beforeCurrent = fs.readFileSync(path.join(run, 'CURRENT.json'));
  const result = invoke();
  assert.equal(result.passed, false, JSON.stringify(result.diagnostics));
  assert.equal(hasConflict(result), true, JSON.stringify(result.diagnostics));
  assert.equal(result.state_modified, false);
  assert.equal(result.current_pointer_advanced, false);
  assert.equal(result.generation_created, false);
  assert.equal(activeRun(run).current.generation, beforeGeneration);
  assert.equal(fs.readFileSync(path.join(run, 'CURRENT.json')).equals(beforeCurrent), true);
}
function mutate(file, fn) { const value = readJson(file); fn(value); writeJson(file, value); }

try {
  {
    const value = initializeManualRun(TEMP, 'emit-fields');
    assert.equal(emitRunBatch({ runDirectory: value.runDirectory }).passed, true);
    const active = activeRun(value.runDirectory);
    const resultFile = path.join(value.runDirectory, active.manifest.active_emit_result_ref);
    const backup = `${value.runDirectory}.backup`;
    fs.cpSync(value.runDirectory, backup, { recursive: true, preserveTimestamps: true });
    const cases = [
      ['predecessor_checkpoint', (result) => { result.predecessor_checkpoint.checkpoint_id = 'CP-TAMPERED-PREDECESSOR'; }],
      ['resulting_checkpoint', (result) => { result.resulting_checkpoint.checkpoint_id = 'CP-TAMPERED-RESULT'; }],
      ['action_ids', (result) => { result.action_ids[0] = 'ACT-TAMPERED'; }],
      ['action_digests', (result) => { result.action_digests[result.action_ids[0]] = '0'.repeat(64); }]
    ];
    for (const [label, change] of cases) {
      restore(value.runDirectory, backup);
      mutate(resultFile, change);
      const tampered = fs.readFileSync(resultFile);
      assertBlocked(value.runDirectory, active.current.generation, () => emitRunBatch({ runDirectory: value.runDirectory }));
      assert.equal(fs.readFileSync(resultFile).equals(tampered), true, `Emit ${label} was rewritten`);
      console.log(`PASS emit ${label} exact replay conflict`);
    }
  }
  {
    const value = progressToWaiting(TEMP, 'confirm-fields');
    const token = activeRun(value.runDirectory).context.confirmation.expected_user_token;
    assert.equal(confirmRunBatch({ runDirectory: value.runDirectory, userToken: token }).passed, true);
    const active = activeRun(value.runDirectory);
    const resultFile = path.join(value.runDirectory, active.manifest.active_confirmation_result_ref);
    const receiptFile = path.join(value.runDirectory, active.manifest.active_confirmation_receipt_ref);
    const backup = `${value.runDirectory}.backup`;
    fs.cpSync(value.runDirectory, backup, { recursive: true, preserveTimestamps: true });
    const cases = [
      ['Confirmation Result identity', resultFile, (result) => { result.confirmation_id = 'CONFIRM-TAMPERED'; }],
      ['Confirmation Result Checkpoint', resultFile, (result) => { result.resulting_checkpoint.checkpoint_id = 'CP-TAMPERED'; }],
      ['Confirmation Receipt token', receiptFile, (receipt) => { receipt.operator_token = `${receipt.operator_token}-tampered`; }],
      ['Confirmation Receipt digest', receiptFile, (receipt) => { receipt.receipt_digest = '0'.repeat(64); }]
    ];
    for (const [label, file, change] of cases) {
      restore(value.runDirectory, backup);
      mutate(file, change);
      const tampered = fs.readFileSync(file);
      assertBlocked(value.runDirectory, active.current.generation, () => confirmRunBatch({ runDirectory: value.runDirectory, userToken: token }));
      assert.equal(fs.readFileSync(file).equals(tampered), true, `${label} was rewritten`);
      console.log(`PASS ${label} exact replay conflict`);
    }
  }
} finally {
  fs.rmSync(TEMP, { recursive: true, force: true });
}
console.log('Committed replay semantic field tamper tests passed.');
