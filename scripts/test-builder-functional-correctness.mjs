#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  attachRunEvidence,
  completeRun,
  confirmRunBatch,
  emitRunBatch,
  initializeAtomicRun,
  validateCanonicalRun,
  validateCanonicalSourceModeArguments
} from './lib/runtime/canonical-run-runtime.mjs';
import {
  activeRun,
  createEvidenceSources,
  createSourceCase,
  progressToConfirmed,
  readJson,
  writeJson
} from './lib/runtime/runtime-test-fixtures.mjs';

const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-builder-functional-correctness-'));
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

function code(result, expected) {
  return (result.diagnostics || []).some((entry) => entry.code === expected);
}

try {
  test('source arguments preserve all exact supported modes', () => {
    assert.equal(validateCanonicalSourceModeArguments({ sourceMode: 'project-gate', sourceArtifactFile: 'receipt.json', builderInputFile: 'builder.json' }).passed, true);
    assert.equal(validateCanonicalSourceModeArguments({ sourceMode: 'direct-ce', sourceArtifactFile: 'ce.json' }).passed, true);
    assert.equal(validateCanonicalSourceModeArguments({ sourceMode: 'manual-builder-input', builderInputFile: 'builder.json' }).passed, true);
  });

  test('direct-ce rejects unused Builder Input path', () => {
    const result = validateCanonicalSourceModeArguments({ sourceMode: 'direct-ce', sourceArtifactFile: 'ce.json', builderInputFile: 'unused.json' });
    assert.equal(result.passed, false);
    assert.equal(code(result, 'RUN-SOURCE-004'), true);
  });

  test('initial generation is sequence one with null parent', () => {
    const source = createSourceCase(TEMP, 'manual-builder-input', 'initial-source');
    const runDirectory = path.join(TEMP, 'run-initial');
    assert.equal(initializeAtomicRun({ sourceMode: source.sourceMode, builderInputFile: source.builderInputFile, runDirectory }).passed, true);
    const loaded = activeRun(runDirectory, true);
    assert.equal(loaded.current.generation, 1);
    assert.equal(loaded.checkpoint.checkpoint_sequence, 1);
    assert.equal(loaded.checkpoint.parent_checkpoint_id, null);
    assert.equal(loaded.current.runtime_state, 'BUILD_ACTIVE');
  });

  test('confirm-batch requires exact WAITING generation and token', () => {
    const source = createSourceCase(TEMP, 'manual-builder-input', 'confirm-source');
    const runDirectory = path.join(TEMP, 'run-confirm');
    assert.equal(initializeAtomicRun({ sourceMode: source.sourceMode, builderInputFile: source.builderInputFile, runDirectory }).passed, true);
    const early = confirmRunBatch({ runDirectory, userToken: 'anything' });
    assert.equal(early.passed, false);
    assert.equal(code(early, 'RUN-CONFIRM-008'), true);
    assert.equal(emitRunBatch({ runDirectory }).passed, true);
    const wrong = confirmRunBatch({ runDirectory, userToken: 'wrong' });
    assert.equal(wrong.passed, false);
    assert.equal(code(wrong, 'RUN-CONFIRM-011'), true);
    const loaded = activeRun(runDirectory);
    assert.equal(confirmRunBatch({ runDirectory, userToken: loaded.context.confirmation.expected_user_token }).passed, true);
  });

  test('Evidence exact verified status and Action subject are enforced', () => {
    const value = progressToConfirmed(TEMP, 'evidence');
    const loaded = activeRun(value.runDirectory);
    const actionId = loaded.context.action_batch.action_ids[0];
    const source = writeJson(path.join(TEMP, 'bad-evidence.json'), {
      schema: 'ev4-builder-evidence-source@1.0.0',
      evidence_type: 'diagnostic',
      claim_ids: ['ASSERT-BAD'],
      claim_classes: ['required_action_execution'],
      subject_ref: 'builder-output',
      action_id: actionId,
      session_id: loaded.session.session_id,
      package_digest: loaded.context.canonical_package_digest,
      status: 'unverified'
    });
    const result = attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: source });
    assert.equal(result.passed, false);
    assert.equal(code(result, 'RUN-EVIDENCE-002'), true);
    assert.equal(code(result, 'RUN-EVIDENCE-009'), true);
  });

  test('Completion remains blocked until every internal Evidence predicate passes', () => {
    const value = progressToConfirmed(TEMP, 'completion-blocked');
    const result = completeRun({ runDirectory: value.runDirectory });
    assert.equal(result.passed, false);
    assert.equal(code(result, 'RUN-COMPLETE-EVIDENCE-007') || code(result, 'RUN-COMPLETE-EVIDENCE-008'), true);
    assert.equal(activeRun(value.runDirectory).current.runtime_state, 'BUILD_ACTIVE');
  });

  test('valid Evidence attachments preserve exact Batch and advance generations', () => {
    const value = progressToConfirmed(TEMP, 'evidence-valid');
    const sources = createEvidenceSources(TEMP, value.runDirectory, 'evidence-valid');
    let prior = activeRun(value.runDirectory).current.generation;
    for (const file of sources) {
      const result = attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: file });
      assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
      const loaded = activeRun(value.runDirectory);
      assert.equal(loaded.current.generation, prior + 1);
      assert.equal(loaded.checkpoint.batch_id, loaded.context.action_batch.batch_id);
      prior = loaded.current.generation;
    }
    const completed = completeRun({ runDirectory: value.runDirectory });
    assert.equal(completed.passed, true, JSON.stringify(completed.diagnostics));
    assert.equal(completed.result.builder_build_complete, true);
    assert.equal(completed.result.responsive_complete, false);
    assert.equal(completed.result.production_ready, false);
    assert.equal(validateCanonicalRun(value.runDirectory, { fullDerivation: true }).passed, true);
  });

  test('published generation carriers are never accepted from top-level mutable projections', () => {
    const source = createSourceCase(TEMP, 'manual-builder-input', 'projection-source');
    const runDirectory = path.join(TEMP, 'run-projection');
    assert.equal(initializeAtomicRun({ sourceMode: source.sourceMode, builderInputFile: source.builderInputFile, runDirectory }).passed, true);
    for (const name of ['run-manifest.json', 'runtime-context.json', 'session-state.json', 'checkpoint.json']) writeJson(path.join(runDirectory, name), { malicious: true });
    const loaded = validateCanonicalRun(runDirectory, { fullDerivation: true });
    assert.equal(loaded.passed, false);
    assert.equal(code(loaded, 'RUN-LOAD-002'), true);
    assert.equal(readJson(path.join(runDirectory, 'CURRENT.json')).generation, 1);
  });
} finally {
  fs.rmSync(TEMP, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Builder functional-correctness tests failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Passed ${count - failures.length}/${count} tests.`);
  process.exit(1);
}
console.log(`Builder functional-correctness tests passed: ${count}/${count}.`);
