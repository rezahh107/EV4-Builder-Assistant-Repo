#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  computePackageDigest,
  sha256Bytes
} from './lib/canonical-builder-package.mjs';
import {
  checkpointSequenceIsValid
} from './lib/checkpoint-sequence.mjs';
import {
  publishConfirmationTransaction,
  publishEmitBatchTransaction,
  validateConfirmationTransaction,
  validateSourceModeArguments,
  validateStrictRealCompletion,
  verifyStrictEvidenceLedger,
  writeStrictRealIntake
} from './lib/builder-functional-correctness.mjs';

const ROOT = process.cwd();
const BASE_PACKAGE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'builder_context_package.json');
const BASE_SESSION = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'session_state_final.json');
const BASE_CHECKPOINT = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'checkpoint_final.json');
const TEMP = fs.mkdtempSync(path.join(ROOT, '.tmp-builder-functional-correctness-'));
const failures = [];
let count = 0;

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const rel = (file) => path.relative(ROOT, file);
const clone = (value) => structuredClone(value);
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
};
const hasCode = (result, code) => (result.diagnostics || []).some((entry) => entry.code === code);

function test(title, fn) {
  count += 1;
  try {
    fn();
    console.log(`PASS ${count}: ${title}`);
  } catch (error) {
    failures.push(`FAIL ${count}: ${title}: ${error.message}`);
  }
}

function cleanBuilderPackage() {
  const pkg = read(BASE_PACKAGE);
  for (const entry of pkg.source_payload_ledger || []) entry.source_ref = `operator-content:${entry.payload_name}`;
  pkg.input_authorization.package_digest.value = computePackageDigest(pkg);
  return pkg;
}

function createBaseCase(name) {
  const dir = path.join(TEMP, name);
  fs.mkdirSync(dir, { recursive: true });
  const builderFile = write(path.join(dir, 'builder-input.json'), cleanBuilderPackage());
  const contextFile = path.join(dir, 'runtime-context.json');
  const intake = writeStrictRealIntake({
    sourceMode: 'manual-builder-input',
    sourceArtifactFile: null,
    builderInputFile: rel(builderFile),
    contextOutputFile: rel(contextFile)
  });
  assert.equal(intake.passed, true, JSON.stringify(intake.diagnostics));
  const context = read(contextFile);

  const checkpoint = read(BASE_CHECKPOINT);
  checkpoint.checkpoint_id = `${name}-CP-001`;
  checkpoint.checkpoint_sequence = 1;
  checkpoint.parent_checkpoint_id = null;
  checkpoint.session_id = 'SESSION-001';
  checkpoint.package_id = rel(builderFile);
  checkpoint.package_sha256 = context.canonical_package_digest;
  checkpoint.package_digest = context.canonical_package_digest;
  checkpoint.selected_candidate_id = context.selected_candidate_id;
  checkpoint.workflow_mode = 'APPROVED_HANDOFF_MODE';
  checkpoint.runtime_state = 'BUILD_ACTIVE';
  checkpoint.batch_id = context.action_batch.batch_id;
  checkpoint.confirmed_action_ids = [];
  checkpoint.unconfirmed_action_ids = [...context.action_batch.action_ids];
  checkpoint.unresolved_blockers = [];
  checkpoint.created_at = '2026-07-24T00:00:00.000Z';

  const session = read(BASE_SESSION);
  session.session_id = 'SESSION-001';
  session.package_digest = context.canonical_package_digest;
  session.selected_candidate_id = context.selected_candidate_id;
  session.workflow_mode = 'APPROVED_HANDOFF_MODE';
  session.runtime_state = 'BUILD_ACTIVE';
  session.current_state = 'BUILD_ACTIVE';
  session.last_verified_checkpoint = checkpoint;
  session.unresolved_evidence = [];
  delete session.resume_target;

  const sessionFile = write(path.join(dir, 'session-state.json'), session);
  const checkpointFile = write(path.join(dir, 'checkpoint.json'), checkpoint);
  return { dir, builderFile, contextFile, context, session, checkpoint, sessionFile, checkpointFile };
}

function emitCase(base, suffix = 'emit-output') {
  const outputDirectory = path.join(base.dir, suffix);
  const result = publishEmitBatchTransaction({
    contextFile: rel(base.contextFile),
    sessionFile: rel(base.sessionFile),
    checkpointFile: rel(base.checkpointFile),
    outputDirectory: rel(outputDirectory)
  });
  assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
  return {
    ...base,
    emitResult: result,
    waitingSessionFile: path.join(outputDirectory, 'session-state.json'),
    waitingCheckpointFile: path.join(outputDirectory, 'checkpoint.json')
  };
}

function confirmCase(emitted, suffix = 'confirmation-output') {
  const outputDirectory = path.join(emitted.dir, suffix);
  const result = publishConfirmationTransaction({
    contextFile: rel(emitted.contextFile),
    sessionFile: rel(emitted.waitingSessionFile),
    checkpointFile: rel(emitted.waitingCheckpointFile),
    userToken: emitted.context.confirmation.expected_user_token,
    outputDirectory: rel(outputDirectory)
  });
  assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
  return {
    ...emitted,
    confirmationResult: result,
    confirmedSessionFile: path.join(outputDirectory, 'session-state.json'),
    confirmedCheckpointFile: path.join(outputDirectory, 'checkpoint.json'),
    confirmationReceiptFile: path.join(outputDirectory, 'confirmation-receipt.json')
  };
}

function writeMutation(dir, name, session, checkpoint) {
  const mutationDir = path.join(dir, name);
  fs.mkdirSync(mutationDir, { recursive: true });
  const checkpointFile = write(path.join(mutationDir, 'checkpoint.json'), checkpoint);
  const updatedSession = clone(session);
  updatedSession.last_verified_checkpoint = checkpoint;
  const sessionFile = write(path.join(mutationDir, 'session-state.json'), updatedSession);
  return { sessionFile, checkpointFile };
}

function addEvidence(confirmed) {
  const checkpoint = read(confirmed.confirmedCheckpointFile);
  const session = read(confirmed.confirmedSessionFile);
  const assertions = [];
  const ledger = [];
  const sources = new Map();

  function add(id, evidenceType, assertionId, subjectRef, claimClasses, actionId = null) {
    const source = {
      schema: 'ev4-builder-evidence-source@1.0.0',
      evidence_type: evidenceType,
      claim_ids: [assertionId],
      claim_classes: claimClasses,
      subject_ref: subjectRef,
      session_id: session.session_id,
      package_digest: confirmed.context.canonical_package_digest,
      ...(actionId ? { action_id: actionId } : {}),
      status: 'verified'
    };
    const file = write(path.join(confirmed.dir, `${id}.json`), source);
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
      source_ref: rel(file),
      captured_at: '2026-07-24T00:03:00.000Z',
      content_sha256: sha256Bytes(fs.readFileSync(file)),
      supports_claim_ids: [assertionId],
      status: 'available'
    });
    sources.set(id, { file, source });
  }

  for (const actionId of confirmed.context.action_batch.action_ids) add(`EV-${actionId}`, 'diagnostic', `ASSERT-${actionId}`, actionId, ['required_action_execution'], actionId);
  add('EV-SCAFFOLD', 'diagnostic', 'ASSERT-SCAFFOLD', 'builder-output', ['scaffold_built']);
  add('EV-STRUCTURE', 'structure_panel_screenshot', 'ASSERT-STRUCTURE', 'builder-output', ['structure_built']);
  add('EV-CONTENT', 'editor_screenshot', 'ASSERT-CONTENT', 'builder-output', ['content_filled']);
  add('EV-LAYOUT', 'frontend_screenshot', 'ASSERT-LAYOUT', 'builder-output', ['desktop_layout_established', 'layout_verified']);
  add('EV-EXPORT', 'export_json', 'ASSERT-EXPORT', 'builder-output', ['export_checked', 'export_verified']);

  checkpoint.assertions = assertions;
  checkpoint.evidence_ledger = ledger;
  session.last_verified_checkpoint = checkpoint;
  write(confirmed.confirmedCheckpointFile, checkpoint);
  write(confirmed.confirmedSessionFile, session);
  return { ...confirmed, checkpoint, session, sources };
}

function completionOptions(c, outputName = 'completion-output') {
  return {
    sourceMode: 'manual-builder-input',
    sourceArtifactFile: null,
    builderInputFile: rel(c.builderFile),
    contextFile: rel(c.contextFile),
    sessionFile: rel(c.confirmedSessionFile),
    checkpointFile: rel(c.confirmedCheckpointFile),
    confirmationReceiptFile: rel(c.confirmationReceiptFile),
    outputDirectory: rel(path.join(c.dir, outputName))
  };
}

try {
  test('source mode arguments accept exact project-gate inputs', () => assert.equal(validateSourceModeArguments({ sourceMode: 'project-gate', sourceArtifactFile: 'r.json', builderInputFile: 'b.json' }).passed, true));
  test('source mode arguments reject project-gate without Builder Input', () => assert.equal(validateSourceModeArguments({ sourceMode: 'project-gate', sourceArtifactFile: 'r.json' }).passed, false));
  test('source mode arguments reject direct-ce with unused Builder Input', () => assert.equal(validateSourceModeArguments({ sourceMode: 'direct-ce', sourceArtifactFile: 'ce.json', builderInputFile: 'unused.json' }).passed, false));
  test('source mode arguments reject manual mode with unused source artifact', () => assert.equal(validateSourceModeArguments({ sourceMode: 'manual-builder-input', sourceArtifactFile: 'unused.json', builderInputFile: 'b.json' }).passed, false));
  test('source mode arguments preserve exact direct-ce inputs', () => assert.equal(validateSourceModeArguments({ sourceMode: 'direct-ce', sourceArtifactFile: 'ce.json' }).passed, true));
  test('source mode arguments preserve exact manual inputs', () => assert.equal(validateSourceModeArguments({ sourceMode: 'manual-builder-input', builderInputFile: 'b.json' }).passed, true));

  test('canonical sequence accepts initial Checkpoint', () => assert.equal(checkpointSequenceIsValid({ checkpoint_sequence: 1, parent_checkpoint_id: null }), true));
  test('canonical sequence accepts subsequent Checkpoint', () => assert.equal(checkpointSequenceIsValid({ checkpoint_sequence: 2, parent_checkpoint_id: 'CP-001' }), true));
  test('canonical sequence rejects sequence 1 with parent', () => assert.equal(checkpointSequenceIsValid({ checkpoint_sequence: 1, parent_checkpoint_id: 'CP-000' }), false));
  test('canonical sequence rejects sequence 2 with null parent', () => assert.equal(checkpointSequenceIsValid({ checkpoint_sequence: 2, parent_checkpoint_id: null }), false));
  for (const value of [0, -1, 1.5]) test(`canonical sequence rejects invalid numeric value ${value}`, () => assert.equal(checkpointSequenceIsValid({ checkpoint_sequence: value, parent_checkpoint_id: null }), false));

  const base = createBaseCase('canonical-flow');
  const emitted = emitCase(base);
  const waitingSession = read(emitted.waitingSessionFile);
  const waitingCheckpoint = read(emitted.waitingCheckpointFile);

  test('confirm-batch rejects BUILD_ACTIVE predecessor', () => {
    const result = validateConfirmationTransaction({ contextFile: rel(base.contextFile), sessionFile: rel(base.sessionFile), checkpointFile: rel(base.checkpointFile), userToken: base.context.confirmation.expected_user_token });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'BUILDER-CONFIRM-TXN-002'), true);
  });
  test('confirm-batch rejects pre-populated confirmed_action_ids', () => {
    const checkpoint = clone(waitingCheckpoint);
    checkpoint.confirmed_action_ids = [...base.context.action_batch.action_ids];
    const files = writeMutation(base.dir, 'preconfirmed', waitingSession, checkpoint);
    const result = validateConfirmationTransaction({ contextFile: rel(base.contextFile), sessionFile: rel(files.sessionFile), checkpointFile: rel(files.checkpointFile), userToken: base.context.confirmation.expected_user_token });
    assert.equal(hasCode(result, 'BUILDER-CONFIRM-TXN-004'), true);
  });
  test('confirm-batch rejects incomplete unconfirmed_action_ids', () => {
    const checkpoint = clone(waitingCheckpoint);
    checkpoint.unconfirmed_action_ids = [];
    const files = writeMutation(base.dir, 'incomplete-unconfirmed', waitingSession, checkpoint);
    const result = validateConfirmationTransaction({ contextFile: rel(base.contextFile), sessionFile: rel(files.sessionFile), checkpointFile: rel(files.checkpointFile), userToken: base.context.confirmation.expected_user_token });
    assert.equal(hasCode(result, 'BUILDER-CONFIRM-TXN-005'), true);
  });
  test('confirm-batch rejects foreign unconfirmed Action', () => {
    const checkpoint = clone(waitingCheckpoint);
    checkpoint.unconfirmed_action_ids = ['BATCH-FOREIGN-A01'];
    const files = writeMutation(base.dir, 'foreign-unconfirmed', waitingSession, checkpoint);
    const result = validateConfirmationTransaction({ contextFile: rel(base.contextFile), sessionFile: rel(files.sessionFile), checkpointFile: rel(files.checkpointFile), userToken: base.context.confirmation.expected_user_token });
    assert.equal(hasCode(result, 'BUILDER-CONFIRM-TXN-005'), true);
  });
  test('confirm-batch rejects Session and Checkpoint state mismatch', () => {
    const session = clone(waitingSession);
    session.runtime_state = 'BUILD_ACTIVE';
    session.current_state = 'BUILD_ACTIVE';
    const sessionFile = write(path.join(base.dir, 'state-mismatch-session.json'), session);
    const result = validateConfirmationTransaction({ contextFile: rel(base.contextFile), sessionFile: rel(sessionFile), checkpointFile: rel(emitted.waitingCheckpointFile), userToken: base.context.confirmation.expected_user_token });
    assert.equal(hasCode(result, 'BUILDER-CONFIRM-TXN-002'), true);
  });
  test('confirm-batch rejects wrong Batch', () => {
    const checkpoint = clone(waitingCheckpoint);
    checkpoint.batch_id = 'BATCH-FOREIGN';
    const files = writeMutation(base.dir, 'wrong-batch', waitingSession, checkpoint);
    const result = validateConfirmationTransaction({ contextFile: rel(base.contextFile), sessionFile: rel(files.sessionFile), checkpointFile: rel(files.checkpointFile), userToken: base.context.confirmation.expected_user_token });
    assert.equal(hasCode(result, 'BUILDER-CONFIRM-TXN-003'), true);
  });
  test('confirm-batch rejects wrong token', () => {
    const result = validateConfirmationTransaction({ contextFile: rel(base.contextFile), sessionFile: rel(emitted.waitingSessionFile), checkpointFile: rel(emitted.waitingCheckpointFile), userToken: 'WRONG' });
    assert.equal(hasCode(result, 'BUILDER-CONFIRM-TXN-006'), true);
  });
  test('failed Confirmation atomic validation publishes nothing', () => {
    const outputDirectory = path.join(base.dir, 'failed-confirmation-output');
    const result = publishConfirmationTransaction({
      contextFile: rel(base.contextFile),
      sessionFile: rel(emitted.waitingSessionFile),
      checkpointFile: rel(emitted.waitingCheckpointFile),
      userToken: base.context.confirmation.expected_user_token,
      outputDirectory: rel(outputDirectory),
      validateStageOverride: () => ({ passed: false, reason: 'injected-test-failure' })
    });
    assert.equal(result.passed, false);
    assert.equal(fs.existsSync(outputDirectory), false);
  });

  const confirmed = confirmCase(emitted);
  test('valid WAITING_FOR_CONFIRMATION to BUILD_ACTIVE transaction is preserved', () => {
    const checkpoint = read(confirmed.confirmedCheckpointFile);
    const session = read(confirmed.confirmedSessionFile);
    const receipt = read(confirmed.confirmationReceiptFile);
    assert.equal(checkpoint.runtime_state, 'BUILD_ACTIVE');
    assert.equal(session.runtime_state, 'BUILD_ACTIVE');
    assert.deepEqual(checkpoint.confirmed_action_ids, base.context.action_batch.action_ids);
    assert.deepEqual(checkpoint.unconfirmed_action_ids, []);
    assert.equal(checkpoint.checkpoint_sequence, waitingCheckpoint.checkpoint_sequence + 1);
    assert.equal(checkpoint.parent_checkpoint_id, waitingCheckpoint.checkpoint_id);
    assert.equal(receipt.checkpoint_id, checkpoint.checkpoint_id);
    assert.equal(receipt.checkpoint_sequence, checkpoint.checkpoint_sequence);
  });

  const evidenced = addEvidence(confirmed);
  test('valid Action-specific execution Evidence is verified', () => {
    const result = verifyStrictEvidenceLedger({ checkpoint: evidenced.checkpoint, context: evidenced.context, session: evidenced.session });
    assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
    assert.deepEqual(result.verified_action_ids, evidenced.context.action_batch.action_ids);
  });
  test('generic Action execution subjects cannot satisfy execution coverage', () => {
    const checkpoint = clone(evidenced.checkpoint);
    const actionId = evidenced.context.action_batch.action_ids[0];
    const evidenceId = `EV-${actionId}`;
    const assertion = checkpoint.assertions.find((entry) => entry.evidence_refs.includes(evidenceId));
    assertion.subject_ref = 'builder-output';
    const sourceEntry = evidenced.sources.get(evidenceId);
    const source = clone(sourceEntry.source);
    source.subject_ref = 'builder-output';
    write(sourceEntry.file, source);
    const record = checkpoint.evidence_ledger.find((entry) => entry.evidence_id === evidenceId);
    record.content_sha256 = sha256Bytes(fs.readFileSync(sourceEntry.file));
    const result = verifyStrictEvidenceLedger({ checkpoint, context: evidenced.context, session: evidenced.session });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'BUILDER-EVIDENCE-STRICT-021') || hasCode(result, 'BUILDER-EVIDENCE-STRICT-022'), true);
    write(sourceEntry.file, sourceEntry.source);
  });

  const statusValues = [undefined, null, 'failed', 'unverified', 'pending', 'unknown', 7];
  for (const status of statusValues) {
    test(`Evidence source.status=${String(status)} is rejected and excluded`, () => {
      const checkpoint = clone(evidenced.checkpoint);
      const sourceEntry = evidenced.sources.get('EV-SCAFFOLD');
      const source = clone(sourceEntry.source);
      if (status === undefined) delete source.status;
      else source.status = status;
      write(sourceEntry.file, source);
      const record = checkpoint.evidence_ledger.find((entry) => entry.evidence_id === 'EV-SCAFFOLD');
      record.content_sha256 = sha256Bytes(fs.readFileSync(sourceEntry.file));
      const result = verifyStrictEvidenceLedger({ checkpoint, context: evidenced.context, session: evidenced.session });
      assert.equal(result.passed, false);
      assert.equal(hasCode(result, 'BUILDER-EVIDENCE-STRICT-009'), true);
      assert.equal(result.verified.some((entry) => entry.evidence_id === 'EV-SCAFFOLD'), false);
      write(sourceEntry.file, sourceEntry.source);
    });
  }

  test('strict Completion preserves a valid confirmed Batch and verified Evidence set', () => {
    const result = validateStrictRealCompletion(completionOptions(evidenced, 'valid-completion'));
    assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
  });
  test('strict Completion rejects changed checkpoint.batch_id with Action mirrors preserved', () => {
    const checkpoint = clone(evidenced.checkpoint);
    checkpoint.batch_id = 'BATCH-FOREIGN';
    const session = clone(evidenced.session);
    session.last_verified_checkpoint = checkpoint;
    const files = writeMutation(evidenced.dir, 'completion-batch-drift', session, checkpoint);
    const options = completionOptions(evidenced, 'batch-drift-output');
    options.sessionFile = rel(files.sessionFile);
    options.checkpointFile = rel(files.checkpointFile);
    const result = validateStrictRealCompletion(options);
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'BUILDER-CONFIRM-STRICT-009'), true);
  });
} finally {
  fs.rmSync(TEMP, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Builder functional-correctness repair tests failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Builder functional-correctness repair tests passed: ${count}/${count}.`);
