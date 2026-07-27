#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { attachRunEvidence, completeRun, confirmRunBatch, emitRunBatch } from './lib/runtime/canonical-run-runtime.mjs';
import { preparePlanningPredecessor } from './lib/runtime/transition-planner-common.mjs';
import { planEmitTransition, planConfirmationTransition } from './lib/runtime/transition-planner-emit-confirm.mjs';
import { planEvidenceTransition } from './lib/runtime/transition-planner-evidence.mjs';
import { planCompletionTransition } from './lib/runtime/transition-planner-completion.mjs';
import { deriveExpectedSuccessorSnapshot } from './lib/runtime/run-state-store.mjs';
import { stableJson } from './lib/runtime/run-primitives.mjs';
import { activeRun, createEvidenceSources, initializeManualRun, progressToCompletable, progressToConfirmed, progressToWaiting } from './lib/runtime/runtime-test-fixtures.mjs';

const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-transition-planners-'));
const failures = [];
let count = 0;

function test(title, fn) {
  count += 1;
  try { fn(); console.log(`PASS ${count}: ${title}`); }
  catch (error) { failures.push(`FAIL ${count}: ${title}: ${error.stack || error.message}`); }
}
function snapshotTree(root) {
  const values = new Map();
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else values.set(path.relative(root, file).split(path.sep).join('/'), fs.readFileSync(file));
    }
  }
  visit(root);
  return values;
}
function assertTreeEqual(left, right) {
  assert.deepEqual([...left.keys()], [...right.keys()]);
  for (const [ref, bytes] of left) assert.equal(right.get(ref).equals(bytes), true, ref);
}
function plannerCase(operation) {
  if (operation === 'emit-batch') {
    const value = initializeManualRun(TEMP, 'planner-emit');
    return { operation, runDirectory: value.runDirectory, prepare: (loaded) => preparePlanningPredecessor(loaded, operation), plan: (predecessor) => planEmitTransition({ predecessor }), invoke: () => emitRunBatch({ runDirectory: value.runDirectory }) };
  }
  if (operation === 'confirm-batch') {
    const value = progressToWaiting(TEMP, 'planner-confirm');
    const token = activeRun(value.runDirectory).context.confirmation.expected_user_token;
    return { operation, runDirectory: value.runDirectory, prepare: (loaded) => preparePlanningPredecessor(loaded, operation), plan: (predecessor) => planConfirmationTransition({ predecessor, userToken: token }), invoke: () => confirmRunBatch({ runDirectory: value.runDirectory, userToken: token }) };
  }
  if (operation === 'attach-evidence') {
    const value = progressToConfirmed(TEMP, 'planner-evidence');
    const evidenceSourceFile = createEvidenceSources(TEMP, value.runDirectory, 'planner-evidence')[0];
    const evidenceBytes = fs.readFileSync(evidenceSourceFile);
    return { operation, runDirectory: value.runDirectory, prepare: (loaded) => preparePlanningPredecessor(loaded, operation), plan: (predecessor) => planEvidenceTransition({ predecessor, evidenceBytes }), invoke: () => attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile }) };
  }
  const value = progressToCompletable(TEMP, 'planner-completion');
  return { operation: 'real-completion', runDirectory: value.runDirectory, prepare: (loaded) => preparePlanningPredecessor(loaded, 'real-completion'), plan: (predecessor) => planCompletionTransition({ predecessor }), invoke: () => completeRun({ runDirectory: value.runDirectory }) };
}
function assertPublishedEqualsExpected(runDirectory, expected) {
  for (const [filename, bytes] of expected.generationFiles) assert.equal(fs.readFileSync(path.join(runDirectory, expected.nextRef, filename)).equals(bytes), true, `generation:${filename}`);
  for (const [ref, bytes] of expected.auxiliary) assert.equal(fs.readFileSync(path.join(runDirectory, ref)).equals(bytes), true, `auxiliary:${ref}`);
  assert.equal(fs.readFileSync(path.join(runDirectory, 'CURRENT.json')).equals(Buffer.from(stableJson(expected.pointer), 'utf8')), true, 'CURRENT.json');
}

try {
  for (const operation of ['emit-batch', 'confirm-batch', 'attach-evidence', 'real-completion']) {
    test(`${operation} pure planner preserves filesystem and predicts normal publication bytes`, () => {
      const value = plannerCase(operation);
      const loaded = activeRun(value.runDirectory);
      const before = snapshotTree(value.runDirectory);
      const predecessor = value.prepare(loaded);
      const plan = value.plan(predecessor);
      assert.equal(plan.passed, true, JSON.stringify(plan.diagnostics));
      for (const key of ['operation', 'context', 'session', 'checkpoint', 'manifestUpdates', 'result', 'auxiliaryFiles', 'refs']) assert.ok(Object.hasOwn(plan, key), `planner output missing ${key}`);
      const afterPlanning = snapshotTree(value.runDirectory);
      assertTreeEqual(before, afterPlanning);
      const expected = deriveExpectedSuccessorSnapshot({ loaded, context: plan.context, session: plan.session, checkpoint: plan.checkpoint, manifestUpdates: plan.manifestUpdates, result: plan.result, auxiliaryFiles: plan.auxiliaryFiles });
      const published = value.invoke();
      assert.equal(published.passed, true, JSON.stringify(published.diagnostics));
      assert.equal(published.generation, expected.nextNumber);
      assertPublishedEqualsExpected(value.runDirectory, expected);
    });
  }
} finally { fs.rmSync(TEMP, { recursive: true, force: true }); }

if (failures.length) {
  console.error('Transition planner preservation tests failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Passed ${count - failures.length}/${count} tests.`);
  process.exit(1);
}
console.log(`Transition planner preservation tests passed: ${count}/${count}.`);
