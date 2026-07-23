#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildIntakeCapsule,
  validateCompletionTransition,
  verifyBuilderInput
} from './lib/builder-runtime-transition.mjs';
import { resolveRealBuilderSource } from './lib/builder-truth-spine.mjs';

const ROOT = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-builder-bypass-reproduction-'));
const fixture = (...parts) => path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', ...parts);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (name, value) => {
  const file = path.join(temp, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
};
const clone = (value) => structuredClone(value);

function prepareLegacyCase(name, mutate = () => {}) {
  const sourceFile = fixture('builder_context_package.json');
  const capsule = buildIntakeCapsule(sourceFile);
  assert.equal(capsule.result.status, 'accepted', JSON.stringify(capsule.diagnostics));
  const capsuleFile = writeJson(`${name}/legacy-intake-result.json`, capsule.result);

  const checkpoint = readJson(fixture('checkpoint_final.json'));
  checkpoint.runtime_state = 'BUILD_ACTIVE';
  checkpoint.checkpoint_id = `${name}-CP-001`;
  checkpoint.checkpoint_sequence = 2;
  checkpoint.parent_checkpoint_id = `${name}-CP-000`;
  checkpoint.confirmed_action_ids = ['BATCH-001-A01'];
  checkpoint.unconfirmed_action_ids = [];
  checkpoint.unresolved_blockers = [];

  const session = readJson(fixture('session_state_final.json'));
  session.workflow_mode = 'APPROVED_HANDOFF_MODE';
  session.runtime_state = 'BUILD_ACTIVE';
  session.current_state = 'BUILD_ACTIVE';
  session.unresolved_evidence = [];
  delete session.resume_target;

  const status = readJson(fixture('completion_status.json'));
  const gate = readJson(fixture('completion_gate.json'));
  gate.package_digest = session.package_digest;
  gate.session_id = session.session_id;
  gate.checkpoint_id = checkpoint.checkpoint_id;
  gate.checkpoint_sequence = checkpoint.checkpoint_sequence;

  mutate({ sourceFile, capsuleFile, session, checkpoint, status, gate });
  session.last_verified_checkpoint = clone(checkpoint);

  const sessionFile = writeJson(`${name}/session.json`, session);
  const checkpointFile = writeJson(`${name}/checkpoint.json`, checkpoint);
  const statusFile = writeJson(`${name}/completion-status.json`, status);
  const gateFile = writeJson(`${name}/completion-gate.json`, gate);

  const result = validateCompletionTransition({
    sourceFile,
    capsuleFile,
    sessionFile,
    checkpointFile,
    statusFile,
    gateFile
  });
  return { result, sourceFile, capsuleFile, session, checkpoint, status, gate };
}

const report = [];

function reproduce(id, title, execute, authorityEffect, postRepairTest) {
  const value = execute();
  assert.equal(value.passed, true, `${id} was not reproduced: ${JSON.stringify(value.diagnostics || value)}`);
  report.push({
    test_id: id,
    title,
    input_mode: 'legacy_normal_runtime_path',
    validation_result: 'accepted',
    authority_effect_reached: authorityEffect,
    classification: 'AUTHORITY_BYPASS_CONFIRMED',
    post_repair_regression_test: postRepairTest
  });
}

try {
  reproduce(
    'B1',
    'manual or synthetic Builder Input admission',
    () => {
      const sourceFile = fixture('builder_context_package.json');
      const verification = verifyBuilderInput(sourceFile);
      const manualSourceResolution = resolveRealBuilderSource({
        sourceKind: 'manual',
        sourceArtifactFile: sourceFile,
        builderInputFile: sourceFile
      });
      assert.equal(manualSourceResolution.passed, false, 'Post-repair real source resolver unexpectedly accepted manual source.');
      return verification;
    },
    'legacy intake accepted an internally consistent caller-controlled package without upstream provenance',
    'truth-spine tests 1, 2, 6, 7'
  );

  reproduce(
    'B2',
    'Checkpoint confirmation without Confirmation Receipt',
    () => prepareLegacyCase('B2').result,
    'legacy Completion accepted confirmed_action_ids although no Receipt input existed',
    'truth-spine tests 13-20'
  );

  reproduce(
    'B3',
    'nonexistent Evidence source',
    () => prepareLegacyCase('B3', ({ checkpoint }) => {
      checkpoint.evidence_ledger[0].source_ref = 'path-that-does-not-exist.json';
      checkpoint.evidence_ledger[0].content_sha256 = 'a'.repeat(64);
    }).result,
    'legacy Completion accepted Evidence metadata without resolving source_ref',
    'truth-spine test 21'
  );

  reproduce(
    'B4',
    'wrong Evidence content hash',
    () => prepareLegacyCase('B4', ({ checkpoint }) => {
      checkpoint.evidence_ledger[0].content_sha256 = 'a'.repeat(64);
    }).result,
    'legacy Completion accepted a declared hash without recomputing source bytes',
    'truth-spine tests 22 and 23'
  );

  reproduce(
    'B5',
    'synthetic Evidence reaches legacy Completion authorization',
    () => {
      const trace = readJson(fixture('execution-trace.json'));
      assert.equal(trace.fixture_classification, 'synthetic_validation_only');
      return prepareLegacyCase('B5').result;
    },
    'legacy Completion authorized the official synthetic transaction fixture',
    'truth-spine tests 8-12 and 24'
  );

  reproduce(
    'B6',
    'caller-authored Completion Status booleans',
    () => prepareLegacyCase('B6', ({ status }) => {
      status.states.scaffold_built = true;
      status.states.structure_built = true;
      status.states.content_filled = true;
      status.states.desktop_layout_established = true;
      status.states.export_checked = true;
      status.evidence.export = true;
    }).result,
    'legacy Completion consumed caller-authored true values as terminal predicates',
    'truth-spine tests 32 and 34'
  );

  reproduce(
    'B7',
    'incompatible proof reuse',
    () => prepareLegacyCase('B7', ({ gate }) => {
      gate.proofs.layout_verified.status = 'confirmed';
      gate.proofs.export_verified.status = 'confirmed';
      gate.proofs.layout_verified.evidence_refs = ['EV-BATCH-001-A01'];
      gate.proofs.export_verified.evidence_refs = ['EV-BATCH-001-A01'];
    }).result,
    'legacy Completion accepted one Evidence ID for unrelated layout and export proofs',
    'truth-spine tests 29, 30, 33 and 35'
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log(JSON.stringify({
  schema: 'ev4-builder-authority-bypass-reproduction@1.0.0',
  reproduced: report.length,
  expected: 7,
  results: report
}, null, 2));
