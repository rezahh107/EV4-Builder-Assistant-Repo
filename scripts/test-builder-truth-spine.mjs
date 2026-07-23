#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  computeCanonicalDigest,
  computePackageDigest,
  sha256Bytes
} from './lib/canonical-builder-package.mjs';
import {
  buildIntakeCapsule,
  validateResumeTransition,
  verifyIntakeCapsule,
  verifyRuntimeIdentity
} from './lib/builder-runtime-transition.mjs';
import {
  createConfirmationReceipt,
  fixtureValidateBuilderInput,
  publishRealCompletion,
  resolveRealBuilderSource,
  validateConfirmationReceipt,
  validateRealCompletion,
  verifyDerivedContext,
  verifyEvidenceLedger
} from './lib/builder-truth-spine.mjs';

const ROOT = process.cwd();
const BASE_PACKAGE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'builder_context_package.json');
const BASE_SESSION = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'session_state_final.json');
const BASE_CHECKPOINT = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'checkpoint_final.json');
const CE_SOURCE = path.join(ROOT, 'tests', 'valid', 'ce_builder_package_adapter_valid.json');
const temp = fs.mkdtempSync(path.join(ROOT, '.tmp-builder-truth-spine-'));
const failures = [];
const passed = [];

const clone = (value) => structuredClone(value);
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const rel = (file) => path.relative(ROOT, file);
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return rel(file);
};
const rewrite = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const hasCode = (result, code) => (result.diagnostics || []).some((item) => item.code === code);

function test(id, title, fn) {
  try {
    fn();
    passed.push({ id, title });
  } catch (error) {
    failures.push(`${id} ${title}: ${error.message}`);
  }
}

function cleanBuilderPackage() {
  const pkg = read(BASE_PACKAGE);
  for (const entry of pkg.source_payload_ledger || []) entry.source_ref = `producer-artifact:${entry.payload_name}`;
  pkg.input_authorization.package_digest.value = computePackageDigest(pkg);
  return pkg;
}

function evidenceSource({ evidenceType, claimIds, claimClasses, subjectRef, sessionId, packageDigest, actionId = null }) {
  return {
    schema: 'ev4-builder-evidence-source@1.0.0',
    evidence_type: evidenceType,
    claim_ids: claimIds,
    claim_classes: claimClasses,
    subject_ref: subjectRef,
    session_id: sessionId,
    package_digest: packageDigest,
    ...(actionId ? { action_id: actionId } : {}),
    status: 'verified'
  };
}

function createCase(name) {
  const dir = path.join(temp, name);
  fs.mkdirSync(dir, { recursive: true });
  const pkg = cleanBuilderPackage();
  const builderFile = path.join(dir, 'builder-input.json');
  write(builderFile, pkg);
  const builderBytes = fs.readFileSync(builderFile);
  const receipt = {
    schema: 'ev4-project-gate-c2b-receipt@1.0.0',
    receipt_id: `PG-${name}`,
    producer_repository: 'rezahh107/EV4-Project-Gate',
    producer_commit_sha: 'a'.repeat(40),
    selected_candidate_id: pkg.selected_candidate_id,
    source_file_sha256: sha256Bytes(builderBytes),
    canonical_package_digest: computePackageDigest(pkg)
  };
  const sourceFile = path.join(dir, 'project-gate-receipt.json');
  write(sourceFile, receipt);
  const resolution = resolveRealBuilderSource({ sourceKind: 'project-gate', sourceArtifactFile: rel(sourceFile), builderInputFile: rel(builderFile) });
  assert.equal(resolution.passed, true, JSON.stringify(resolution.diagnostics));
  const context = resolution.context;
  const contextFile = path.join(dir, 'verified-context.json');
  write(contextFile, context);

  const checkpoint = read(BASE_CHECKPOINT);
  checkpoint.checkpoint_id = `${name}-CP-001`;
  checkpoint.checkpoint_sequence = 2;
  checkpoint.parent_checkpoint_id = `${name}-CP-000`;
  checkpoint.package_id = rel(builderFile);
  checkpoint.package_sha256 = context.canonical_package_digest;
  checkpoint.package_digest = context.canonical_package_digest;
  checkpoint.selected_candidate_id = context.selected_candidate_id;
  checkpoint.workflow_mode = 'APPROVED_HANDOFF_MODE';
  checkpoint.runtime_state = 'BUILD_ACTIVE';
  checkpoint.batch_id = context.action_batch.batch_id;
  checkpoint.confirmed_action_ids = [...context.action_batch.action_ids];
  checkpoint.unconfirmed_action_ids = [];
  checkpoint.unresolved_blockers = [];
  checkpoint.created_from = 'export_json';

  const assertions = [];
  const ledger = [];
  const sources = {};
  const addEvidence = (id, evidenceType, assertionId, subjectRef, claimClasses, actionId = null) => {
    const source = evidenceSource({
      evidenceType,
      claimIds: [assertionId],
      claimClasses,
      subjectRef,
      sessionId: 'SESSION-001',
      packageDigest: context.canonical_package_digest,
      actionId
    });
    const sourceFilePath = path.join(dir, `${id}.json`);
    write(sourceFilePath, source);
    assertions.push({
      assertion_id: assertionId,
      subject_ref: subjectRef,
      claim: assertionId,
      status: 'confirmed',
      evidence_refs: [id]
    });
    ledger.push({
      evidence_id: id,
      evidence_type: evidenceType,
      source_ref: rel(sourceFilePath),
      captured_at: '2026-07-23T12:00:00Z',
      content_sha256: sha256Bytes(fs.readFileSync(sourceFilePath)),
      supports_claim_ids: [assertionId],
      status: 'available'
    });
    sources[id] = { file: sourceFilePath, value: source };
  };

  for (const actionId of context.action_batch.action_ids) {
    addEvidence(`EV-ACTION-${actionId}`, 'diagnostic', `ASSERT-ACTION-${actionId}`, actionId, ['required_action_execution'], actionId);
  }
  addEvidence('EV-SCAFFOLD', 'diagnostic', 'ASSERT-SCAFFOLD', 'builder-output', ['scaffold_built']);
  addEvidence('EV-STRUCTURE', 'structure_panel_screenshot', 'ASSERT-STRUCTURE', 'builder-output', ['structure_built']);
  addEvidence('EV-CONTENT', 'editor_screenshot', 'ASSERT-CONTENT', 'builder-output', ['content_filled']);
  addEvidence('EV-LAYOUT', 'frontend_screenshot', 'ASSERT-LAYOUT', 'builder-output', ['desktop_layout_established', 'layout_verified']);
  addEvidence('EV-EXPORT', 'export_json', 'ASSERT-EXPORT', 'builder-output', ['export_checked', 'export_verified']);
  checkpoint.assertions = assertions;
  checkpoint.evidence_ledger = ledger;

  const session = read(BASE_SESSION);
  session.package_digest = context.canonical_package_digest;
  session.selected_candidate_id = context.selected_candidate_id;
  session.workflow_mode = 'APPROVED_HANDOFF_MODE';
  session.runtime_state = 'BUILD_ACTIVE';
  session.current_state = 'BUILD_ACTIVE';
  session.unresolved_evidence = [];
  delete session.resume_target;
  session.last_verified_checkpoint = checkpoint;

  const sessionFile = path.join(dir, 'session-state.json');
  const checkpointFile = path.join(dir, 'checkpoint.json');
  write(sessionFile, session);
  write(checkpointFile, checkpoint);

  const confirmation = createConfirmationReceipt({
    contextFile: rel(contextFile),
    sessionFile: rel(sessionFile),
    checkpointFile: rel(checkpointFile),
    userToken: context.confirmation.expected_user_token
  });
  assert.equal(confirmation.passed, true, JSON.stringify(confirmation.diagnostics));
  const confirmationFile = path.join(dir, 'confirmation-receipt.json');
  write(confirmationFile, confirmation.receipt);

  return {
    dir,
    pkg,
    receipt,
    context,
    session,
    checkpoint,
    sources,
    builderFile,
    sourceFile,
    contextFile,
    sessionFile,
    checkpointFile,
    confirmationFile,
    confirmation: confirmation.receipt,
    options(output = path.join(dir, 'completion-output')) {
      return {
        sourceKind: 'project-gate',
        sourceArtifactFile: rel(sourceFile),
        builderInputFile: rel(builderFile),
        contextFile: rel(contextFile),
        sessionFile: rel(sessionFile),
        checkpointFile: rel(checkpointFile),
        confirmationReceiptFile: rel(confirmationFile),
        outputDirectory: rel(output)
      };
    },
    syncState() {
      this.session.last_verified_checkpoint = this.checkpoint;
      rewrite(this.sessionFile, this.session);
      rewrite(this.checkpointFile, this.checkpoint);
    },
    syncReceipt(recompute = false) {
      if (recompute) {
        const copy = clone(this.confirmation);
        delete copy.receipt_digest;
        this.confirmation.receipt_digest = computeCanonicalDigest(copy);
      }
      rewrite(this.confirmationFile, this.confirmation);
    },
    syncContext(recompute = false) {
      if (recompute) {
        const copy = clone(this.context);
        delete copy.context_digest;
        this.context.context_digest = computeCanonicalDigest(copy);
      }
      rewrite(this.contextFile, this.context);
    },
    syncEvidence(id, recomputeRecordHash = false) {
      rewrite(this.sources[id].file, this.sources[id].value);
      if (recomputeRecordHash) {
        const record = this.checkpoint.evidence_ledger.find((entry) => entry.evidence_id === id);
        record.content_sha256 = sha256Bytes(fs.readFileSync(this.sources[id].file));
        this.syncState();
      }
    }
  };
}

function completion(caseData) {
  return validateRealCompletion(caseData.options());
}

try {
  test(1, 'manual Builder Input cannot authorize a real run', () => {
    const pkgFile = path.join(temp, 'manual-input.json');
    write(pkgFile, cleanBuilderPackage());
    const result = resolveRealBuilderSource({ sourceKind: 'manual', sourceArtifactFile: rel(pkgFile), builderInputFile: rel(pkgFile) });
    assert.equal(result.passed, false);
  });

  test(2, 'fixture source cannot enter real-builder-run', () => {
    const dir = path.join(temp, 'fixture-real-rejection');
    fs.mkdirSync(dir, { recursive: true });
    const pkg = read(BASE_PACKAGE);
    const builder = path.join(dir, 'builder.json');
    write(builder, pkg);
    const receipt = path.join(dir, 'receipt.json');
    write(receipt, {
      schema: 'ev4-project-gate-c2b-receipt@1.0.0',
      source_file_sha256: sha256Bytes(fs.readFileSync(builder)),
      canonical_package_digest: computePackageDigest(pkg)
    });
    const result = resolveRealBuilderSource({ sourceKind: 'project-gate', sourceArtifactFile: rel(receipt), builderInputFile: rel(builder) });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'BUILDER-SOURCE-007') || hasCode(result, 'BUILDER-SOURCE-013'), true);
  });

  test(3, 'Project Gate source artifact with wrong hash is rejected', () => {
    const c = createCase('pg-wrong-hash');
    c.receipt.source_file_sha256 = '0'.repeat(64);
    rewrite(c.sourceFile, c.receipt);
    const result = resolveRealBuilderSource({ sourceKind: 'project-gate', sourceArtifactFile: rel(c.sourceFile), builderInputFile: rel(c.builderFile) });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'BUILDER-SOURCE-005'), true);
  });

  test(4, 'CE source package with wrong hash is rejected', () => {
    const wrapper = read(CE_SOURCE);
    wrapper.content_sha256 = '0'.repeat(64);
    const file = path.join(temp, 'ce-wrong-hash.json');
    write(file, wrapper);
    const result = resolveRealBuilderSource({ sourceKind: 'direct-ce', sourceArtifactFile: rel(file) });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'BUILDER-SOURCE-009'), true);
  });

  test(5, 'source artifact Candidate mismatch is rejected by fresh Context comparison', () => {
    const c = createCase('candidate-mismatch');
    c.context.selected_candidate_id = 'FOREIGN-CANDIDATE';
    c.syncContext(true);
    const result = verifyDerivedContext({ sourceKind: 'project-gate', sourceArtifactFile: rel(c.sourceFile), builderInputFile: rel(c.builderFile), contextFile: rel(c.contextFile) });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'BUILDER-CONTEXT-007'), true);
  });

  test(6, 'internally consistent manual input_authorization is insufficient', () => {
    const file = path.join(temp, 'manual-authorized.json');
    write(file, cleanBuilderPackage());
    assert.equal(fixtureValidateBuilderInput(rel(file)).status, 'accepted');
    const result = resolveRealBuilderSource({ sourceKind: 'manual', sourceArtifactFile: rel(file), builderInputFile: rel(file) });
    assert.equal(result.passed, false);
  });

  test(7, 'valid source-bound upstream artifact creates Runtime-owned Builder Context', () => {
    const c = createCase('valid-context');
    assert.equal(c.context.runtime_mode, 'real-builder-run');
    assert.equal(c.context.verification_status, 'verified_source_bound');
  });

  test(8, 'fixture-validation may report would_complete=true', () => {
    const file = path.join(temp, 'fixture-pass.json');
    write(file, cleanBuilderPackage());
    assert.equal(fixtureValidateBuilderInput(rel(file)).would_complete, true);
  });

  test(9, 'fixture-validation always keeps builder_build_complete=false', () => {
    const file = path.join(temp, 'fixture-no-build.json');
    write(file, cleanBuilderPackage());
    assert.equal(fixtureValidateBuilderInput(rel(file)).builder_build_complete, false);
  });

  test(10, 'fixture-validation cannot produce runtime_state=COMPLETED', () => {
    const file = path.join(temp, 'fixture-not-real.json');
    write(file, cleanBuilderPackage());
    assert.equal(fixtureValidateBuilderInput(rel(file)).runtime_state, 'NOT_A_REAL_RUN');
  });

  test(11, 'real-builder-run rejects nested synthetic indicators', () => {
    const c = createCase('nested-synthetic');
    c.pkg.deep = { fixture_classification: 'synthetic_validation_only' };
    c.pkg.input_authorization.package_digest.value = computePackageDigest(c.pkg);
    rewrite(c.builderFile, c.pkg);
    c.receipt.source_file_sha256 = sha256Bytes(fs.readFileSync(c.builderFile));
    c.receipt.canonical_package_digest = computePackageDigest(c.pkg);
    rewrite(c.sourceFile, c.receipt);
    const result = resolveRealBuilderSource({ sourceKind: 'project-gate', sourceArtifactFile: rel(c.sourceFile), builderInputFile: rel(c.builderFile) });
    assert.equal(result.passed, false);
  });

  test(12, 'caller cannot change authoritative runtime mode through JSON', () => {
    const c = createCase('mode-mutation');
    c.context.runtime_mode = 'fixture-validation';
    c.syncContext(true);
    const result = verifyDerivedContext({ sourceKind: 'project-gate', sourceArtifactFile: rel(c.sourceFile), builderInputFile: rel(c.builderFile), contextFile: rel(c.contextFile) });
    assert.equal(result.passed, false);
  });

  test(13, 'confirmed_action_ids without Confirmation Receipt is rejected', () => {
    const c = createCase('missing-receipt');
    c.confirmationFile = path.join(c.dir, 'absent.json');
    assert.equal(completion(c).passed, false);
  });

  test(14, 'missing user token is rejected', () => {
    const c = createCase('missing-token');
    const result = createConfirmationReceipt({ contextFile: rel(c.contextFile), sessionFile: rel(c.sessionFile), checkpointFile: rel(c.checkpointFile), userToken: '' });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'BUILDER-CONFIRM-003'), true);
  });

  test(15, 'wrong user token is rejected', () => {
    const c = createCase('wrong-token');
    const result = createConfirmationReceipt({ contextFile: rel(c.contextFile), sessionFile: rel(c.sessionFile), checkpointFile: rel(c.checkpointFile), userToken: 'تایید BATCH-999' });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'BUILDER-CONFIRM-004'), true);
  });

  test(16, 'Confirmation Receipt bound to another Session is rejected', () => {
    const c = createCase('receipt-session');
    c.confirmation.session_id = 'SESSION-FOREIGN';
    c.syncReceipt(true);
    assert.equal(completion(c).passed, false);
  });

  test(17, 'Confirmation Receipt bound to another Package is rejected', () => {
    const c = createCase('receipt-package');
    c.confirmation.package_digest = '0'.repeat(64);
    c.syncReceipt(true);
    assert.equal(completion(c).passed, false);
  });

  test(18, 'Confirmation Receipt bound to another Batch is rejected', () => {
    const c = createCase('receipt-batch');
    c.confirmation.batch_id = 'BATCH-FOREIGN';
    c.syncReceipt(true);
    assert.equal(completion(c).passed, false);
  });

  test(19, 'modified Action body invalidates Action digest binding', () => {
    const c = createCase('action-digest');
    c.context.action_batch.action_digests[c.context.action_batch.action_ids[0]] = '0'.repeat(64);
    c.syncContext(true);
    const result = validateConfirmationReceipt({ receiptFile: rel(c.confirmationFile), context: c.context, session: c.session, checkpoint: c.checkpoint });
    assert.equal(result.passed, false);
  });

  test(20, 'valid Confirmation Receipt authorizes exact Action set', () => {
    const c = createCase('valid-confirmation');
    const result = validateConfirmationReceipt({ receiptFile: rel(c.confirmationFile), context: c.context, session: c.session, checkpoint: c.checkpoint });
    assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
  });

  test(21, 'nonexistent Evidence source is rejected', () => {
    const c = createCase('evidence-missing');
    c.checkpoint.evidence_ledger[0].source_ref = rel(path.join(c.dir, 'missing.json'));
    c.syncState();
    assert.equal(completion(c).passed, false);
  });

  test(22, 'incorrect content_sha256 is rejected', () => {
    const c = createCase('evidence-wrong-hash');
    c.checkpoint.evidence_ledger[0].content_sha256 = '0'.repeat(64);
    c.syncState();
    assert.equal(completion(c).passed, false);
  });

  test(23, 'modified Evidence bytes are rejected', () => {
    const c = createCase('evidence-mutated');
    fs.appendFileSync(c.sources['EV-SCAFFOLD'].file, ' ');
    assert.equal(completion(c).passed, false);
  });

  test(24, 'synthetic execution Evidence is rejected in real mode', () => {
    const c = createCase('evidence-synthetic');
    c.sources['EV-SCAFFOLD'].value.fixture_classification = 'synthetic_validation_only';
    c.syncEvidence('EV-SCAFFOLD', true);
    assert.equal(completion(c).passed, false);
  });

  test(25, 'Evidence bound to another Session is rejected', () => {
    const c = createCase('evidence-session');
    c.sources['EV-SCAFFOLD'].value.session_id = 'SESSION-FOREIGN';
    c.syncEvidence('EV-SCAFFOLD', true);
    assert.equal(completion(c).passed, false);
  });

  test(26, 'Evidence bound to another Package is rejected', () => {
    const c = createCase('evidence-package');
    c.sources['EV-SCAFFOLD'].value.package_digest = '0'.repeat(64);
    c.syncEvidence('EV-SCAFFOLD', true);
    assert.equal(completion(c).passed, false);
  });

  test(27, 'Evidence bound to another Action is rejected', () => {
    const c = createCase('evidence-action');
    const id = `EV-ACTION-${c.context.action_batch.action_ids[0]}`;
    c.sources[id].value.action_id = 'BATCH-FOREIGN-A01';
    c.syncEvidence(id, true);
    assert.equal(completion(c).passed, false);
  });

  test(28, 'Evidence bound to another subject is rejected', () => {
    const c = createCase('evidence-subject');
    c.sources['EV-SCAFFOLD'].value.subject_ref = 'foreign-output';
    c.syncEvidence('EV-SCAFFOLD', true);
    assert.equal(completion(c).passed, false);
  });

  test(29, 'unsupported Evidence type cannot satisfy a claim', () => {
    const c = createCase('evidence-type');
    c.sources['EV-STRUCTURE'].value.evidence_type = 'export_json';
    c.checkpoint.evidence_ledger.find((entry) => entry.evidence_id === 'EV-STRUCTURE').evidence_type = 'export_json';
    c.syncEvidence('EV-STRUCTURE', true);
    assert.equal(completion(c).passed, false);
  });

  test(30, 'one Evidence item cannot satisfy incompatible proof classes', () => {
    const c = createCase('evidence-reuse');
    c.sources['EV-LAYOUT'].value.claim_classes = ['layout_verified', 'export_verified'];
    c.syncEvidence('EV-LAYOUT', true);
    assert.equal(completion(c).passed, false);
  });

  test(31, 'valid source-bound Evidence is accepted', () => {
    const c = createCase('valid-evidence');
    const result = verifyEvidenceLedger({ checkpoint: c.checkpoint, checkpointFile: rel(c.checkpointFile), context: c.context, session: c.session });
    assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
  });

  test(32, 'caller-authored Completion Booleans cannot force Completion', () => {
    const c = createCase('caller-status');
    c.checkpoint.assertions = c.checkpoint.assertions.filter((entry) => entry.assertion_id !== 'ASSERT-EXPORT');
    c.checkpoint.evidence_ledger = c.checkpoint.evidence_ledger.filter((entry) => entry.evidence_id !== 'EV-EXPORT');
    c.syncState();
    write(path.join(c.dir, 'caller-status.json'), { states: { scaffold_built: true, structure_built: true, content_filled: true, desktop_layout_established: true, export_checked: true } });
    assert.equal(completion(c).passed, false);
  });

  test(33, 'caller-authored proof status=confirmed cannot force Completion', () => {
    const c = createCase('caller-gate');
    c.checkpoint.assertions = c.checkpoint.assertions.filter((entry) => entry.assertion_id !== 'ASSERT-LAYOUT');
    c.checkpoint.evidence_ledger = c.checkpoint.evidence_ledger.filter((entry) => entry.evidence_id !== 'EV-LAYOUT');
    c.syncState();
    write(path.join(c.dir, 'caller-gate.json'), { proofs: { layout_verified: { status: 'confirmed' }, export_verified: { status: 'confirmed' } } });
    assert.equal(completion(c).passed, false);
  });

  test(34, 'Completion Status is Runtime-derived', () => {
    const c = createCase('derived-status');
    const result = publishRealCompletion(c.options());
    assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
    const status = read(path.join(c.dir, 'completion-output', 'completion-status.json'));
    assert.equal(status.schema, 'ev4-builder-derived-completion-status@1.0.0');
    assert.equal(Object.values(status.states).every(Boolean), true);
  });

  test(35, 'Completion Gate is Runtime-derived', () => {
    const c = createCase('derived-gate');
    const result = publishRealCompletion(c.options());
    assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
    const gate = read(path.join(c.dir, 'completion-output', 'completion-gate.json'));
    assert.equal(gate.schema, 'ev4-builder-derived-completion-gate@1.0.0');
    assert.equal(Object.values(gate.proofs).every((proof) => proof.derived_status === 'confirmed'), true);
  });

  test(36, 'unresolved blocker prevents Completion', () => {
    const c = createCase('blocker');
    c.checkpoint.unresolved_blockers = ['BLOCKER-001'];
    c.session.unresolved_evidence = ['BLOCKER-001'];
    c.syncState();
    assert.equal(completion(c).passed, false);
  });

  test(37, 'omitted required Action prevents Completion', () => {
    const c = createCase('action-omitted');
    c.checkpoint.confirmed_action_ids = [];
    c.syncState();
    assert.equal(completion(c).passed, false);
  });

  test(38, 'foreign Action prevents Completion', () => {
    const c = createCase('action-foreign');
    c.checkpoint.confirmed_action_ids = ['BATCH-FOREIGN-A01'];
    c.syncState();
    assert.equal(completion(c).passed, false);
  });

  test(39, 'duplicate Action prevents Completion', () => {
    const c = createCase('action-duplicate');
    const action = c.context.action_batch.action_ids[0];
    c.checkpoint.confirmed_action_ids = [action, action];
    c.syncState();
    assert.equal(completion(c).passed, false);
  });

  test(40, 'unconfirmed Action prevents Completion', () => {
    const c = createCase('action-unconfirmed');
    c.checkpoint.unconfirmed_action_ids = [...c.context.action_batch.action_ids];
    c.syncState();
    assert.equal(completion(c).passed, false);
  });

  test(41, 'valid real source-bound run reaches COMPLETED', () => {
    const c = createCase('real-completed');
    const result = publishRealCompletion(c.options());
    assert.equal(result.result.target.runtime_state, 'COMPLETED');
  });

  test(42, 'valid real source-bound run sets builder_build_complete=true', () => {
    const c = createCase('real-build-complete');
    const result = publishRealCompletion(c.options());
    assert.equal(result.result.builder_build_complete, true);
  });

  test(43, 'Responsive and production flags remain false', () => {
    const c = createCase('downstream-flags');
    const result = publishRealCompletion(c.options());
    assert.equal(result.result.responsive_complete, false);
    assert.equal(result.result.production_ready, false);
  });

  test(44, 'Intake Capsule binding remains passing for legacy diagnostics', () => {
    const c = createCase('legacy-capsule');
    const capsule = buildIntakeCapsule(rel(c.builderFile)).result;
    const file = path.join(c.dir, 'legacy-capsule.json');
    write(file, capsule);
    assert.equal(verifyIntakeCapsule(rel(c.builderFile), rel(file)).passed, true);
  });

  test(45, 'source-file SHA-256 remains passing', () => {
    const c = createCase('source-sha');
    assert.equal(c.context.builder_input_sha256, sha256Bytes(fs.readFileSync(c.builderFile)));
  });

  test(46, 'canonical package digest remains passing', () => {
    const c = createCase('package-digest');
    assert.equal(c.context.canonical_package_digest, computePackageDigest(c.pkg));
  });

  test(47, 'Candidate continuity remains passing', () => {
    const c = createCase('candidate-continuity');
    assert.equal(c.context.selected_candidate_id, c.session.selected_candidate_id);
    assert.equal(c.context.selected_candidate_id, c.checkpoint.selected_candidate_id);
  });

  test(48, 'Session and Checkpoint identity remains passing', () => {
    const c = createCase('identity-continuity');
    const result = verifyRuntimeIdentity({ identity: { canonical_package_digest: c.context.canonical_package_digest, selected_candidate_id: c.context.selected_candidate_id } }, c.session, c.checkpoint);
    assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
  });

  test(49, 'caller-authored COMPLETED predecessor remains rejected', () => {
    const c = createCase('terminal-predecessor');
    c.session.runtime_state = c.session.current_state = c.checkpoint.runtime_state = 'COMPLETED';
    c.syncState();
    assert.equal(completion(c).passed, false);
  });

  test(50, 'Completion requires BUILD_ACTIVE', () => {
    const c = createCase('build-active-required');
    c.session.runtime_state = c.session.current_state = c.checkpoint.runtime_state = 'WAITING_FOR_CONFIRMATION';
    c.syncState();
    assert.equal(completion(c).passed, false);
  });

  test(51, 'Resume rules remain passing', () => {
    const c = createCase('resume-valid');
    const capsule = buildIntakeCapsule(rel(c.builderFile)).result;
    const capsuleFile = path.join(c.dir, 'resume-capsule.json');
    write(capsuleFile, capsule);
    c.session.runtime_state = c.session.current_state = 'PAUSED';
    c.session.resume_target = { workflow_mode: 'APPROVED_HANDOFF_MODE', runtime_state: 'BUILD_ACTIVE' };
    c.session.last_verified_checkpoint = c.checkpoint;
    rewrite(c.sessionFile, c.session);
    const result = validateResumeTransition({ sourceFile: rel(c.builderFile), capsuleFile: rel(capsuleFile), sessionFile: rel(c.sessionFile), checkpointFile: rel(c.checkpointFile) });
    assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
  });

  test(52, 'atomic publication remains passing', () => {
    const c = createCase('atomic-success');
    const result = publishRealCompletion(c.options());
    assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
    assert.deepEqual(fs.readdirSync(path.join(c.dir, 'completion-output')).sort(), ['checkpoint.json', 'completion-gate.json', 'completion-result.json', 'completion-status.json', 'session-state.json']);
  });

  test(53, 'failed publication leaves no final output', () => {
    const c = createCase('atomic-failure');
    c.checkpoint.evidence_ledger[0].content_sha256 = '0'.repeat(64);
    c.syncState();
    const output = path.join(c.dir, 'must-not-exist');
    const result = publishRealCompletion(c.options(output));
    assert.equal(result.passed, false);
    assert.equal(fs.existsSync(output), false);
  });

  test(54, 'prompt-injection checks remain passing', () => {
    const result = spawnSync(process.execPath, ['scripts/validate-ce-to-builder-contract-gate.mjs'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Builder truth-spine tests failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Passed ${passed.length}/54 tests.`);
  process.exit(1);
}

console.log(`Builder truth-spine tests passed: ${passed.length}/54.`);
