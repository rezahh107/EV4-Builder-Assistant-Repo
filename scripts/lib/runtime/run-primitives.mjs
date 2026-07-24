import fs from 'node:fs';
import path from 'node:path';

import { computeCanonicalDigest, sha256Bytes } from '../canonical-builder-package.mjs';
import { SOURCE_MODES, RUNTIME_MODES, resolveExplicitBuilderSource } from '../builder-explicit-source-runtime.mjs';

export const ROOT = process.cwd();
export const HASH = /^[a-f0-9]{64}$/;
export const GENERATION_NAME = /^\d{6}$/;
export const SOURCE_MODE_VALUES = new Set(Object.values(SOURCE_MODES));
export const REQUIRED_COMPLETION_CLAIMS = Object.freeze([
  'scaffold_built',
  'structure_built',
  'content_filled',
  'desktop_layout_established',
  'layout_verified',
  'export_checked',
  'export_verified'
]);
export const ALLOWED_MULTI_CLAIM_SETS = new Set([
  ['desktop_layout_established', 'layout_verified'].sort().join('|'),
  ['export_checked', 'export_verified'].sort().join('|')
]);
export const ACTIVE_STATE_FILENAMES = Object.freeze([
  'run-manifest.json',
  'runtime-context.json',
  'session-state.json',
  'checkpoint.json'
]);
export const FORBIDDEN_TOP_LEVEL_AUTHORITY = Object.freeze(ACTIVE_STATE_FILENAMES);

export function diagnostic(code, message, detail = '') {
  return { code, message, ...(detail ? { detail } : {}) };
}

export function resolveRoot(value) {
  if (!value || typeof value !== 'string') throw new Error('A path is required.');
  return path.resolve(ROOT, value);
}

export function relativeRoot(value) {
  return path.relative(ROOT, path.resolve(value)).split(path.sep).join('/');
}

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function readBytes(file) {
  return fs.readFileSync(path.resolve(file));
}

export function readJson(file) {
  return JSON.parse(readBytes(file).toString('utf8'));
}

export function writeJson(file, value, flag = 'w') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, stableJson(value), { encoding: 'utf8', flag });
}

export function writeBytes(file, value, flag = 'w') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, { flag });
}

export function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

export function digestWithout(value, field) {
  const clone = structuredClone(value);
  delete clone[field];
  return computeCanonicalDigest(clone);
}

export function timestampForSequence(sequence) {
  return new Date((Math.max(1, sequence) - 1) * 1000).toISOString();
}

export function safeRunRef(runDirectory, ref) {
  if (typeof ref !== 'string' || !ref || path.isAbsolute(ref) || ref.includes('\\')) return null;
  const run = path.resolve(runDirectory);
  const candidate = path.resolve(run, ref);
  const relative = path.relative(run, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return candidate;
}

export function generationName(number) {
  if (!Number.isInteger(number) || number < 1 || number > 999999) throw new Error(`Invalid generation number: ${number}`);
  return String(number).padStart(6, '0');
}

export function generationRef(number) {
  return `generations/${generationName(number)}`;
}

export function sleepSync(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, Math.floor(milliseconds));
}

export function injectedPoint(requested, point) {
  const crashPoint = process.env.EV4_BUILDER_CRASH_POINT;
  if (crashPoint === point) process.exit(97);
  if (requested === point || process.env.EV4_BUILDER_FAILURE_POINT === point) {
    const error = new Error(`Injected failure at ${point}.`);
    error.code = 'RUN-INJECTED-FAILURE';
    error.failureStage = point;
    throw error;
  }
}

export function fsyncFile(file) {
  const descriptor = fs.openSync(file, 'r');
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

export function fsyncDirectory(directory) {
  try {
    const descriptor = fs.openSync(directory, 'r');
    try {
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
  } catch {
    // Directory fsync is not available on every supported platform.
  }
}

export function validateCanonicalSourceModeArguments({ sourceMode, sourceArtifactFile = null, builderInputFile = null }) {
  const diagnostics = [];
  if (sourceMode === SOURCE_MODES.PROJECT_GATE) {
    if (!sourceArtifactFile) diagnostics.push(diagnostic('RUN-SOURCE-001', 'project-gate requires sourceArtifactFile.'));
    if (!builderInputFile) diagnostics.push(diagnostic('RUN-SOURCE-002', 'project-gate requires builderInputFile.'));
  } else if (sourceMode === SOURCE_MODES.DIRECT_CE) {
    if (!sourceArtifactFile) diagnostics.push(diagnostic('RUN-SOURCE-003', 'direct-ce requires sourceArtifactFile.'));
    if (builderInputFile) diagnostics.push(diagnostic('RUN-SOURCE-004', 'direct-ce forbids builderInputFile.'));
  } else if (sourceMode === SOURCE_MODES.MANUAL_BUILDER_INPUT) {
    if (sourceArtifactFile) diagnostics.push(diagnostic('RUN-SOURCE-005', 'manual-builder-input forbids sourceArtifactFile.'));
    if (!builderInputFile) diagnostics.push(diagnostic('RUN-SOURCE-006', 'manual-builder-input requires builderInputFile.'));
  } else {
    diagnostics.push(diagnostic('RUN-SOURCE-007', `Unsupported explicit source mode: ${sourceMode}.`));
  }
  return { passed: diagnostics.length === 0, diagnostics };
}

export function normalizeContextForRun(context, sourceMode, logicalRunDirectory) {
  const selected = path.join(logicalRunDirectory, 'source', 'selected-source.json');
  const receipt = path.join(logicalRunDirectory, 'source', 'project-gate-receipt.json');
  const normalized = structuredClone(context);
  normalized.selected_source_ref = relativeRoot(selected);
  normalized.source_artifact_ref = sourceMode === SOURCE_MODES.PROJECT_GATE
    ? relativeRoot(receipt)
    : sourceMode === SOURCE_MODES.DIRECT_CE
      ? relativeRoot(selected)
      : null;
  normalized.builder_input_ref = sourceMode === SOURCE_MODES.DIRECT_CE ? null : relativeRoot(selected);
  delete normalized.context_digest;
  normalized.context_digest = computeCanonicalDigest(normalized);
  return normalized;
}

export function snapshotPaths(actualRunDirectory, sourceMode) {
  return {
    selectedSourceFile: path.join(actualRunDirectory, 'source', 'selected-source.json'),
    receiptFile: sourceMode === SOURCE_MODES.PROJECT_GATE
      ? path.join(actualRunDirectory, 'source', 'project-gate-receipt.json')
      : null
  };
}

export function deriveFromInternalSnapshot({ actualRunDirectory, logicalRunDirectory, sourceMode }) {
  const { selectedSourceFile, receiptFile } = snapshotPaths(actualRunDirectory, sourceMode);
  const resolution = resolveExplicitBuilderSource({
    sourceMode,
    sourceArtifactFile: sourceMode === SOURCE_MODES.PROJECT_GATE
      ? receiptFile
      : sourceMode === SOURCE_MODES.DIRECT_CE
        ? selectedSourceFile
        : null,
    builderInputFile: sourceMode === SOURCE_MODES.DIRECT_CE ? null : selectedSourceFile
  });
  if (!resolution.passed) return resolution;
  return {
    ...resolution,
    context: normalizeContextForRun(resolution.context, sourceMode, logicalRunDirectory)
  };
}

export function collectInitialBlockers(builderPackage) {
  const values = [
    ...(Array.isArray(builderPackage?.input_authorization?.blocking_diagnostics) ? builderPackage.input_authorization.blocking_diagnostics : []),
    ...(Array.isArray(builderPackage?.unresolved_blockers) ? builderPackage.unresolved_blockers : [])
  ].map((entry) => typeof entry === 'string' ? entry : entry?.code || entry?.id || JSON.stringify(entry));
  return [...new Set(values.filter(Boolean))].sort();
}

export function collectActiveBlockers(session, checkpoint) {
  const values = [
    ...(Array.isArray(session?.unresolved_evidence) ? session.unresolved_evidence : []),
    ...(Array.isArray(checkpoint?.unresolved_blockers) ? checkpoint.unresolved_blockers : []),
    ...(Array.isArray(checkpoint?.assertions)
      ? checkpoint.assertions
        .filter((entry) => ['not_checked', 'insufficient_evidence'].includes(entry?.status))
        .map((entry) => entry.assertion_id || entry.subject_ref || 'unresolved_assertion')
      : [])
  ];
  return [...new Set(values.filter((entry) => typeof entry === 'string' && entry))].sort();
}

export function buildCheckpoint({ runId, sessionId, context, sequence, parentId, state, confirmedActionIds, unconfirmedActionIds, unresolvedBlockers, assertions, evidenceLedger, createdFrom }) {
  return {
    schema: 'ev4-builder-checkpoint@0.2.0',
    checkpoint_id: `CP-${runId}-${String(sequence).padStart(4, '0')}`,
    checkpoint_sequence: sequence,
    parent_checkpoint_id: parentId,
    session_id: sessionId,
    package_id: `RUN-BUNDLE:${runId}`,
    package_sha256: context.builder_input_sha256,
    package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id,
    workflow_mode: 'APPROVED_HANDOFF_MODE',
    runtime_state: state,
    batch_id: context.action_batch.batch_id,
    confirmed_action_ids: [...confirmedActionIds],
    unconfirmed_action_ids: [...unconfirmedActionIds],
    unresolved_blockers: [...unresolvedBlockers],
    assertions: structuredClone(assertions),
    evidence_ledger: structuredClone(evidenceLedger),
    retry_policy: {
      max_retry_per_action: 3,
      retry_1: 'clarify_instruction',
      retry_2: 'request_targeted_screenshot',
      retry_3: 'enter_CORRECTION'
    },
    created_at: timestampForSequence(sequence),
    created_from: createdFrom
  };
}

export function stateCapsule(state, checkpoint, risk = 'low') {
  return `[STATE workflow=APPROVED_HANDOFF_MODE state=${state} cp=${checkpoint.checkpoint_id} batch=${checkpoint.batch_id} risk=${risk}]`;
}

export function buildSession({ sessionId, context, checkpoint, unresolvedEvidence = [] }) {
  return {
    schema: 'ev4-builder-session-state@0.1.0',
    session_id: sessionId,
    package_digest: context.canonical_package_digest,
    workflow_mode: 'APPROVED_HANDOFF_MODE',
    runtime_state: checkpoint.runtime_state,
    state_capsule: stateCapsule(checkpoint.runtime_state, checkpoint, collectActiveBlockers({ unresolved_evidence: unresolvedEvidence }, checkpoint).length ? 'blocked' : 'low'),
    current_state: checkpoint.runtime_state,
    selected_candidate_id: context.selected_candidate_id,
    last_verified_checkpoint: checkpoint,
    max_actions_per_turn: 5,
    active_warnings: [],
    unresolved_evidence: [...unresolvedEvidence]
  };
}

export function updateSessionForCheckpoint(session, checkpoint) {
  const next = structuredClone(session);
  next.workflow_mode = 'APPROVED_HANDOFF_MODE';
  next.runtime_state = checkpoint.runtime_state;
  next.current_state = checkpoint.runtime_state;
  next.last_verified_checkpoint = checkpoint;
  next.state_capsule = stateCapsule(checkpoint.runtime_state, checkpoint, collectActiveBlockers(next, checkpoint).length ? 'blocked' : 'low');
  if (checkpoint.runtime_state === 'COMPLETED') delete next.resume_target;
  return next;
}

export function buildManifest({
  previousManifest = null,
  runId,
  sourceMode,
  sourceSha,
  receiptSha,
  context,
  checkpoint,
  generationNumber,
  predecessorGeneration,
  predecessorCheckpointId,
  predecessorCheckpointSequence,
  updates = {}
}) {
  const ref = generationRef(generationNumber);
  const base = previousManifest ? structuredClone(previousManifest) : {
    schema: 'ev4-builder-run-manifest@1.0.0',
    run_id: runId,
    source_mode: sourceMode,
    source_snapshot_ref: 'source/selected-source.json',
    source_snapshot_sha256: sourceSha,
    receipt_snapshot_ref: sourceMode === SOURCE_MODES.PROJECT_GATE ? 'source/project-gate-receipt.json' : null,
    receipt_snapshot_sha256: receiptSha,
    active_emit_result_ref: null,
    active_confirmation_receipt_ref: null,
    active_confirmation_result_ref: null,
    confirmed_checkpoint_id: null,
    confirmed_checkpoint_sequence: null,
    evidence_snapshot_refs: [],
    evidence_attachment_result_refs: [],
    completion_result_ref: null,
    completion_status_ref: null,
    completion_gate_ref: null
  };
  Object.assign(base, updates);
  base.runtime_context_ref = `${ref}/runtime-context.json`;
  base.runtime_context_digest = context.context_digest;
  base.session_ref = `${ref}/session-state.json`;
  base.checkpoint_ref = `${ref}/checkpoint.json`;
  base.current_runtime_state = checkpoint.runtime_state;
  base.current_checkpoint_id = checkpoint.checkpoint_id;
  base.current_checkpoint_sequence = checkpoint.checkpoint_sequence;
  base.canonical_package_digest = context.canonical_package_digest;
  base.selected_candidate_id = context.selected_candidate_id;
  base.active_batch_id = context.action_batch.batch_id;
  base.generation = {
    number: generationNumber,
    ref,
    predecessor_generation: predecessorGeneration,
    predecessor_checkpoint_id: predecessorCheckpointId,
    predecessor_checkpoint_sequence: predecessorCheckpointSequence,
    resulting_checkpoint_id: checkpoint.checkpoint_id,
    resulting_checkpoint_sequence: checkpoint.checkpoint_sequence,
    runtime_state: checkpoint.runtime_state
  };
  base.manifest_digest = null;
  base.manifest_digest = digestWithout(base, 'manifest_digest');
  return base;
}

export function buildCurrentPointer(manifest, context, checkpoint) {
  const pointer = {
    schema: 'ev4-builder-current-generation@1.0.0',
    run_id: manifest.run_id,
    generation: manifest.generation.number,
    generation_ref: manifest.generation.ref,
    manifest_digest: manifest.manifest_digest,
    context_digest: context.context_digest,
    checkpoint_id: checkpoint.checkpoint_id,
    checkpoint_sequence: checkpoint.checkpoint_sequence,
    runtime_state: checkpoint.runtime_state,
    pointer_digest: null
  };
  pointer.pointer_digest = digestWithout(pointer, 'pointer_digest');
  return pointer;
}
