#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createConfirmationReceipt,
  writeConfirmationReceipt,
  validateConfirmationReceipt,
  verifyEvidenceLedger,
  resolveRealBuilderSource,
  verifyDerivedContext,
  validateRealCompletion,
  publishRealCompletion,
  writeRealIntake
} from './lib/builder-truth-spine.mjs';
import {
  attachRunEvidence,
  completeRun,
  initializeAtomicRun
} from './lib/runtime/canonical-run-runtime.mjs';
import {
  activeRun,
  initializeManualRun,
  progressToConfirmed,
  progressToCompletable,
  writeJson
} from './lib/runtime/runtime-test-fixtures.mjs';

const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-builder-authority-bypasses-'));
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

function assertInactive(result, operation) {
  assert.equal(result.passed, false, operation);
  assert.equal(result.status, 'blocked', operation);
  assert.equal(result.runtime_mode, 'fixture-validation', operation);
  assert.equal(result.runtime_state, 'NOT_A_REAL_RUN', operation);
  assert.equal(result.builder_build_complete, false, operation);
  assert.equal(result.responsive_complete, false, operation);
  assert.equal(result.production_ready, false, operation);
  assert.equal(result.diagnostics?.length, 1, operation);
  assert.equal(result.diagnostics[0].code, 'BUILDER-LEGACY-AUTHORITY-INACTIVE', operation);
}

function hasCode(result, code) {
  return (result.diagnostics || []).some((entry) => entry.code === code);
}

function rewriteActiveCheckpoint(runDirectory, mutate) {
  const loaded = activeRun(runDirectory);
  const directory = path.join(runDirectory, loaded.current.generation_ref);
  const checkpointFile = path.join(directory, 'checkpoint.json');
  const sessionFile = path.join(directory, 'session-state.json');
  const checkpoint = JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
  const session = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  mutate(checkpoint, session);
  session.last_verified_checkpoint = structuredClone(checkpoint);
  fs.writeFileSync(checkpointFile, `${JSON.stringify(checkpoint, null, 2)}\n`);
  fs.writeFileSync(sessionFile, `${JSON.stringify(session, null, 2)}\n`);
}

try {
  const legacyEntrypoints = {
    createConfirmationReceipt,
    writeConfirmationReceipt,
    validateConfirmationReceipt,
    verifyEvidenceLedger,
    resolveRealBuilderSource,
    verifyDerivedContext,
    validateRealCompletion,
    publishRealCompletion,
    writeRealIntake
  };
  for (const [name, fn] of Object.entries(legacyEntrypoints)) {
    test(`Legacy real-authority export ${name} is inactive`, () => assertInactive(fn(), name));
  }

  test('B1 unsupported manual alias cannot bypass explicit canonical Intake', () => {
    const result = initializeAtomicRun({ sourceMode: 'manual', builderInputFile: 'ignored.json', runDirectory: path.join(TEMP, 'b1') });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'RUN-SOURCE-007'), true);
    assert.equal(fs.existsSync(path.join(TEMP, 'b1')), false);
  });

  test('B2 confirmed Action arrays cannot replace canonical Confirmation', () => {
    const value = initializeManualRun(TEMP, 'b2');
    const loaded = activeRun(value.runDirectory);
    rewriteActiveCheckpoint(value.runDirectory, (checkpoint) => {
      checkpoint.confirmed_action_ids = [...loaded.context.action_batch.action_ids];
      checkpoint.unconfirmed_action_ids = [];
    });
    const result = completeRun({ runDirectory: value.runDirectory });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'RUN-COMPLETE-CONFIRM-001'), true);
  });

  test('B3 missing committed Evidence bytes cannot authorize Completion', () => {
    const value = progressToCompletable(TEMP, 'b3');
    const loaded = activeRun(value.runDirectory);
    const ref = loaded.manifest.evidence_snapshot_refs[0];
    fs.rmSync(path.join(value.runDirectory, ref));
    const result = completeRun({ runDirectory: value.runDirectory });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT'), true);
  });

  test('B4 incorrect committed Evidence hash cannot authorize Completion', () => {
    const value = progressToCompletable(TEMP, 'b4');
    rewriteActiveCheckpoint(value.runDirectory, (checkpoint) => {
      checkpoint.evidence_ledger[0].content_sha256 = 'a'.repeat(64);
    });
    const result = completeRun({ runDirectory: value.runDirectory });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT'), true);
  });

  test('B5 fixture carrier cannot become a real Run', () => {
    const source = writeJson(path.join(TEMP, 'b5-fixture-result.json'), {
      schema: 'ev4-builder-fixture-validation-result@1.0.0',
      status: 'accepted',
      runtime_mode: 'fixture-validation',
      builder_build_complete: false,
      runtime_state: 'NOT_A_REAL_RUN'
    });
    const runDirectory = path.join(TEMP, 'b5-run');
    const result = initializeAtomicRun({ sourceMode: 'manual-builder-input', builderInputFile: source, runDirectory });
    assert.equal(result.passed, false);
    assert.equal(fs.existsSync(runDirectory), false);
  });

  test('B6 caller-authored Completion booleans have no authority', () => {
    const value = progressToConfirmed(TEMP, 'b6');
    writeJson(path.join(value.runDirectory, 'outputs', 'caller', 'completion-status.json'), {
      states: { scaffold_built: true, structure_built: true, content_filled: true, desktop_layout_established: true, export_checked: true }
    });
    writeJson(path.join(value.runDirectory, 'outputs', 'caller', 'completion-gate.json'), {
      proofs: { layout_verified: { derived_status: 'confirmed' }, export_verified: { derived_status: 'confirmed' } }
    });
    const before = activeRun(value.runDirectory).current.generation;
    const result = completeRun({ runDirectory: value.runDirectory });
    assert.equal(result.passed, false);
    assert.equal(activeRun(value.runDirectory).current.generation, before);
    assert.equal(hasCode(result, 'RUN-COMPLETE-EVIDENCE-007') || hasCode(result, 'RUN-COMPLETE-EVIDENCE-008'), true);
  });

  test('B7 incompatible Evidence cannot satisfy unrelated proof classes', () => {
    const value = progressToConfirmed(TEMP, 'b7');
    const loaded = activeRun(value.runDirectory);
    const file = writeJson(path.join(TEMP, 'b7-incompatible-evidence.json'), {
      schema: 'ev4-builder-evidence-source@1.0.0',
      evidence_type: 'frontend_screenshot',
      claim_ids: ['ASSERT-INCOMPATIBLE-REUSE'],
      claim_classes: ['layout_verified', 'export_verified'],
      subject_ref: 'builder-output',
      session_id: loaded.session.session_id,
      package_digest: loaded.context.canonical_package_digest,
      status: 'verified'
    });
    const result = attachRunEvidence({ runDirectory: value.runDirectory, evidenceSourceFile: file });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'RUN-EVIDENCE-004') || hasCode(result, 'RUN-EVIDENCE-007'), true);
  });
} finally {
  fs.rmSync(TEMP, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Builder authority bypass regression tests failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Passed ${count - failures.length}/${count} tests.`);
  process.exit(1);
}

console.log(`Builder authority bypass regression tests passed: ${count}/${count}.`);
