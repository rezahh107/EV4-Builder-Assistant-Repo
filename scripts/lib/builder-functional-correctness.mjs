import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  computeCanonicalDigest,
  sha256Bytes,
  sortedCanonicalJson
} from './canonical-builder-package.mjs';
import {
  publishDirectoryAtomically,
  runAjv,
  validateResumeTransition,
  verifyRuntimeIdentity
} from './builder-runtime-transition.mjs';
import {
  CLAIM_COMPATIBILITY,
  RUNTIME_MODES,
  SOURCE_MODES,
  publishRealCompletion as publishLegacyRealCompletion,
  validateRealCompletion as validateLegacyRealCompletion,
  verifyDerivedContext,
  writeRealIntake as writeLegacyRealIntake
} from './builder-explicit-source-runtime.mjs';
import {
  checkpointSequenceIsValid,
  validateCheckpointSequence
} from './checkpoint-sequence.mjs';

const ROOT = process.cwd();
const HASH = /^[a-f0-9]{64}$/;
const REQUIRED_COMPLETION_CLAIMS = Object.freeze([
  'scaffold_built',
  'structure_built',
  'content_filled',
  'desktop_layout_established',
  'layout_verified',
  'export_checked',
  'export_verified'
]);
const ALLOWED_MULTI_CLAIM_SETS = new Set([
  ['desktop_layout_established', 'layout_verified'].sort().join('|'),
  ['export_checked', 'export_verified'].sort().join('|')
]);

function diagnostic(code, message, detail = '') {
  return { code, message, ...(detail ? { detail } : {}) };
}

function resolvePath(file) {
  return path.resolve(ROOT, file);
}

function relativePath(file) {
  return path.relative(ROOT, resolvePath(file));
}

function readBytes(file) {
  return fs.readFileSync(resolvePath(file));
}

function readJson(file) {
  return JSON.parse(readBytes(file).toString('utf8'));
}

function writeJsonAtomic(file, value) {
  const target = resolvePath(file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, target);
  } catch (error) {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function runNode(script, ...args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: false
  });
  const detail = result.error?.message || `${result.stderr || ''}\n${result.stdout || ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-10)
    .join(' | ')
    .slice(0, 1600);
  return { passed: !result.error && result.status === 0, detail };
}

function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

function receiptWithoutDigest(receipt) {
  const clone = structuredClone(receipt);
  delete clone.receipt_digest;
  return clone;
}

function scanSynthetic(value, location = '$', findings = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanSynthetic(entry, `${location}[${index}]`, findings));
    return findings;
  }
  if (!value || typeof value !== 'object') return findings;
  for (const [key, entry] of Object.entries(value)) {
    const next = `${location}.${key}`;
    if (key === 'fixture_classification' && typeof entry === 'string' && /synthetic|fixture|test/i.test(entry)) findings.push(next);
    if (key === 'synthetic' && entry === true) findings.push(next);
    if (typeof entry === 'string' && /^(synthetic_validation_only|test-fixture(?::|$))/i.test(entry)) findings.push(next);
    scanSynthetic(entry, next, findings);
  }
  return findings;
}

function validateStateCarrierFiles(sessionFile, checkpointFile, prefix) {
  const diagnostics = [];
  const sessionSchema = runAjv('schemas/session-state.schema.json', sessionFile, [
    'schemas/checkpoint.schema.json',
    'schemas/evidence-record.schema.json',
    'schemas/repair-packet.schema.json'
  ]);
  const checkpointSchema = runAjv('schemas/checkpoint.schema.json', checkpointFile, ['schemas/evidence-record.schema.json']);
  const sessionSemantic = runNode('scripts/validate-session-state.mjs', sessionFile);
  const checkpointSemantic = runNode('scripts/validate-checkpoint.mjs', checkpointFile);
  if (!sessionSchema.passed || !sessionSemantic.passed) diagnostics.push(diagnostic(`${prefix}-SESSION`, 'Session State validation failed.', sessionSchema.detail || sessionSemantic.detail));
  if (!checkpointSchema.passed || !checkpointSemantic.passed) diagnostics.push(diagnostic(`${prefix}-CHECKPOINT`, 'Checkpoint validation failed.', checkpointSchema.detail || checkpointSemantic.detail));
  return diagnostics;
}

export function validateSourceModeArguments({ sourceMode, sourceArtifactFile = null, builderInputFile = null }) {
  const diagnostics = [];
  if (sourceMode === SOURCE_MODES.PROJECT_GATE) {
    if (!sourceArtifactFile) diagnostics.push(diagnostic('BUILDER-SOURCE-ARG-001', 'project-gate requires sourceArtifactFile.'));
    if (!builderInputFile) diagnostics.push(diagnostic('BUILDER-SOURCE-ARG-002', 'project-gate requires builderInputFile.'));
  } else if (sourceMode === SOURCE_MODES.DIRECT_CE) {
    if (!sourceArtifactFile) diagnostics.push(diagnostic('BUILDER-SOURCE-ARG-003', 'direct-ce requires sourceArtifactFile.'));
    if (builderInputFile) diagnostics.push(diagnostic('BUILDER-SOURCE-ARG-004', 'direct-ce forbids builderInputFile because it is not consumed.'));
  } else if (sourceMode === SOURCE_MODES.MANUAL_BUILDER_INPUT) {
    if (sourceArtifactFile) diagnostics.push(diagnostic('BUILDER-SOURCE-ARG-005', 'manual-builder-input forbids sourceArtifactFile because it is not consumed.'));
    if (!builderInputFile) diagnostics.push(diagnostic('BUILDER-SOURCE-ARG-006', 'manual-builder-input requires builderInputFile.'));
  } else {
    diagnostics.push(diagnostic('BUILDER-SOURCE-ARG-007', `Unsupported explicit source mode: ${sourceMode}.`));
  }
  return { passed: diagnostics.length === 0, diagnostics };
}

export function writeStrictRealIntake(options) {
  const args = validateSourceModeArguments(options);
  if (!args.passed) {
    const result = {
      schema: 'ev4-builder-real-intake-result@1.0.0',
      status: 'blocked',
      runtime_mode: RUNTIME_MODES.REAL,
      source_mode: options.sourceMode,
      source_selection: 'operator_explicit',
      builder_build_complete: false,
      runtime_state: 'INTAKE_VALIDATING',
      context_digest: null,
      canonical_package_digest: null,
      selected_candidate_id: null,
      content_binding_status: 'unverified',
      origin_assurance: 'not_available',
      receipt_binding_status: 'not_applicable',
      blocking_diagnostics: args.diagnostics
    };
    if (options.resultOutputFile) writeJsonAtomic(options.resultOutputFile, result);
    return { passed: false, diagnostics: args.diagnostics, result };
  }
  return writeLegacyRealIntake(options);
}

function readAndValidateContext(contextFile) {
  const diagnostics = [];
  let context = null;
  try {
    context = readJson(contextFile);
  } catch (error) {
    return { passed: false, context: null, diagnostics: [diagnostic('BUILDER-CONTEXT-TXN-001', 'Runtime Context is unreadable or malformed.', error.message)] };
  }
  if (context.schema !== 'ev4-builder-verified-context@1.0.0') diagnostics.push(diagnostic('BUILDER-CONTEXT-TXN-002', 'Unsupported Runtime Context schema.'));
  if (context.runtime_mode !== RUNTIME_MODES.REAL) diagnostics.push(diagnostic('BUILDER-CONTEXT-TXN-003', 'Runtime Context is not a real-builder-run carrier.'));
  if (!Object.values(SOURCE_MODES).includes(context.source_mode)) diagnostics.push(diagnostic('BUILDER-CONTEXT-TXN-004', 'Runtime Context source mode is invalid.'));
  if (context.source_selection !== 'operator_explicit' || context.content_binding_status !== 'verified') diagnostics.push(diagnostic('BUILDER-CONTEXT-TXN-005', 'Runtime Context is not deterministically content-bound.'));
  if (!HASH.test(context.context_digest || '')) diagnostics.push(diagnostic('BUILDER-CONTEXT-TXN-006', 'Runtime Context digest is invalid.'));
  const clone = structuredClone(context);
  delete clone.context_digest;
  if (context.context_digest !== computeCanonicalDigest(clone)) diagnostics.push(diagnostic('BUILDER-CONTEXT-TXN-007', 'Runtime Context digest does not match content.'));
  if (!Array.isArray(context.action_batch?.action_ids) || context.action_batch.action_ids.length === 0) diagnostics.push(diagnostic('BUILDER-CONTEXT-TXN-008', 'Runtime Context has no complete Action set.'));
  return { passed: diagnostics.length === 0, context, diagnostics };
}

function deriveTimestamp(predecessor) {
  const value = Date.parse(predecessor?.created_at || '');
  return Number.isFinite(value) ? new Date(value + 1000).toISOString() : '1970-01-01T00:00:01.000Z';
}

function validateTransactionIdentity(context, session, checkpoint, codePrefix) {
  const result = verifyRuntimeIdentity({ identity: {
    canonical_package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id
  } }, session, checkpoint);
  return result.diagnostics.map((entry, index) => diagnostic(`${codePrefix}-${String(index + 1).padStart(2, '0')}`, entry.message, entry.detail || ''));
}

export function validateEmitBatchTransaction({ contextFile, sessionFile, checkpointFile }) {
  const diagnostics = [];
  const contextResult = readAndValidateContext(contextFile);
  diagnostics.push(...contextResult.diagnostics);
  let session;
  let checkpoint;
  try {
    session = readJson(sessionFile);
    checkpoint = readJson(checkpointFile);
  } catch (error) {
    return { passed: false, diagnostics: [diagnostic('BUILDER-EMIT-001', 'Emit Batch carriers are unreadable or malformed.', error.message)] };
  }
  diagnostics.push(...validateStateCarrierFiles(sessionFile, checkpointFile, 'BUILDER-EMIT'));
  if (contextResult.context) diagnostics.push(...validateTransactionIdentity(contextResult.context, session, checkpoint, 'BUILDER-EMIT-ID'));
  diagnostics.push(...validateCheckpointSequence(checkpoint, 'BUILDER-EMIT-SEQ-001', 'Emit Batch predecessor Checkpoint'));
  if (session.workflow_mode !== 'APPROVED_HANDOFF_MODE' || session.runtime_state !== 'BUILD_ACTIVE' || session.current_state !== 'BUILD_ACTIVE' || checkpoint.workflow_mode !== 'APPROVED_HANDOFF_MODE' || checkpoint.runtime_state !== 'BUILD_ACTIVE') {
    diagnostics.push(diagnostic('BUILDER-EMIT-002', 'emit-batch requires matching APPROVED_HANDOFF_MODE / BUILD_ACTIVE carriers.'));
  }
  const actions = contextResult.context?.action_batch?.action_ids || [];
  if (checkpoint.batch_id !== contextResult.context?.action_batch?.batch_id) diagnostics.push(diagnostic('BUILDER-EMIT-003', 'Emit Batch Checkpoint batch_id does not match Runtime Context.'));
  if (!Array.isArray(checkpoint.confirmed_action_ids) || checkpoint.confirmed_action_ids.length !== 0) diagnostics.push(diagnostic('BUILDER-EMIT-004', 'emit-batch requires an empty confirmed_action_ids set.'));
  if (!sameSet(checkpoint.unconfirmed_action_ids, actions)) diagnostics.push(diagnostic('BUILDER-EMIT-005', 'emit-batch requires the complete Context Action set in unconfirmed_action_ids.'));
  return { passed: diagnostics.length === 0, diagnostics, context: contextResult.context, session, checkpoint };
}

function validateGeneratedStatePair(stageDirectory, resultName, expectedState) {
  const sessionFile = path.join(stageDirectory, 'session-state.json');
  const checkpointFile = path.join(stageDirectory, 'checkpoint.json');
  const diagnostics = validateStateCarrierFiles(sessionFile, checkpointFile, 'BUILDER-GENERATED');
  let session;
  let checkpoint;
  let result;
  try {
    session = readJson(sessionFile);
    checkpoint = readJson(checkpointFile);
    result = readJson(path.join(stageDirectory, resultName));
  } catch (error) {
    diagnostics.push(diagnostic('BUILDER-GENERATED-001', 'Generated transaction output is unreadable.', error.message));
    return { passed: false, diagnostics };
  }
  diagnostics.push(...validateCheckpointSequence(checkpoint, 'BUILDER-GENERATED-SEQ-001', 'Generated Checkpoint'));
  if (session.runtime_state !== expectedState || session.current_state !== expectedState || checkpoint.runtime_state !== expectedState) diagnostics.push(diagnostic('BUILDER-GENERATED-002', `Generated carriers must enter ${expectedState}.`));
  if (sortedCanonicalJson(session.last_verified_checkpoint) !== sortedCanonicalJson(checkpoint)) diagnostics.push(diagnostic('BUILDER-GENERATED-003', 'Generated Session must embed the exact generated Checkpoint.'));
  if (result.status !== 'accepted' || result.blocking_diagnostics?.length !== 0) diagnostics.push(diagnostic('BUILDER-GENERATED-004', 'Generated transaction result is not accepted.'));
  return { passed: diagnostics.length === 0, diagnostics, session, checkpoint, result };
}

export function publishEmitBatchTransaction(options) {
  const validation = validateEmitBatchTransaction(options);
  if (!validation.passed) return validation;
  const { context, session, checkpoint } = validation;
  const key = computeCanonicalDigest({
    transition: 'emit-batch',
    context_digest: context.context_digest,
    session_id: session.session_id,
    checkpoint_id: checkpoint.checkpoint_id,
    checkpoint_sequence: checkpoint.checkpoint_sequence,
    action_ids: context.action_batch.action_ids
  }).slice(0, 12);
  const nextCheckpoint = structuredClone(checkpoint);
  nextCheckpoint.checkpoint_id = `${checkpoint.checkpoint_id}-EMIT-${key}`;
  nextCheckpoint.checkpoint_sequence = checkpoint.checkpoint_sequence + 1;
  nextCheckpoint.parent_checkpoint_id = checkpoint.checkpoint_id;
  nextCheckpoint.workflow_mode = 'APPROVED_HANDOFF_MODE';
  nextCheckpoint.runtime_state = 'WAITING_FOR_CONFIRMATION';
  nextCheckpoint.confirmed_action_ids = [];
  nextCheckpoint.unconfirmed_action_ids = [...context.action_batch.action_ids];
  nextCheckpoint.created_at = deriveTimestamp(checkpoint);

  const nextSession = structuredClone(session);
  nextSession.workflow_mode = 'APPROVED_HANDOFF_MODE';
  nextSession.runtime_state = 'WAITING_FOR_CONFIRMATION';
  nextSession.current_state = 'WAITING_FOR_CONFIRMATION';
  nextSession.last_verified_checkpoint = nextCheckpoint;

  const result = {
    schema: 'ev4-builder-emit-batch-result@1.0.0',
    transition_id: 'emit-batch',
    status: 'accepted',
    source: { workflow_mode: session.workflow_mode, runtime_state: session.runtime_state },
    target: { workflow_mode: nextSession.workflow_mode, runtime_state: nextSession.runtime_state },
    batch_id: context.action_batch.batch_id,
    emitted_action_ids: [...context.action_batch.action_ids],
    resulting_checkpoint: {
      checkpoint_id: nextCheckpoint.checkpoint_id,
      checkpoint_sequence: nextCheckpoint.checkpoint_sequence,
      parent_checkpoint_id: nextCheckpoint.parent_checkpoint_id
    },
    builder_build_complete: false,
    responsive_complete: false,
    production_ready: false,
    publication: {
      atomic: true,
      output_directory: relativePath(options.outputDirectory),
      files: ['checkpoint.json', 'emit-batch-result.json', 'session-state.json']
    },
    blocking_diagnostics: []
  };

  try {
    publishDirectoryAtomically(options.outputDirectory, {
      'session-state.json': nextSession,
      'checkpoint.json': nextCheckpoint,
      'emit-batch-result.json': result
    }, options.validateStageOverride || ((stage) => validateGeneratedStatePair(stage, 'emit-batch-result.json', 'WAITING_FOR_CONFIRMATION')));
  } catch (error) {
    return { ...validation, passed: false, diagnostics: [diagnostic('BUILDER-EMIT-006', 'Atomic emit-batch publication failed.', error.message)] };
  }
  return { ...validation, result, nextSession, nextCheckpoint };
}

export function validateConfirmationTransaction({ contextFile, sessionFile, checkpointFile, userToken }) {
  const diagnostics = [];
  const contextResult = readAndValidateContext(contextFile);
  diagnostics.push(...contextResult.diagnostics);
  let session;
  let checkpoint;
  try {
    session = readJson(sessionFile);
    checkpoint = readJson(checkpointFile);
  } catch (error) {
    return { passed: false, diagnostics: [diagnostic('BUILDER-CONFIRM-TXN-001', 'Confirmation carriers are unreadable or malformed.', error.message)] };
  }
  diagnostics.push(...validateStateCarrierFiles(sessionFile, checkpointFile, 'BUILDER-CONFIRM-TXN'));
  if (contextResult.context) diagnostics.push(...validateTransactionIdentity(contextResult.context, session, checkpoint, 'BUILDER-CONFIRM-TXN-ID'));
  diagnostics.push(...validateCheckpointSequence(checkpoint, 'BUILDER-CONFIRM-TXN-SEQ-001', 'Confirmation predecessor Checkpoint'));
  if (session.workflow_mode !== 'APPROVED_HANDOFF_MODE' || session.runtime_state !== 'WAITING_FOR_CONFIRMATION' || session.current_state !== 'WAITING_FOR_CONFIRMATION' || checkpoint.workflow_mode !== 'APPROVED_HANDOFF_MODE' || checkpoint.runtime_state !== 'WAITING_FOR_CONFIRMATION') {
    diagnostics.push(diagnostic('BUILDER-CONFIRM-TXN-002', 'confirm-batch accepts only matching APPROVED_HANDOFF_MODE / WAITING_FOR_CONFIRMATION carriers.'));
  }
  const context = contextResult.context;
  const actions = context?.action_batch?.action_ids || [];
  if (checkpoint.batch_id !== context?.action_batch?.batch_id) diagnostics.push(diagnostic('BUILDER-CONFIRM-TXN-003', 'Confirmation Checkpoint batch_id does not match Runtime Context.'));
  if (!Array.isArray(checkpoint.confirmed_action_ids) || checkpoint.confirmed_action_ids.length !== 0) diagnostics.push(diagnostic('BUILDER-CONFIRM-TXN-004', 'Confirmation predecessor confirmed_action_ids must be empty.'));
  if (!sameSet(checkpoint.unconfirmed_action_ids, actions)) diagnostics.push(diagnostic('BUILDER-CONFIRM-TXN-005', 'Confirmation predecessor unconfirmed_action_ids must equal the complete Context Action set.'));
  if (typeof userToken !== 'string' || userToken !== context?.confirmation?.expected_user_token) diagnostics.push(diagnostic('BUILDER-CONFIRM-TXN-006', 'Operator token does not match the active Action Batch.'));
  return { passed: diagnostics.length === 0, diagnostics, context, session, checkpoint };
}

function buildConfirmationOutputs(validation, outputDirectory) {
  const { context, session, checkpoint } = validation;
  const key = computeCanonicalDigest({
    transition: 'confirm-batch',
    context_digest: context.context_digest,
    session_id: session.session_id,
    predecessor_checkpoint_id: checkpoint.checkpoint_id,
    predecessor_checkpoint_sequence: checkpoint.checkpoint_sequence,
    batch_id: context.action_batch.batch_id,
    action_ids: context.action_batch.action_ids,
    user_token: context.confirmation.expected_user_token
  }).slice(0, 12);
  const nextCheckpoint = structuredClone(checkpoint);
  nextCheckpoint.checkpoint_id = `${checkpoint.checkpoint_id}-CONFIRMED-${key}`;
  nextCheckpoint.checkpoint_sequence = checkpoint.checkpoint_sequence + 1;
  nextCheckpoint.parent_checkpoint_id = checkpoint.checkpoint_id;
  nextCheckpoint.workflow_mode = 'APPROVED_HANDOFF_MODE';
  nextCheckpoint.runtime_state = 'BUILD_ACTIVE';
  nextCheckpoint.batch_id = context.action_batch.batch_id;
  nextCheckpoint.confirmed_action_ids = [...context.action_batch.action_ids];
  nextCheckpoint.unconfirmed_action_ids = [];
  nextCheckpoint.created_at = deriveTimestamp(checkpoint);

  const nextSession = structuredClone(session);
  nextSession.workflow_mode = 'APPROVED_HANDOFF_MODE';
  nextSession.runtime_state = 'BUILD_ACTIVE';
  nextSession.current_state = 'BUILD_ACTIVE';
  nextSession.last_verified_checkpoint = nextCheckpoint;

  const receipt = {
    schema: 'ev4-builder-confirmation-receipt@1.0.0',
    runtime_mode: RUNTIME_MODES.REAL,
    confirmation_id: context.confirmation.confirmation_id,
    session_id: session.session_id,
    package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id,
    batch_id: context.action_batch.batch_id,
    confirmed_action_ids: [...context.action_batch.action_ids],
    confirmed_action_digests: { ...context.action_batch.action_digests },
    user_token: context.confirmation.expected_user_token,
    captured_at: nextCheckpoint.created_at,
    context_digest: context.context_digest,
    checkpoint_id: nextCheckpoint.checkpoint_id,
    checkpoint_sequence: nextCheckpoint.checkpoint_sequence,
    parent_checkpoint_id: nextCheckpoint.parent_checkpoint_id
  };
  receipt.receipt_digest = computeCanonicalDigest(receiptWithoutDigest(receipt));

  const result = {
    schema: 'ev4-builder-confirmation-result@1.0.0',
    transition_id: 'confirm-batch',
    status: 'accepted',
    source: { workflow_mode: session.workflow_mode, runtime_state: session.runtime_state },
    target: { workflow_mode: nextSession.workflow_mode, runtime_state: nextSession.runtime_state },
    confirmation_id: receipt.confirmation_id,
    session_id: receipt.session_id,
    package_digest: receipt.package_digest,
    selected_candidate_id: receipt.selected_candidate_id,
    batch_id: receipt.batch_id,
    confirmed_action_ids: [...receipt.confirmed_action_ids],
    receipt_digest: receipt.receipt_digest,
    resulting_checkpoint: {
      checkpoint_id: nextCheckpoint.checkpoint_id,
      checkpoint_sequence: nextCheckpoint.checkpoint_sequence,
      parent_checkpoint_id: nextCheckpoint.parent_checkpoint_id
    },
    builder_build_complete: false,
    responsive_complete: false,
    production_ready: false,
    publication: {
      atomic: true,
      output_directory: relativePath(outputDirectory),
      files: ['checkpoint.json', 'confirmation-receipt.json', 'confirmation-result.json', 'session-state.json']
    },
    blocking_diagnostics: []
  };
  return { nextCheckpoint, nextSession, receipt, result };
}

function validateGeneratedConfirmation(stageDirectory) {
  const base = validateGeneratedStatePair(stageDirectory, 'confirmation-result.json', 'BUILD_ACTIVE');
  const diagnostics = [...base.diagnostics];
  let receipt;
  try {
    receipt = readJson(path.join(stageDirectory, 'confirmation-receipt.json'));
  } catch (error) {
    diagnostics.push(diagnostic('BUILDER-CONFIRM-GENERATED-001', 'Generated Confirmation Receipt is unreadable.', error.message));
    return { passed: false, diagnostics };
  }
  if (!HASH.test(receipt.receipt_digest || '') || receipt.receipt_digest !== computeCanonicalDigest(receiptWithoutDigest(receipt))) diagnostics.push(diagnostic('BUILDER-CONFIRM-GENERATED-002', 'Generated Confirmation Receipt digest is invalid.'));
  if (base.checkpoint && (receipt.checkpoint_id !== base.checkpoint.checkpoint_id || receipt.checkpoint_sequence !== base.checkpoint.checkpoint_sequence || receipt.parent_checkpoint_id !== base.checkpoint.parent_checkpoint_id)) diagnostics.push(diagnostic('BUILDER-CONFIRM-GENERATED-003', 'Generated Confirmation Receipt does not bind the exact resulting Checkpoint.'));
  return { passed: diagnostics.length === 0, diagnostics, ...base, receipt };
}

export function publishConfirmationTransaction(options) {
  const validation = validateConfirmationTransaction(options);
  if (!validation.passed) return validation;
  const outputs = buildConfirmationOutputs(validation, options.outputDirectory);
  try {
    publishDirectoryAtomically(options.outputDirectory, {
      'session-state.json': outputs.nextSession,
      'checkpoint.json': outputs.nextCheckpoint,
      'confirmation-receipt.json': outputs.receipt,
      'confirmation-result.json': outputs.result
    }, options.validateStageOverride || validateGeneratedConfirmation);
  } catch (error) {
    return { ...validation, passed: false, diagnostics: [diagnostic('BUILDER-CONFIRM-TXN-007', 'Atomic Confirmation publication failed; no output was published.', error.message)] };
  }
  return { ...validation, ...outputs };
}

export function validateStrictConfirmationReceipt({ receiptFile, context, session, checkpoint }) {
  const diagnostics = [];
  let receipt;
  try {
    receipt = readJson(receiptFile);
  } catch (error) {
    return { passed: false, diagnostics: [diagnostic('BUILDER-CONFIRM-STRICT-001', 'Confirmation Receipt is unreadable or malformed.', error.message)], receipt: null };
  }
  if (receipt.schema !== 'ev4-builder-confirmation-receipt@1.0.0' || receipt.runtime_mode !== RUNTIME_MODES.REAL) diagnostics.push(diagnostic('BUILDER-CONFIRM-STRICT-002', 'Confirmation Receipt schema/runtime mode is invalid.'));
  if (!HASH.test(receipt.receipt_digest || '') || receipt.receipt_digest !== computeCanonicalDigest(receiptWithoutDigest(receipt))) diagnostics.push(diagnostic('BUILDER-CONFIRM-STRICT-003', 'Confirmation Receipt digest is invalid.'));
  if (receipt.context_digest !== context.context_digest) diagnostics.push(diagnostic('BUILDER-CONFIRM-STRICT-004', 'Confirmation Receipt Context binding is stale or foreign.'));
  if (receipt.session_id !== session.session_id) diagnostics.push(diagnostic('BUILDER-CONFIRM-STRICT-005', 'Confirmation Receipt Session binding is stale or foreign.'));
  if (receipt.package_digest !== context.canonical_package_digest) diagnostics.push(diagnostic('BUILDER-CONFIRM-STRICT-006', 'Confirmation Receipt Package binding is stale or foreign.'));
  if (receipt.selected_candidate_id !== context.selected_candidate_id) diagnostics.push(diagnostic('BUILDER-CONFIRM-STRICT-007', 'Confirmation Receipt Candidate binding is stale or foreign.'));
  if (receipt.confirmation_id !== context.confirmation.confirmation_id) diagnostics.push(diagnostic('BUILDER-CONFIRM-STRICT-008', 'Confirmation Receipt confirmation_id is stale or foreign.'));
  if (checkpoint.batch_id !== receipt.batch_id || receipt.batch_id !== context.action_batch.batch_id) diagnostics.push(diagnostic('BUILDER-CONFIRM-STRICT-009', 'Checkpoint, Receipt and Runtime Context do not bind the same exact Batch.'));
  if (receipt.checkpoint_id !== checkpoint.checkpoint_id || receipt.checkpoint_sequence !== checkpoint.checkpoint_sequence || receipt.parent_checkpoint_id !== checkpoint.parent_checkpoint_id) diagnostics.push(diagnostic('BUILDER-CONFIRM-STRICT-010', 'Confirmation Receipt does not bind the current confirmed Checkpoint identity and sequence.'));
  diagnostics.push(...validateCheckpointSequence(checkpoint, 'BUILDER-CONFIRM-STRICT-SEQ-001', 'Confirmed Checkpoint'));
  if (!sameSet(receipt.confirmed_action_ids, context.action_batch.action_ids)) diagnostics.push(diagnostic('BUILDER-CONFIRM-STRICT-011', 'Confirmation Receipt Action set is incomplete or foreign.'));
  if (sortedCanonicalJson(receipt.confirmed_action_digests) !== sortedCanonicalJson(context.action_batch.action_digests)) diagnostics.push(diagnostic('BUILDER-CONFIRM-STRICT-012', 'Confirmation Receipt Action body digests are stale or foreign.'));
  if (receipt.user_token !== context.confirmation.expected_user_token) diagnostics.push(diagnostic('BUILDER-CONFIRM-STRICT-013', 'Confirmation Receipt operator token is invalid.'));
  if (!sameSet(checkpoint.confirmed_action_ids, receipt.confirmed_action_ids) || (checkpoint.unconfirmed_action_ids || []).length !== 0) diagnostics.push(diagnostic('BUILDER-CONFIRM-STRICT-014', 'Current Checkpoint Action mirrors do not match the Receipt.'));
  return { passed: diagnostics.length === 0, diagnostics, receipt };
}

function safeEvidencePath(sourceRef) {
  if (typeof sourceRef !== 'string' || !sourceRef || path.isAbsolute(sourceRef)) return null;
  const candidate = resolvePath(sourceRef);
  const relative = path.relative(ROOT, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return candidate;
}

function claimSetCompatible(claimClasses) {
  if (claimClasses.length <= 1) return true;
  return ALLOWED_MULTI_CLAIM_SETS.has([...claimClasses].sort().join('|'));
}

export function verifyStrictEvidenceLedger({ checkpoint, context, session }) {
  const diagnostics = [];
  const records = new Map((checkpoint.evidence_ledger || []).map((entry) => [entry.evidence_id, entry]));
  const verified = [];
  const verifiedClaimClasses = new Set();
  const verifiedActionIds = new Set();

  for (const assertion of checkpoint.assertions || []) {
    const refs = Array.isArray(assertion.evidence_refs) ? assertion.evidence_refs : [];
    if (!refs.length) diagnostics.push(diagnostic('BUILDER-EVIDENCE-STRICT-001', `Assertion ${assertion.assertion_id} has no Evidence reference.`));
    for (const evidenceId of refs) {
      const local = [];
      const record = records.get(evidenceId);
      if (!record) {
        diagnostics.push(diagnostic('BUILDER-EVIDENCE-STRICT-002', `Assertion ${assertion.assertion_id} references unknown Evidence ${evidenceId}.`));
        continue;
      }
      if (record.status !== 'available') local.push(diagnostic('BUILDER-EVIDENCE-STRICT-003', `Evidence ${evidenceId} ledger status is not available.`));
      if (!(record.supports_claim_ids || []).includes(assertion.assertion_id)) local.push(diagnostic('BUILDER-EVIDENCE-STRICT-004', `Evidence ${evidenceId} record does not support the exact assertion ${assertion.assertion_id}.`));
      const sourcePath = safeEvidencePath(record.source_ref);
      if (!sourcePath) {
        diagnostics.push(...local, diagnostic('BUILDER-EVIDENCE-STRICT-005', `Evidence ${evidenceId} has an unsafe source_ref.`));
        continue;
      }
      let bytes;
      try {
        bytes = fs.readFileSync(sourcePath);
      } catch (error) {
        diagnostics.push(...local, diagnostic('BUILDER-EVIDENCE-STRICT-006', `Evidence source ${evidenceId} cannot be read.`, error.message));
        continue;
      }
      const actualSha = sha256Bytes(bytes);
      if (actualSha !== String(record.content_sha256 || '').toLowerCase()) local.push(diagnostic('BUILDER-EVIDENCE-STRICT-007', `Evidence ${evidenceId} hash does not match source bytes.`));
      let source;
      try {
        source = JSON.parse(bytes.toString('utf8'));
      } catch (error) {
        diagnostics.push(...local, diagnostic('BUILDER-EVIDENCE-STRICT-008', `Evidence ${evidenceId} must be machine-readable JSON.`, error.message));
        continue;
      }
      if (source.status !== 'verified' || typeof source.status !== 'string') {
        local.push(diagnostic('BUILDER-EVIDENCE-STRICT-009', `Evidence ${evidenceId} source.status must equal the exact string "verified".`));
      }
      if (source.schema !== 'ev4-builder-evidence-source@1.0.0') local.push(diagnostic('BUILDER-EVIDENCE-STRICT-010', `Evidence ${evidenceId} source schema is unsupported.`));
      if (source.evidence_type !== record.evidence_type) local.push(diagnostic('BUILDER-EVIDENCE-STRICT-011', `Evidence ${evidenceId} type does not match source content.`));
      if (!(source.claim_ids || []).includes(assertion.assertion_id)) local.push(diagnostic('BUILDER-EVIDENCE-STRICT-012', `Evidence ${evidenceId} source does not bind the exact assertion ${assertion.assertion_id}.`));
      if (source.subject_ref !== assertion.subject_ref) local.push(diagnostic('BUILDER-EVIDENCE-STRICT-013', `Evidence ${evidenceId} source and assertion subjects differ.`));
      if (source.session_id !== session.session_id) local.push(diagnostic('BUILDER-EVIDENCE-STRICT-014', `Evidence ${evidenceId} is bound to another Session.`));
      if (source.package_digest !== context.canonical_package_digest) local.push(diagnostic('BUILDER-EVIDENCE-STRICT-015', `Evidence ${evidenceId} is bound to another Package.`));
      if (scanSynthetic(source).length) local.push(diagnostic('BUILDER-EVIDENCE-STRICT-016', `Synthetic Evidence ${evidenceId} is forbidden.`));
      const claimClasses = Array.isArray(source.claim_classes) ? source.claim_classes : [];
      if (!claimClasses.length) local.push(diagnostic('BUILDER-EVIDENCE-STRICT-017', `Evidence ${evidenceId} has no claim_classes.`));
      if (!claimSetCompatible(claimClasses)) local.push(diagnostic('BUILDER-EVIDENCE-STRICT-018', `Evidence ${evidenceId} attempts incompatible claim reuse.`));
      for (const claimClass of claimClasses) {
        const allowedTypes = CLAIM_COMPATIBILITY[claimClass];
        if (!allowedTypes || !allowedTypes.includes(record.evidence_type)) local.push(diagnostic('BUILDER-EVIDENCE-STRICT-019', `Evidence ${evidenceId} type cannot satisfy ${claimClass}.`));
      }
      if (claimClasses.includes('required_action_execution')) {
        if (!context.action_batch.action_ids.includes(source.action_id)) local.push(diagnostic('BUILDER-EVIDENCE-STRICT-020', `Evidence ${evidenceId} action_id is missing or foreign.`));
        if (assertion.subject_ref !== source.action_id) local.push(diagnostic('BUILDER-EVIDENCE-STRICT-021', `Action execution assertion ${assertion.assertion_id} must use the exact Action ID as subject_ref.`));
        if (source.subject_ref !== source.action_id) local.push(diagnostic('BUILDER-EVIDENCE-STRICT-022', `Action execution Evidence ${evidenceId} must use the exact Action ID as source.subject_ref.`));
      }
      diagnostics.push(...local);
      if (!local.length) {
        verified.push({
          evidence_id: evidenceId,
          source_path: path.relative(ROOT, sourcePath),
          actual_sha256: actualSha,
          evidence_type: record.evidence_type,
          claim_classes: claimClasses,
          subject_ref: source.subject_ref,
          action_id: source.action_id ?? null,
          verification_status: 'verified'
        });
        claimClasses.forEach((claimClass) => verifiedClaimClasses.add(claimClass));
        if (claimClasses.includes('required_action_execution')) verifiedActionIds.add(source.action_id);
      }
    }
  }

  for (const actionId of context.action_batch.action_ids) {
    if (!verifiedActionIds.has(actionId)) diagnostics.push(diagnostic('BUILDER-EVIDENCE-STRICT-023', `Required Action ${actionId} lacks verified Action-specific execution Evidence.`));
  }
  for (const claimClass of REQUIRED_COMPLETION_CLAIMS) {
    if (!verifiedClaimClasses.has(claimClass)) diagnostics.push(diagnostic('BUILDER-EVIDENCE-STRICT-024', `Required Completion claim lacks verified compatible Evidence: ${claimClass}.`));
  }
  return {
    passed: diagnostics.length === 0,
    diagnostics,
    verified,
    verified_claim_classes: [...verifiedClaimClasses].sort(),
    verified_action_ids: [...verifiedActionIds].sort()
  };
}

export function validateStrictRealCompletion(options) {
  const diagnostics = [];
  const args = validateSourceModeArguments(options);
  diagnostics.push(...args.diagnostics);
  const contextVerification = args.passed ? verifyDerivedContext(options) : { passed: false, diagnostics: [], context: null };
  diagnostics.push(...contextVerification.diagnostics);
  let session;
  let checkpoint;
  try {
    session = readJson(options.sessionFile);
    checkpoint = readJson(options.checkpointFile);
  } catch (error) {
    return { passed: false, diagnostics: [...diagnostics, diagnostic('BUILDER-COMPLETE-STRICT-001', 'Completion carriers are unreadable or malformed.', error.message)] };
  }
  diagnostics.push(...validateCheckpointSequence(checkpoint, 'BUILDER-COMPLETE-STRICT-SEQ-001', 'Completion predecessor Checkpoint'));
  const context = contextVerification.context;
  if (context) diagnostics.push(...validateTransactionIdentity(context, session, checkpoint, 'BUILDER-COMPLETE-STRICT-ID'));
  if (session.workflow_mode !== 'APPROVED_HANDOFF_MODE' || session.runtime_state !== 'BUILD_ACTIVE' || session.current_state !== 'BUILD_ACTIVE' || checkpoint.workflow_mode !== 'APPROVED_HANDOFF_MODE' || checkpoint.runtime_state !== 'BUILD_ACTIVE') diagnostics.push(diagnostic('BUILDER-COMPLETE-STRICT-002', 'Real Completion requires matching APPROVED_HANDOFF_MODE / BUILD_ACTIVE carriers.'));
  const confirmation = context
    ? validateStrictConfirmationReceipt({ receiptFile: options.confirmationReceiptFile, context, session, checkpoint })
    : { passed: false, diagnostics: [diagnostic('BUILDER-COMPLETE-STRICT-003', 'Fresh Runtime Context is unavailable.')], receipt: null };
  diagnostics.push(...confirmation.diagnostics);
  const evidence = context
    ? verifyStrictEvidenceLedger({ checkpoint, context, session })
    : { passed: false, diagnostics: [diagnostic('BUILDER-COMPLETE-STRICT-004', 'Fresh Runtime Context is unavailable for Evidence verification.')], verified: [] };
  diagnostics.push(...evidence.diagnostics);

  const legacy = args.passed ? validateLegacyRealCompletion(options) : { passed: false, diagnostics: [] };
  diagnostics.push(...legacy.diagnostics);
  const generatedSequence = checkpointSequenceIsValid({ checkpoint_sequence: checkpoint.checkpoint_sequence + 1, parent_checkpoint_id: checkpoint.checkpoint_id });
  if (!generatedSequence) diagnostics.push(diagnostic('BUILDER-COMPLETE-STRICT-SEQ-002', 'Generated Completion Checkpoint sequence would be invalid.'));
  return {
    ...legacy,
    passed: args.passed && contextVerification.passed && confirmation.passed && evidence.passed && legacy.passed && diagnostics.length === 0,
    diagnostics,
    context,
    session,
    checkpoint,
    confirmation: confirmation.receipt,
    evidence
  };
}

export function publishStrictRealCompletion(options) {
  const strict = validateStrictRealCompletion(options);
  if (!strict.passed) return strict;
  try {
    const result = publishLegacyRealCompletion(options);
    if (!result.passed) return { ...result, diagnostics: [...strict.diagnostics, ...(result.diagnostics || [])] };
    const sequenceDiagnostics = validateCheckpointSequence(result.nextCheckpoint, 'BUILDER-COMPLETE-STRICT-SEQ-003', 'Generated Completion Checkpoint');
    if (sequenceDiagnostics.length) return { ...result, passed: false, diagnostics: sequenceDiagnostics };
    return { ...result, strict_evidence: strict.evidence };
  } catch (error) {
    return { ...strict, passed: false, diagnostics: [diagnostic('BUILDER-COMPLETE-STRICT-005', 'Atomic Completion publication failed.', error.message)] };
  }
}

export function validateCanonicalResume(options) {
  const result = validateResumeTransition(options);
  const diagnostics = [...result.diagnostics];
  if (result.checkpoint) diagnostics.push(...validateCheckpointSequence(result.checkpoint, 'BUILDER-RESUME-SEQ-101', 'Resume Checkpoint'));
  if (result.nextCheckpoint) diagnostics.push(...validateCheckpointSequence(result.nextCheckpoint, 'BUILDER-RESUME-SEQ-102', 'Generated Resume Checkpoint'));
  return { ...result, passed: result.passed && diagnostics.length === 0, diagnostics };
}
