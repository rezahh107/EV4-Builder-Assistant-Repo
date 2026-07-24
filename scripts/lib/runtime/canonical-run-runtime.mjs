import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  computeCanonicalDigest,
  sha256Bytes,
  sortedCanonicalJson
} from '../canonical-builder-package.mjs';
import {
  SOURCE_MODES,
  RUNTIME_MODES,
  CLAIM_COMPATIBILITY,
  resolveExplicitBuilderSource
} from '../builder-explicit-source-runtime.mjs';
import { checkpointSequenceIsValid } from '../checkpoint-sequence.mjs';

const ROOT = process.cwd();
const HASH = /^[a-f0-9]{64}$/;
const SOURCE_MODE_VALUES = new Set(Object.values(SOURCE_MODES));
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

function resolveRoot(value) {
  if (!value || typeof value !== 'string') throw new Error('A path is required.');
  return path.resolve(ROOT, value);
}

function relativeRoot(value) {
  return path.relative(ROOT, path.resolve(value)).split(path.sep).join('/');
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readBytes(file) {
  return fs.readFileSync(path.resolve(file));
}

function readJson(file) {
  return JSON.parse(readBytes(file).toString('utf8'));
}

function writeJson(file, value, flag = 'w') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, stableJson(value), { encoding: 'utf8', flag });
}

function writeBytes(file, value, flag = 'w') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, { flag });
}

function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

function digestWithout(value, field) {
  const clone = structuredClone(value);
  delete clone[field];
  return computeCanonicalDigest(clone);
}

function timestampForSequence(sequence) {
  return new Date((Math.max(1, sequence) - 1) * 1000).toISOString();
}

function safeRunRef(runDirectory, ref) {
  if (typeof ref !== 'string' || !ref || path.isAbsolute(ref) || ref.includes('\\')) return null;
  const run = path.resolve(runDirectory);
  const candidate = path.resolve(run, ref);
  const relative = path.relative(run, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return candidate;
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

function normalizeContextForRun(context, sourceMode, logicalRunDirectory) {
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

function snapshotPaths(actualRunDirectory, sourceMode) {
  return {
    selectedSourceFile: path.join(actualRunDirectory, 'source', 'selected-source.json'),
    receiptFile: sourceMode === SOURCE_MODES.PROJECT_GATE
      ? path.join(actualRunDirectory, 'source', 'project-gate-receipt.json')
      : null
  };
}

function deriveFromInternalSnapshot({ actualRunDirectory, logicalRunDirectory, sourceMode }) {
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

function collectInitialBlockers(builderPackage) {
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

function buildCheckpoint({ runId, sessionId, context, sequence, parentId, state, confirmedActionIds, unconfirmedActionIds, unresolvedBlockers, assertions, evidenceLedger, createdFrom }) {
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

function stateCapsule(state, checkpoint, risk = 'low') {
  return `[STATE workflow=APPROVED_HANDOFF_MODE state=${state} cp=${checkpoint.checkpoint_id} batch=${checkpoint.batch_id} risk=${risk}]`;
}

function buildSession({ sessionId, context, checkpoint, unresolvedEvidence = [] }) {
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

function updateSessionForCheckpoint(session, checkpoint) {
  const next = structuredClone(session);
  next.workflow_mode = 'APPROVED_HANDOFF_MODE';
  next.runtime_state = checkpoint.runtime_state;
  next.current_state = checkpoint.runtime_state;
  next.last_verified_checkpoint = checkpoint;
  next.state_capsule = stateCapsule(checkpoint.runtime_state, checkpoint, collectActiveBlockers(next, checkpoint).length ? 'blocked' : 'low');
  if (checkpoint.runtime_state === 'COMPLETED') delete next.resume_target;
  return next;
}

function buildManifest({ runId, sourceMode, sourceSha, receiptSha, context, checkpoint }) {
  const manifest = {
    schema: 'ev4-builder-run-manifest@1.0.0',
    run_id: runId,
    source_mode: sourceMode,
    source_snapshot_ref: 'source/selected-source.json',
    source_snapshot_sha256: sourceSha,
    receipt_snapshot_ref: sourceMode === SOURCE_MODES.PROJECT_GATE ? 'source/project-gate-receipt.json' : null,
    receipt_snapshot_sha256: receiptSha,
    runtime_context_ref: 'runtime-context.json',
    runtime_context_digest: context.context_digest,
    session_ref: 'session-state.json',
    checkpoint_ref: 'checkpoint.json',
    current_runtime_state: checkpoint.runtime_state,
    current_checkpoint_id: checkpoint.checkpoint_id,
    current_checkpoint_sequence: checkpoint.checkpoint_sequence,
    canonical_package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id,
    active_batch_id: context.action_batch.batch_id,
    active_emit_result_ref: null,
    active_confirmation_receipt_ref: null,
    active_confirmation_result_ref: null,
    confirmed_checkpoint_id: null,
    confirmed_checkpoint_sequence: null,
    evidence_snapshot_refs: [],
    evidence_attachment_result_refs: [],
    completion_result_ref: null,
    completion_status_ref: null,
    completion_gate_ref: null,
    manifest_digest: null
  };
  manifest.manifest_digest = digestWithout(manifest, 'manifest_digest');
  return manifest;
}

function refreshManifest(manifest, context, checkpoint, updates = {}) {
  const next = { ...manifest, ...updates };
  next.runtime_context_digest = context.context_digest;
  next.current_runtime_state = checkpoint.runtime_state;
  next.current_checkpoint_id = checkpoint.checkpoint_id;
  next.current_checkpoint_sequence = checkpoint.checkpoint_sequence;
  next.canonical_package_digest = context.canonical_package_digest;
  next.selected_candidate_id = context.selected_candidate_id;
  next.active_batch_id = context.action_batch.batch_id;
  next.manifest_digest = null;
  next.manifest_digest = digestWithout(next, 'manifest_digest');
  return next;
}

function validateManifestShape(manifest) {
  const diagnostics = [];
  if (manifest?.schema !== 'ev4-builder-run-manifest@1.0.0') diagnostics.push(diagnostic('RUN-MANIFEST-001', 'Unsupported Run manifest schema.'));
  if (typeof manifest?.run_id !== 'string' || !manifest.run_id) diagnostics.push(diagnostic('RUN-MANIFEST-002', 'Run manifest run_id is missing.'));
  if (!SOURCE_MODE_VALUES.has(manifest?.source_mode)) diagnostics.push(diagnostic('RUN-MANIFEST-003', 'Run manifest source_mode is invalid.'));
  if (!HASH.test(manifest?.source_snapshot_sha256 || '')) diagnostics.push(diagnostic('RUN-MANIFEST-004', 'Run manifest source snapshot hash is invalid.'));
  if (manifest?.source_mode === SOURCE_MODES.PROJECT_GATE) {
    if (manifest.receipt_snapshot_ref !== 'source/project-gate-receipt.json' || !HASH.test(manifest.receipt_snapshot_sha256 || '')) diagnostics.push(diagnostic('RUN-MANIFEST-005', 'Project Gate Run manifest Receipt snapshot binding is invalid.'));
  } else if (manifest?.receipt_snapshot_ref !== null || manifest?.receipt_snapshot_sha256 !== null) {
    diagnostics.push(diagnostic('RUN-MANIFEST-006', 'Non-Project-Gate Run must use null Receipt fields.'));
  }
  for (const field of ['runtime_context_digest', 'canonical_package_digest']) {
    if (!HASH.test(manifest?.[field] || '')) diagnostics.push(diagnostic('RUN-MANIFEST-007', `Run manifest ${field} is invalid.`));
  }
  if (!Number.isInteger(manifest?.current_checkpoint_sequence) || manifest.current_checkpoint_sequence < 1) diagnostics.push(diagnostic('RUN-MANIFEST-008', 'Run manifest current_checkpoint_sequence is invalid.'));
  if (!HASH.test(manifest?.manifest_digest || '') || manifest.manifest_digest !== digestWithout(manifest, 'manifest_digest')) diagnostics.push(diagnostic('RUN-MANIFEST-009', 'Run manifest digest is invalid.'));
  return diagnostics;
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
    .slice(-12)
    .join(' | ')
    .slice(0, 2000);
  return { passed: !result.error && result.status === 0, detail };
}

function validateStateFiles(runDirectory, prefix) {
  const diagnostics = [];
  const session = runNode('scripts/validate-session-state.mjs', path.join(runDirectory, 'session-state.json'));
  const checkpoint = runNode('scripts/validate-checkpoint.mjs', path.join(runDirectory, 'checkpoint.json'));
  if (!session.passed) diagnostics.push(diagnostic(`${prefix}-SESSION`, 'Session semantic validation failed.', session.detail));
  if (!checkpoint.passed) diagnostics.push(diagnostic(`${prefix}-CHECKPOINT`, 'Checkpoint semantic validation failed.', checkpoint.detail));
  return diagnostics;
}

function loadRun(runDirectory) {
  const run = resolveRoot(runDirectory);
  const diagnostics = [];
  if (!fs.existsSync(run) || !fs.statSync(run).isDirectory()) {
    return { passed: false, diagnostics: [diagnostic('RUN-LOAD-001', 'Run directory does not exist.')], runDirectory: run };
  }
  let manifest;
  let context;
  let session;
  let checkpoint;
  try {
    manifest = readJson(path.join(run, 'run-manifest.json'));
    context = readJson(path.join(run, 'runtime-context.json'));
    session = readJson(path.join(run, 'session-state.json'));
    checkpoint = readJson(path.join(run, 'checkpoint.json'));
  } catch (error) {
    return { passed: false, diagnostics: [diagnostic('RUN-LOAD-002', 'Run bundle is incomplete or malformed.', error.message)], runDirectory: run };
  }
  diagnostics.push(...validateManifestShape(manifest));
  if (context?.schema !== 'ev4-builder-verified-context@1.0.0' || context?.runtime_mode !== RUNTIME_MODES.REAL) diagnostics.push(diagnostic('RUN-CONTEXT-001', 'Stored Runtime Context schema/runtime mode is invalid.'));
  if (!HASH.test(context?.context_digest || '') || context.context_digest !== digestWithout(context, 'context_digest')) diagnostics.push(diagnostic('RUN-CONTEXT-002', 'Stored Runtime Context digest is invalid.'));
  if (!checkpointSequenceIsValid(checkpoint)) diagnostics.push(diagnostic('RUN-STATE-001', 'Current Checkpoint sequence/parent shape is invalid.'));
  if (session?.last_verified_checkpoint && sortedCanonicalJson(session.last_verified_checkpoint) !== sortedCanonicalJson(checkpoint)) diagnostics.push(diagnostic('RUN-STATE-002', 'Current Session does not embed the exact current Checkpoint.'));
  if (session?.session_id !== checkpoint?.session_id) diagnostics.push(diagnostic('RUN-STATE-003', 'Current Session and Checkpoint IDs differ.'));
  if (session?.package_digest !== context?.canonical_package_digest || checkpoint?.package_digest !== context?.canonical_package_digest) diagnostics.push(diagnostic('RUN-STATE-004', 'Current Session/Checkpoint Package binding differs from Context.'));
  if (session?.selected_candidate_id !== context?.selected_candidate_id || checkpoint?.selected_candidate_id !== context?.selected_candidate_id) diagnostics.push(diagnostic('RUN-STATE-005', 'Current Session/Checkpoint Candidate binding differs from Context.'));
  if (checkpoint?.batch_id !== context?.action_batch?.batch_id || manifest?.active_batch_id !== context?.action_batch?.batch_id) diagnostics.push(diagnostic('RUN-STATE-006', 'Current Checkpoint/manifest Batch binding differs from Context.'));
  if (session?.runtime_state !== checkpoint?.runtime_state || session?.current_state !== checkpoint?.runtime_state || manifest?.current_runtime_state !== checkpoint?.runtime_state) diagnostics.push(diagnostic('RUN-STATE-007', 'Run State carriers are inconsistent.'));
  if (manifest?.runtime_context_digest !== context?.context_digest) diagnostics.push(diagnostic('RUN-STATE-008', 'Run manifest Context digest is stale.'));
  if (manifest?.current_checkpoint_id !== checkpoint?.checkpoint_id || manifest?.current_checkpoint_sequence !== checkpoint?.checkpoint_sequence) diagnostics.push(diagnostic('RUN-STATE-009', 'Run manifest current Checkpoint pointer is stale.'));
  if (manifest?.canonical_package_digest !== context?.canonical_package_digest || manifest?.selected_candidate_id !== context?.selected_candidate_id) diagnostics.push(diagnostic('RUN-STATE-010', 'Run manifest Package/Candidate binding is stale.'));
  const sourceFile = safeRunRef(run, manifest?.source_snapshot_ref);
  if (!sourceFile || !fs.existsSync(sourceFile)) diagnostics.push(diagnostic('RUN-SNAPSHOT-001', 'Internal source snapshot is missing or unsafe.'));
  else if (sha256Bytes(readBytes(sourceFile)) !== manifest.source_snapshot_sha256) diagnostics.push(diagnostic('RUN-SNAPSHOT-002', 'Internal source snapshot hash differs from Run manifest.'));
  if (manifest?.receipt_snapshot_ref) {
    const receiptFile = safeRunRef(run, manifest.receipt_snapshot_ref);
    if (!receiptFile || !fs.existsSync(receiptFile)) diagnostics.push(diagnostic('RUN-SNAPSHOT-003', 'Internal Receipt snapshot is missing or unsafe.'));
    else if (sha256Bytes(readBytes(receiptFile)) !== manifest.receipt_snapshot_sha256) diagnostics.push(diagnostic('RUN-SNAPSHOT-004', 'Internal Receipt snapshot hash differs from Run manifest.'));
  }
  diagnostics.push(...validateStateFiles(run, 'RUN-STATE'));
  return { passed: diagnostics.length === 0, diagnostics, runDirectory: run, manifest, context, session, checkpoint };
}

function fullDeriveAndCompare(loaded) {
  const derivation = deriveFromInternalSnapshot({
    actualRunDirectory: loaded.runDirectory,
    logicalRunDirectory: loaded.runDirectory,
    sourceMode: loaded.manifest.source_mode
  });
  const diagnostics = [...(derivation.diagnostics || [])];
  if (derivation.context && sortedCanonicalJson(derivation.context) !== sortedCanonicalJson(loaded.context)) diagnostics.push(diagnostic('RUN-DERIVE-001', 'Stored Runtime Context differs from full derivation from the internal source snapshot.'));
  if (derivation.context?.selected_candidate_id !== loaded.manifest.selected_candidate_id) diagnostics.push(diagnostic('RUN-DERIVE-002', 'Candidate drift detected.'));
  if (derivation.context?.canonical_package_digest !== loaded.manifest.canonical_package_digest) diagnostics.push(diagnostic('RUN-DERIVE-003', 'Package digest drift detected.'));
  if (derivation.context?.action_batch?.batch_id !== loaded.manifest.active_batch_id) diagnostics.push(diagnostic('RUN-DERIVE-004', 'Batch drift detected.'));
  if (!sameSet(derivation.context?.action_batch?.action_ids, loaded.context?.action_batch?.action_ids)) diagnostics.push(diagnostic('RUN-DERIVE-005', 'Action ID drift detected.'));
  if (sortedCanonicalJson(derivation.context?.action_batch?.action_digests) !== sortedCanonicalJson(loaded.context?.action_batch?.action_digests)) diagnostics.push(diagnostic('RUN-DERIVE-006', 'Action body digest drift detected.'));
  if (derivation.context?.confirmation?.confirmation_id !== loaded.context?.confirmation?.confirmation_id || derivation.context?.confirmation?.expected_user_token !== loaded.context?.confirmation?.expected_user_token) diagnostics.push(diagnostic('RUN-DERIVE-007', 'Confirmation binding drift detected.'));
  return { ...derivation, passed: derivation.passed && diagnostics.length === 0, diagnostics };
}

function validatePublication(result, expectedFiles, expectedSchema, expectedRunId) {
  const diagnostics = [];
  if (result?.schema !== expectedSchema) diagnostics.push(diagnostic('RUN-ARTIFACT-001', `Expected ${expectedSchema}.`));
  if (result?.run_id !== expectedRunId) diagnostics.push(diagnostic('RUN-ARTIFACT-002', 'Generated artifact Run ID is incorrect.'));
  if (result?.status !== 'accepted' || (result?.blocking_diagnostics || []).length !== 0) diagnostics.push(diagnostic('RUN-ARTIFACT-003', 'Generated accepted artifact is not truthfully accepted.'));
  if (!sameSet(result?.publication?.files, expectedFiles)) diagnostics.push(diagnostic('RUN-ARTIFACT-004', 'Generated artifact publication file set is incorrect.'));
  if (result?.responsive_complete !== false || result?.production_ready !== false) diagnostics.push(diagnostic('RUN-ARTIFACT-005', 'Generated artifact overclaims Responsive or production readiness.'));
  return diagnostics;
}

function replaceRunAtomically(runDirectory, mutate, validate, failureInjection = null) {
  const target = resolveRoot(runDirectory);
  const parent = path.dirname(target);
  const stage = path.join(parent, `.${path.basename(target)}.stage-${process.pid}-${Date.now()}`);
  const backup = path.join(parent, `.${path.basename(target)}.backup-${process.pid}-${Date.now()}`);
  if (!fs.existsSync(target)) throw new Error('Run directory does not exist.');
  fs.cpSync(target, stage, { recursive: true, errorOnExist: true, force: false });
  try {
    mutate(stage);
    const validation = validate(stage);
    if (!validation.passed) throw new Error(`Generated Run validation failed: ${JSON.stringify(validation.diagnostics)}`);
    if (failureInjection === 'before_commit') throw new Error('Injected atomic publication failure.');
    fs.renameSync(target, backup);
    try {
      fs.renameSync(stage, target);
      fs.rmSync(backup, { recursive: true, force: true });
    } catch (error) {
      if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
      if (fs.existsSync(backup)) fs.renameSync(backup, target);
      throw error;
    }
  } finally {
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
    if (fs.existsSync(backup) && !fs.existsSync(target)) fs.renameSync(backup, target);
    else if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
  }
}

function initializeStage({ stage, logicalRunDirectory, sourceMode, sourceArtifactFile, builderInputFile }) {
  for (const directory of ['source', 'transitions/emit-batch', 'transitions/confirmation', 'transitions/evidence', 'transitions/completion', 'evidence', 'outputs']) {
    fs.mkdirSync(path.join(stage, directory), { recursive: true });
  }
  const selectedExternal = sourceMode === SOURCE_MODES.DIRECT_CE ? sourceArtifactFile : builderInputFile;
  const selectedBytes = readBytes(resolveRoot(selectedExternal));
  writeBytes(path.join(stage, 'source', 'selected-source.json'), selectedBytes, 'wx');
  let receiptSha = null;
  if (sourceMode === SOURCE_MODES.PROJECT_GATE) {
    const receiptBytes = readBytes(resolveRoot(sourceArtifactFile));
    writeBytes(path.join(stage, 'source', 'project-gate-receipt.json'), receiptBytes, 'wx');
    receiptSha = sha256Bytes(receiptBytes);
  }
  const sourceSha = sha256Bytes(selectedBytes);
  const derivation = deriveFromInternalSnapshot({ actualRunDirectory: stage, logicalRunDirectory, sourceMode });
  if (!derivation.passed) throw new Error(JSON.stringify(derivation.diagnostics));
  const context = derivation.context;
  const runId = `RUN-${computeCanonicalDigest({
    source_mode: sourceMode,
    source_snapshot_sha256: sourceSha,
    receipt_snapshot_sha256: receiptSha,
    canonical_package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id,
    run_directory: relativeRoot(logicalRunDirectory)
  }).slice(0, 20)}`;
  const sessionId = `SESSION-${runId.slice(4)}`;
  const initialBlockers = collectInitialBlockers(derivation.builderPackage);
  const checkpoint = buildCheckpoint({
    runId,
    sessionId,
    context,
    sequence: 1,
    parentId: null,
    state: 'BUILD_ACTIVE',
    confirmedActionIds: [],
    unconfirmedActionIds: context.action_batch.action_ids,
    unresolvedBlockers: initialBlockers,
    assertions: [{
      assertion_id: 'ASSERT-RUN-CONTEXT-INITIALIZED',
      subject_ref: runId,
      claim: 'runtime_context_initialized',
      status: 'not_applicable',
      evidence_refs: []
    }],
    evidenceLedger: [],
    createdFrom: 'initial'
  });
  const session = buildSession({ sessionId, context, checkpoint, unresolvedEvidence: initialBlockers });
  const manifest = buildManifest({ runId, sourceMode, sourceSha, receiptSha, context, checkpoint });
  const files = ['checkpoint.json', 'real-intake-result.json', 'run-manifest.json', 'runtime-context.json', 'session-state.json', 'source/selected-source.json'];
  if (sourceMode === SOURCE_MODES.PROJECT_GATE) files.push('source/project-gate-receipt.json');
  const result = {
    schema: 'ev4-builder-real-intake-result@2.0.0',
    run_id: runId,
    transition_id: 'real-intake',
    status: 'accepted',
    source_mode: sourceMode,
    source_snapshot_sha256: sourceSha,
    receipt_snapshot_sha256: receiptSha,
    context_digest: context.context_digest,
    package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id,
    batch_id: context.action_batch.batch_id,
    action_ids: [...context.action_batch.action_ids],
    action_digests: { ...context.action_batch.action_digests },
    resulting_checkpoint: {
      checkpoint_id: checkpoint.checkpoint_id,
      checkpoint_sequence: checkpoint.checkpoint_sequence,
      parent_checkpoint_id: checkpoint.parent_checkpoint_id
    },
    runtime_state: 'BUILD_ACTIVE',
    builder_build_complete: false,
    responsive_complete: false,
    production_ready: false,
    publication: { atomic: true, files: files.sort() },
    blocking_diagnostics: []
  };
  writeJson(path.join(stage, 'runtime-context.json'), context, 'wx');
  writeJson(path.join(stage, 'session-state.json'), session, 'wx');
  writeJson(path.join(stage, 'checkpoint.json'), checkpoint, 'wx');
  writeJson(path.join(stage, 'real-intake-result.json'), result, 'wx');
  writeJson(path.join(stage, 'run-manifest.json'), manifest, 'wx');
  return { manifest, context, session, checkpoint, result };
}

export function initializeAtomicRun({ sourceMode, sourceArtifactFile = null, builderInputFile = null, runDirectory, failureInjection = null }) {
  const args = validateCanonicalSourceModeArguments({ sourceMode, sourceArtifactFile, builderInputFile });
  if (!args.passed) return { passed: false, diagnostics: args.diagnostics };
  const target = resolveRoot(runDirectory);
  if (fs.existsSync(target)) return { passed: false, diagnostics: [diagnostic('RUN-INTAKE-001', 'Target Run directory already exists.')] };
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });
  const stage = path.join(parent, `.${path.basename(target)}.init-${process.pid}-${Date.now()}`);
  fs.mkdirSync(stage, { recursive: false });
  try {
    const output = initializeStage({ stage, logicalRunDirectory: target, sourceMode, sourceArtifactFile, builderInputFile });
    const loaded = loadRun(stage);
    const derived = loaded.passed ? deriveFromInternalSnapshot({ actualRunDirectory: stage, logicalRunDirectory: target, sourceMode }) : { passed: false, diagnostics: [] };
    const diagnostics = [...loaded.diagnostics, ...(derived.diagnostics || [])];
    if (derived.context && sortedCanonicalJson(derived.context) !== sortedCanonicalJson(output.context)) diagnostics.push(diagnostic('RUN-INTAKE-002', 'Generated Context does not match internal snapshot derivation.'));
    diagnostics.push(...validatePublication(output.result, output.result.publication.files, 'ev4-builder-real-intake-result@2.0.0', output.manifest.run_id));
    if (diagnostics.length) throw new Error(JSON.stringify(diagnostics));
    if (failureInjection === 'before_commit') throw new Error('Injected atomic Intake publication failure.');
    fs.renameSync(stage, target);
    return { passed: true, diagnostics: [], ...output, runDirectory: target };
  } catch (error) {
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
    return { passed: false, diagnostics: [diagnostic('RUN-INTAKE-003', 'Atomic Run initialization failed; no Run was published.', error.message)] };
  }
}

function loadTransitionResult(run, ref, expectedSchema) {
  const file = safeRunRef(run, ref);
  if (!file || !fs.existsSync(file)) throw new Error(`Transition result is missing or unsafe: ${ref}`);
  const value = readJson(file);
  if (value.schema !== expectedSchema) throw new Error(`Unexpected transition result schema: ${value.schema}`);
  return value;
}

export function emitRunBatch({ runDirectory, failureInjection = null }) {
  const loaded = loadRun(runDirectory);
  if (!loaded.passed) return loaded;
  const derivation = fullDeriveAndCompare(loaded);
  const diagnostics = [...derivation.diagnostics];
  const { manifest, context, session, checkpoint } = loaded;
  if (manifest.active_emit_result_ref || manifest.active_confirmation_receipt_ref) diagnostics.push(diagnostic('RUN-EMIT-001', 'Action Batch was already emitted or confirmed for this Run.'));
  if (checkpoint.runtime_state !== 'BUILD_ACTIVE' || session.runtime_state !== 'BUILD_ACTIVE') diagnostics.push(diagnostic('RUN-EMIT-002', 'emit-batch requires BUILD_ACTIVE Run carriers.'));
  if (!sameSet(checkpoint.unconfirmed_action_ids, context.action_batch.action_ids) || (checkpoint.confirmed_action_ids || []).length !== 0) diagnostics.push(diagnostic('RUN-EMIT-003', 'Initial Action mirrors do not match the complete derived Action set.'));
  const blockers = collectActiveBlockers(session, checkpoint);
  if (blockers.length) diagnostics.push(diagnostic('RUN-EMIT-004', `Action emission is blocked by: ${blockers.join(', ')}.`));
  if (diagnostics.length) return { ...loaded, passed: false, diagnostics, active_blockers: blockers };
  const transitionId = `EMIT-${computeCanonicalDigest({ run_id: manifest.run_id, context_digest: context.context_digest, predecessor: checkpoint.checkpoint_id }).slice(0, 16)}`;
  const relativeTransition = `transitions/emit-batch/${transitionId}`;
  const resulting = buildCheckpoint({
    runId: manifest.run_id,
    sessionId: session.session_id,
    context,
    sequence: checkpoint.checkpoint_sequence + 1,
    parentId: checkpoint.checkpoint_id,
    state: 'WAITING_FOR_CONFIRMATION',
    confirmedActionIds: [],
    unconfirmedActionIds: context.action_batch.action_ids,
    unresolvedBlockers: checkpoint.unresolved_blockers || [],
    assertions: checkpoint.assertions,
    evidenceLedger: checkpoint.evidence_ledger,
    createdFrom: 'initial'
  });
  const nextSession = updateSessionForCheckpoint(session, resulting);
  const files = [`${relativeTransition}/checkpoint.json`, `${relativeTransition}/emit-batch-result.json`, `${relativeTransition}/session-state.json`, 'checkpoint.json', 'run-manifest.json', 'session-state.json'].sort();
  const result = {
    schema: 'ev4-builder-emit-batch-result@2.0.0',
    run_id: manifest.run_id,
    transition_id: transitionId,
    status: 'accepted',
    source_snapshot_sha256: manifest.source_snapshot_sha256,
    context_digest: context.context_digest,
    package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id,
    batch_id: context.action_batch.batch_id,
    action_ids: [...context.action_batch.action_ids],
    action_digests: { ...context.action_batch.action_digests },
    predecessor_checkpoint: { checkpoint_id: checkpoint.checkpoint_id, checkpoint_sequence: checkpoint.checkpoint_sequence },
    resulting_checkpoint: { checkpoint_id: resulting.checkpoint_id, checkpoint_sequence: resulting.checkpoint_sequence, parent_checkpoint_id: resulting.parent_checkpoint_id },
    runtime_state: 'WAITING_FOR_CONFIRMATION',
    builder_build_complete: false,
    responsive_complete: false,
    production_ready: false,
    publication: { atomic: true, files },
    blocking_diagnostics: []
  };
  try {
    replaceRunAtomically(runDirectory, (stage) => {
      const transition = path.join(stage, relativeTransition);
      if (fs.existsSync(transition)) throw new Error('emit-batch transition already exists.');
      fs.mkdirSync(transition, { recursive: false });
      writeJson(path.join(transition, 'session-state.json'), nextSession, 'wx');
      writeJson(path.join(transition, 'checkpoint.json'), resulting, 'wx');
      writeJson(path.join(transition, 'emit-batch-result.json'), result, 'wx');
      writeJson(path.join(stage, 'session-state.json'), nextSession);
      writeJson(path.join(stage, 'checkpoint.json'), resulting);
      writeJson(path.join(stage, 'run-manifest.json'), refreshManifest(manifest, context, resulting, { active_emit_result_ref: `${relativeTransition}/emit-batch-result.json` }));
    }, (stage) => {
      const check = loadRun(stage);
      const localDiagnostics = [...check.diagnostics];
      const stagedResult = readJson(path.join(stage, relativeTransition, 'emit-batch-result.json'));
      localDiagnostics.push(...validatePublication(stagedResult, files, 'ev4-builder-emit-batch-result@2.0.0', manifest.run_id));
      if (stagedResult.resulting_checkpoint?.checkpoint_id !== check.checkpoint?.checkpoint_id || stagedResult.predecessor_checkpoint?.checkpoint_id !== checkpoint.checkpoint_id) localDiagnostics.push(diagnostic('RUN-EMIT-005', 'emit-batch result Checkpoint binding is invalid.'));
      return { passed: localDiagnostics.length === 0, diagnostics: localDiagnostics };
    }, failureInjection);
    return { passed: true, diagnostics: [], result, nextSession, nextCheckpoint: resulting };
  } catch (error) {
    return { ...loaded, passed: false, diagnostics: [diagnostic('RUN-EMIT-006', 'Atomic emit-batch failed; active Run pointers were not modified.', error.message)] };
  }
}

function validateEmitBinding(loaded) {
  const diagnostics = [];
  let emitResult = null;
  try {
    emitResult = loadTransitionResult(loaded.runDirectory, loaded.manifest.active_emit_result_ref, 'ev4-builder-emit-batch-result@2.0.0');
  } catch (error) {
    return { passed: false, diagnostics: [diagnostic('RUN-CONFIRM-001', 'Active emit-batch result is unavailable.', error.message)], emitResult };
  }
  const { context, checkpoint, manifest } = loaded;
  if (emitResult.run_id !== manifest.run_id || emitResult.context_digest !== context.context_digest) diagnostics.push(diagnostic('RUN-CONFIRM-002', 'emit-batch Run/Context binding is stale.'));
  if (emitResult.source_snapshot_sha256 !== manifest.source_snapshot_sha256) diagnostics.push(diagnostic('RUN-CONFIRM-003', 'emit-batch source snapshot binding is stale.'));
  if (emitResult.package_digest !== context.canonical_package_digest || emitResult.selected_candidate_id !== context.selected_candidate_id || emitResult.batch_id !== context.action_batch.batch_id) diagnostics.push(diagnostic('RUN-CONFIRM-004', 'emit-batch Package/Candidate/Batch binding is stale.'));
  if (!sameSet(emitResult.action_ids, context.action_batch.action_ids) || sortedCanonicalJson(emitResult.action_digests) !== sortedCanonicalJson(context.action_batch.action_digests)) diagnostics.push(diagnostic('RUN-CONFIRM-005', 'emit-batch Action binding is stale.'));
  if (emitResult.resulting_checkpoint?.checkpoint_id !== checkpoint.checkpoint_id || emitResult.resulting_checkpoint?.checkpoint_sequence !== checkpoint.checkpoint_sequence || emitResult.resulting_checkpoint?.parent_checkpoint_id !== checkpoint.parent_checkpoint_id) diagnostics.push(diagnostic('RUN-CONFIRM-006', 'Current WAITING Checkpoint is not the exact emitted Checkpoint.'));
  return { passed: diagnostics.length === 0, diagnostics, emitResult };
}

export function confirmRunBatch({ runDirectory, userToken, failureInjection = null }) {
  const loaded = loadRun(runDirectory);
  if (!loaded.passed) return loaded;
  const diagnostics = [];
  const { manifest, context, session, checkpoint } = loaded;
  if (manifest.active_confirmation_receipt_ref) diagnostics.push(diagnostic('RUN-CONFIRM-007', 'Action Batch is already confirmed.'));
  if (checkpoint.runtime_state !== 'WAITING_FOR_CONFIRMATION' || session.runtime_state !== 'WAITING_FOR_CONFIRMATION') diagnostics.push(diagnostic('RUN-CONFIRM-008', 'confirm-batch accepts only WAITING_FOR_CONFIRMATION Run carriers.'));
  if ((checkpoint.confirmed_action_ids || []).length !== 0 || !sameSet(checkpoint.unconfirmed_action_ids, context.action_batch.action_ids)) diagnostics.push(diagnostic('RUN-CONFIRM-009', 'WAITING Checkpoint Action mirrors are invalid.'));
  if (checkpoint.batch_id !== context.action_batch.batch_id) diagnostics.push(diagnostic('RUN-CONFIRM-010', 'WAITING Checkpoint Batch binding is invalid.'));
  if (userToken !== context.confirmation.expected_user_token) diagnostics.push(diagnostic('RUN-CONFIRM-011', 'Operator token does not match the active Confirmation binding.'));
  const blockers = collectActiveBlockers(session, checkpoint);
  if (blockers.length) diagnostics.push(diagnostic('RUN-CONFIRM-012', `Confirmation is blocked by: ${blockers.join(', ')}.`));
  const emit = validateEmitBinding(loaded);
  diagnostics.push(...emit.diagnostics);
  if (diagnostics.length) return { ...loaded, passed: false, diagnostics, active_blockers: blockers };
  const transitionId = `CONFIRM-${computeCanonicalDigest({ run_id: manifest.run_id, emit_transition: emit.emitResult.transition_id, token: userToken }).slice(0, 16)}`;
  const relativeTransition = `transitions/confirmation/${transitionId}`;
  const resulting = buildCheckpoint({
    runId: manifest.run_id,
    sessionId: session.session_id,
    context,
    sequence: checkpoint.checkpoint_sequence + 1,
    parentId: checkpoint.checkpoint_id,
    state: 'BUILD_ACTIVE',
    confirmedActionIds: context.action_batch.action_ids,
    unconfirmedActionIds: [],
    unresolvedBlockers: checkpoint.unresolved_blockers || [],
    assertions: checkpoint.assertions,
    evidenceLedger: checkpoint.evidence_ledger,
    createdFrom: 'user_confirmation'
  });
  const nextSession = updateSessionForCheckpoint(session, resulting);
  const receipt = {
    schema: 'ev4-builder-confirmation-receipt@2.0.0',
    run_id: manifest.run_id,
    runtime_mode: RUNTIME_MODES.REAL,
    context_digest: context.context_digest,
    package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id,
    confirmation_id: context.confirmation.confirmation_id,
    operator_token: userToken,
    batch_id: context.action_batch.batch_id,
    action_ids: [...context.action_batch.action_ids],
    action_digests: { ...context.action_batch.action_digests },
    predecessor_checkpoint: { checkpoint_id: checkpoint.checkpoint_id, checkpoint_sequence: checkpoint.checkpoint_sequence },
    resulting_checkpoint: { checkpoint_id: resulting.checkpoint_id, checkpoint_sequence: resulting.checkpoint_sequence, parent_checkpoint_id: resulting.parent_checkpoint_id },
    receipt_digest: null
  };
  receipt.receipt_digest = digestWithout(receipt, 'receipt_digest');
  const files = [`${relativeTransition}/checkpoint.json`, `${relativeTransition}/confirmation-receipt.json`, `${relativeTransition}/confirmation-result.json`, `${relativeTransition}/session-state.json`, 'checkpoint.json', 'run-manifest.json', 'session-state.json'].sort();
  const result = {
    schema: 'ev4-builder-confirmation-result@2.0.0',
    run_id: manifest.run_id,
    transition_id: transitionId,
    status: 'accepted',
    context_digest: context.context_digest,
    package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id,
    confirmation_id: context.confirmation.confirmation_id,
    batch_id: context.action_batch.batch_id,
    action_ids: [...context.action_batch.action_ids],
    action_digests: { ...context.action_batch.action_digests },
    predecessor_checkpoint: receipt.predecessor_checkpoint,
    resulting_checkpoint: receipt.resulting_checkpoint,
    receipt_digest: receipt.receipt_digest,
    runtime_state: 'BUILD_ACTIVE',
    builder_build_complete: false,
    responsive_complete: false,
    production_ready: false,
    publication: { atomic: true, files },
    blocking_diagnostics: []
  };
  try {
    replaceRunAtomically(runDirectory, (stage) => {
      const transition = path.join(stage, relativeTransition);
      if (fs.existsSync(transition)) throw new Error('Confirmation transition already exists.');
      fs.mkdirSync(transition, { recursive: false });
      writeJson(path.join(transition, 'session-state.json'), nextSession, 'wx');
      writeJson(path.join(transition, 'checkpoint.json'), resulting, 'wx');
      writeJson(path.join(transition, 'confirmation-receipt.json'), receipt, 'wx');
      writeJson(path.join(transition, 'confirmation-result.json'), result, 'wx');
      writeJson(path.join(stage, 'session-state.json'), nextSession);
      writeJson(path.join(stage, 'checkpoint.json'), resulting);
      writeJson(path.join(stage, 'run-manifest.json'), refreshManifest(manifest, context, resulting, {
        active_confirmation_receipt_ref: `${relativeTransition}/confirmation-receipt.json`,
        active_confirmation_result_ref: `${relativeTransition}/confirmation-result.json`,
        confirmed_checkpoint_id: resulting.checkpoint_id,
        confirmed_checkpoint_sequence: resulting.checkpoint_sequence
      }));
    }, (stage) => {
      const check = loadRun(stage);
      const localDiagnostics = [...check.diagnostics];
      const stagedReceipt = readJson(path.join(stage, relativeTransition, 'confirmation-receipt.json'));
      const stagedResult = readJson(path.join(stage, relativeTransition, 'confirmation-result.json'));
      if (stagedReceipt.receipt_digest !== digestWithout(stagedReceipt, 'receipt_digest')) localDiagnostics.push(diagnostic('RUN-CONFIRM-013', 'Generated Confirmation Receipt digest is invalid.'));
      if (stagedReceipt.resulting_checkpoint?.checkpoint_id !== check.checkpoint?.checkpoint_id || stagedReceipt.resulting_checkpoint?.checkpoint_sequence !== check.checkpoint?.checkpoint_sequence || stagedReceipt.resulting_checkpoint?.parent_checkpoint_id !== check.checkpoint?.parent_checkpoint_id) localDiagnostics.push(diagnostic('RUN-CONFIRM-014', 'Generated Confirmation Receipt does not bind the exact resulting Checkpoint.'));
      localDiagnostics.push(...validatePublication(stagedResult, files, 'ev4-builder-confirmation-result@2.0.0', manifest.run_id));
      return { passed: localDiagnostics.length === 0, diagnostics: localDiagnostics };
    }, failureInjection);
    return { passed: true, diagnostics: [], result, receipt, nextSession, nextCheckpoint: resulting };
  } catch (error) {
    return { ...loaded, passed: false, diagnostics: [diagnostic('RUN-CONFIRM-015', 'Atomic Confirmation failed; active Run pointers were not modified.', error.message)] };
  }
}

function claimSetCompatible(claimClasses) {
  if (claimClasses.length <= 1) return true;
  return ALLOWED_MULTI_CLAIM_SETS.has([...claimClasses].sort().join('|'));
}

function validateEvidenceSource(source, loaded) {
  const diagnostics = [];
  if (source?.schema !== 'ev4-builder-evidence-source@1.0.0') diagnostics.push(diagnostic('RUN-EVIDENCE-001', 'Evidence source schema is unsupported.'));
  if (typeof source?.status !== 'string' || source.status !== 'verified') diagnostics.push(diagnostic('RUN-EVIDENCE-002', 'Evidence source.status must equal the exact string "verified".'));
  if (!Array.isArray(source?.claim_ids) || source.claim_ids.length === 0 || new Set(source.claim_ids).size !== source.claim_ids.length) diagnostics.push(diagnostic('RUN-EVIDENCE-003', 'Evidence claim_ids must be a non-empty unique set.'));
  if (!Array.isArray(source?.claim_classes) || source.claim_classes.length === 0 || !claimSetCompatible(source.claim_classes)) diagnostics.push(diagnostic('RUN-EVIDENCE-004', 'Evidence claim_classes are missing or incompatible.'));
  if (source?.session_id !== loaded.session.session_id) diagnostics.push(diagnostic('RUN-EVIDENCE-005', 'Evidence Session binding is stale or foreign.'));
  if (source?.package_digest !== loaded.context.canonical_package_digest) diagnostics.push(diagnostic('RUN-EVIDENCE-006', 'Evidence Package binding is stale or foreign.'));
  for (const claimClass of source?.claim_classes || []) {
    const allowed = CLAIM_COMPATIBILITY[claimClass];
    if (!allowed || !allowed.includes(source.evidence_type)) diagnostics.push(diagnostic('RUN-EVIDENCE-007', `Evidence type cannot satisfy ${claimClass}.`));
  }
  if ((source?.claim_classes || []).includes('required_action_execution')) {
    if (!loaded.context.action_batch.action_ids.includes(source.action_id)) diagnostics.push(diagnostic('RUN-EVIDENCE-008', 'Action execution Evidence action_id is missing or foreign.'));
    if (source.subject_ref !== source.action_id) diagnostics.push(diagnostic('RUN-EVIDENCE-009', 'Action execution Evidence subject_ref must equal action_id.'));
  }
  if (typeof source?.subject_ref !== 'string' || !source.subject_ref) diagnostics.push(diagnostic('RUN-EVIDENCE-010', 'Evidence subject_ref is missing.'));
  if (typeof source?.evidence_type !== 'string' || !source.evidence_type) diagnostics.push(diagnostic('RUN-EVIDENCE-011', 'Evidence type is missing.'));
  return diagnostics;
}

export function attachRunEvidence({ runDirectory, evidenceSourceFile, failureInjection = null }) {
  const loaded = loadRun(runDirectory);
  if (!loaded.passed) return loaded;
  const diagnostics = [];
  const { manifest, context, session, checkpoint } = loaded;
  if (checkpoint.runtime_state !== 'BUILD_ACTIVE' || !manifest.active_confirmation_receipt_ref) diagnostics.push(diagnostic('RUN-EVIDENCE-012', 'Evidence attachment requires a confirmed BUILD_ACTIVE Run.'));
  let bytes;
  let source;
  try {
    bytes = readBytes(resolveRoot(evidenceSourceFile));
    source = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    return { ...loaded, passed: false, diagnostics: [diagnostic('RUN-EVIDENCE-013', 'External Evidence source is unreadable or malformed.', error.message)] };
  }
  diagnostics.push(...validateEvidenceSource(source, loaded));
  const evidenceSha = sha256Bytes(bytes);
  const evidenceId = `EV-${evidenceSha.slice(0, 20)}`;
  const evidenceRef = `evidence/${evidenceId}.json`;
  if ((manifest.evidence_snapshot_refs || []).includes(evidenceRef)) diagnostics.push(diagnostic('RUN-EVIDENCE-014', 'Identical Evidence snapshot is already attached.'));
  const existingAssertionIds = new Set((checkpoint.assertions || []).map((entry) => entry.assertion_id));
  for (const claimId of source.claim_ids || []) if (existingAssertionIds.has(claimId)) diagnostics.push(diagnostic('RUN-EVIDENCE-015', `Assertion already exists: ${claimId}.`));
  if (diagnostics.length) return { ...loaded, passed: false, diagnostics };
  const resultingAssertions = [...checkpoint.assertions];
  for (const claimId of source.claim_ids) {
    resultingAssertions.push({ assertion_id: claimId, subject_ref: source.subject_ref, claim: source.claim_classes.join('|'), status: 'confirmed', evidence_refs: [evidenceId] });
  }
  const resultingLedger = [...checkpoint.evidence_ledger, {
    evidence_id: evidenceId,
    evidence_type: source.evidence_type,
    source_ref: evidenceRef,
    captured_at: timestampForSequence(checkpoint.checkpoint_sequence + 1),
    content_sha256: evidenceSha,
    supports_claim_ids: [...source.claim_ids],
    status: 'available'
  }];
  const resulting = buildCheckpoint({
    runId: manifest.run_id,
    sessionId: session.session_id,
    context,
    sequence: checkpoint.checkpoint_sequence + 1,
    parentId: checkpoint.checkpoint_id,
    state: 'BUILD_ACTIVE',
    confirmedActionIds: checkpoint.confirmed_action_ids,
    unconfirmedActionIds: checkpoint.unconfirmed_action_ids,
    unresolvedBlockers: checkpoint.unresolved_blockers || [],
    assertions: resultingAssertions,
    evidenceLedger: resultingLedger,
    createdFrom: source.evidence_type
  });
  const nextSession = updateSessionForCheckpoint(session, resulting);
  const transitionId = `EVIDENCE-${computeCanonicalDigest({ run_id: manifest.run_id, evidence_sha256: evidenceSha, predecessor: checkpoint.checkpoint_id }).slice(0, 16)}`;
  const relativeTransition = `transitions/evidence/${transitionId}`;
  const resultRef = `${relativeTransition}/evidence-attachment-result.json`;
  const files = [evidenceRef, `${relativeTransition}/checkpoint.json`, resultRef, `${relativeTransition}/session-state.json`, 'checkpoint.json', 'run-manifest.json', 'session-state.json'].sort();
  const result = {
    schema: 'ev4-builder-evidence-attachment-result@1.0.0',
    run_id: manifest.run_id,
    transition_id: transitionId,
    status: 'accepted',
    evidence_id: evidenceId,
    evidence_snapshot_ref: evidenceRef,
    evidence_snapshot_sha256: evidenceSha,
    context_digest: context.context_digest,
    package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id,
    batch_id: context.action_batch.batch_id,
    action_ids: [...context.action_batch.action_ids],
    action_digests: { ...context.action_batch.action_digests },
    predecessor_checkpoint: { checkpoint_id: checkpoint.checkpoint_id, checkpoint_sequence: checkpoint.checkpoint_sequence },
    resulting_checkpoint: { checkpoint_id: resulting.checkpoint_id, checkpoint_sequence: resulting.checkpoint_sequence, parent_checkpoint_id: resulting.parent_checkpoint_id },
    builder_build_complete: false,
    responsive_complete: false,
    production_ready: false,
    publication: { atomic: true, files },
    blocking_diagnostics: []
  };
  try {
    replaceRunAtomically(runDirectory, (stage) => {
      const evidenceTarget = path.join(stage, evidenceRef);
      if (fs.existsSync(evidenceTarget)) throw new Error('Evidence snapshot already exists.');
      writeBytes(evidenceTarget, bytes, 'wx');
      const transition = path.join(stage, relativeTransition);
      fs.mkdirSync(transition, { recursive: false });
      writeJson(path.join(transition, 'session-state.json'), nextSession, 'wx');
      writeJson(path.join(transition, 'checkpoint.json'), resulting, 'wx');
      writeJson(path.join(transition, 'evidence-attachment-result.json'), result, 'wx');
      writeJson(path.join(stage, 'session-state.json'), nextSession);
      writeJson(path.join(stage, 'checkpoint.json'), resulting);
      writeJson(path.join(stage, 'run-manifest.json'), refreshManifest(manifest, context, resulting, {
        evidence_snapshot_refs: [...manifest.evidence_snapshot_refs, evidenceRef],
        evidence_attachment_result_refs: [...manifest.evidence_attachment_result_refs, resultRef]
      }));
    }, (stage) => {
      const check = loadRun(stage);
      const localDiagnostics = [...check.diagnostics];
      if (sha256Bytes(readBytes(path.join(stage, evidenceRef))) !== evidenceSha) localDiagnostics.push(diagnostic('RUN-EVIDENCE-016', 'Internal Evidence snapshot bytes changed during publication.'));
      localDiagnostics.push(...validatePublication(readJson(path.join(stage, resultRef)), files, 'ev4-builder-evidence-attachment-result@1.0.0', manifest.run_id));
      return { passed: localDiagnostics.length === 0, diagnostics: localDiagnostics };
    }, failureInjection);
    return { passed: true, diagnostics: [], result, nextSession, nextCheckpoint: resulting };
  } catch (error) {
    return { ...loaded, passed: false, diagnostics: [diagnostic('RUN-EVIDENCE-017', 'Atomic Evidence attachment failed; active Run pointers were not modified.', error.message)] };
  }
}

function verifyInternalEvidence(loaded) {
  const diagnostics = [];
  const verified = [];
  const verifiedClaimClasses = new Set();
  const verifiedActionIds = new Set();
  const records = new Map((loaded.checkpoint.evidence_ledger || []).map((entry) => [entry.evidence_id, entry]));
  const assertions = new Map((loaded.checkpoint.assertions || []).map((entry) => [entry.assertion_id, entry]));
  for (const ref of loaded.manifest.evidence_snapshot_refs || []) {
    const file = safeRunRef(loaded.runDirectory, ref);
    if (!file || !fs.existsSync(file)) {
      diagnostics.push(diagnostic('RUN-COMPLETE-EVIDENCE-001', `Evidence snapshot is missing or unsafe: ${ref}.`));
      continue;
    }
    const bytes = readBytes(file);
    const actualSha = sha256Bytes(bytes);
    const evidenceId = `EV-${actualSha.slice(0, 20)}`;
    const record = records.get(evidenceId);
    if (!record) {
      diagnostics.push(diagnostic('RUN-COMPLETE-EVIDENCE-002', `Evidence ledger record is missing for ${ref}.`));
      continue;
    }
    if (record.source_ref !== ref || record.content_sha256 !== actualSha || record.status !== 'available') diagnostics.push(diagnostic('RUN-COMPLETE-EVIDENCE-003', `Evidence ledger binding is invalid for ${evidenceId}.`));
    let source;
    try {
      source = JSON.parse(bytes.toString('utf8'));
    } catch (error) {
      diagnostics.push(diagnostic('RUN-COMPLETE-EVIDENCE-004', `Evidence snapshot is malformed: ${evidenceId}.`, error.message));
      continue;
    }
    const local = validateEvidenceSource(source, loaded);
    for (const claimId of source.claim_ids || []) {
      const assertion = assertions.get(claimId);
      if (!assertion || assertion.status !== 'confirmed' || assertion.subject_ref !== source.subject_ref || !assertion.evidence_refs?.includes(evidenceId)) local.push(diagnostic('RUN-COMPLETE-EVIDENCE-005', `Evidence does not bind the exact confirmed assertion ${claimId}.`));
      if (!(record.supports_claim_ids || []).includes(claimId)) local.push(diagnostic('RUN-COMPLETE-EVIDENCE-006', `Evidence record does not support the exact assertion ${claimId}.`));
    }
    diagnostics.push(...local);
    if (!local.length) {
      verified.push({ evidence_id: evidenceId, evidence_snapshot_ref: ref, evidence_snapshot_sha256: actualSha, claim_classes: [...source.claim_classes], action_id: source.action_id ?? null });
      for (const claimClass of source.claim_classes) verifiedClaimClasses.add(claimClass);
      if (source.claim_classes.includes('required_action_execution')) verifiedActionIds.add(source.action_id);
    }
  }
  for (const actionId of loaded.context.action_batch.action_ids) if (!verifiedActionIds.has(actionId)) diagnostics.push(diagnostic('RUN-COMPLETE-EVIDENCE-007', `Required Action lacks internal Action-specific Evidence: ${actionId}.`));
  for (const claimClass of REQUIRED_COMPLETION_CLAIMS) if (!verifiedClaimClasses.has(claimClass)) diagnostics.push(diagnostic('RUN-COMPLETE-EVIDENCE-008', `Required Completion claim lacks internal verified Evidence: ${claimClass}.`));
  return { passed: diagnostics.length === 0, diagnostics, verified, verified_action_ids: [...verifiedActionIds].sort(), verified_claim_classes: [...verifiedClaimClasses].sort() };
}

function validateConfirmationForCompletion(loaded) {
  const diagnostics = [];
  let receipt;
  let result;
  try {
    receipt = loadTransitionResult(loaded.runDirectory, loaded.manifest.active_confirmation_receipt_ref, 'ev4-builder-confirmation-receipt@2.0.0');
    result = loadTransitionResult(loaded.runDirectory, loaded.manifest.active_confirmation_result_ref, 'ev4-builder-confirmation-result@2.0.0');
  } catch (error) {
    return { passed: false, diagnostics: [diagnostic('RUN-COMPLETE-CONFIRM-001', 'Canonical Confirmation artifacts are unavailable.', error.message)] };
  }
  const { manifest, context, checkpoint } = loaded;
  if (receipt.receipt_digest !== digestWithout(receipt, 'receipt_digest')) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-002', 'Confirmation Receipt digest is invalid.'));
  if (receipt.run_id !== manifest.run_id || result.run_id !== manifest.run_id) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-003', 'Confirmation Run binding is invalid.'));
  if (receipt.context_digest !== context.context_digest || result.context_digest !== context.context_digest) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-004', 'Confirmation Context binding is invalid.'));
  if (receipt.package_digest !== context.canonical_package_digest || receipt.selected_candidate_id !== context.selected_candidate_id || receipt.confirmation_id !== context.confirmation.confirmation_id) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-005', 'Confirmation Package/Candidate/ID binding is invalid.'));
  if (receipt.batch_id !== context.action_batch.batch_id || checkpoint.batch_id !== context.action_batch.batch_id) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-006', 'Confirmation/current Checkpoint Batch binding is invalid.'));
  if (!sameSet(receipt.action_ids, context.action_batch.action_ids) || sortedCanonicalJson(receipt.action_digests) !== sortedCanonicalJson(context.action_batch.action_digests)) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-007', 'Confirmation Action binding is invalid.'));
  if (receipt.operator_token !== context.confirmation.expected_user_token) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-008', 'Confirmation operator token binding is invalid.'));
  if (receipt.resulting_checkpoint?.checkpoint_id !== manifest.confirmed_checkpoint_id || receipt.resulting_checkpoint?.checkpoint_sequence !== manifest.confirmed_checkpoint_sequence) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-009', 'Confirmation resulting Checkpoint binding is invalid.'));
  if (result.receipt_digest !== receipt.receipt_digest || result.resulting_checkpoint?.checkpoint_id !== receipt.resulting_checkpoint?.checkpoint_id) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-010', 'Confirmation Result and Receipt disagree.'));
  if (!sameSet(checkpoint.confirmed_action_ids, context.action_batch.action_ids) || (checkpoint.unconfirmed_action_ids || []).length !== 0) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-011', 'Current Checkpoint does not preserve the exact confirmed Action set.'));
  return { passed: diagnostics.length === 0, diagnostics, receipt, result };
}

function deriveCompletionArtifacts(evidence) {
  const claims = new Set(evidence.verified_claim_classes);
  const states = {
    scaffold_built: claims.has('scaffold_built'),
    structure_built: claims.has('structure_built'),
    content_filled: claims.has('content_filled'),
    desktop_layout_established: claims.has('desktop_layout_established'),
    export_checked: claims.has('export_checked')
  };
  const status = {
    schema: 'ev4-builder-derived-completion-status@1.0.0',
    claim_scope: 'desktop',
    states,
    evidence: { export: states.export_checked },
    derivation: { required_actions_verified: true, verified_evidence_refs: evidence.verified.map((entry) => entry.evidence_id), unresolved_blockers: [] },
    scope_excludes_responsive: true,
    production_ready: false
  };
  const proof = (claim) => ({
    claim_id: claim,
    subject_ref: 'builder-output',
    verification_method: 'internal_run_evidence_snapshot',
    required_evidence_types: CLAIM_COMPATIBILITY[claim],
    verified_evidence_refs: evidence.verified.filter((entry) => entry.claim_classes.includes(claim)).map((entry) => entry.evidence_id),
    derived_status: claims.has(claim) ? 'confirmed' : 'missing',
    diagnostics: []
  });
  return {
    status,
    gate: {
      schema: 'ev4-builder-derived-completion-gate@1.0.0',
      proofs: { layout_verified: proof('layout_verified'), export_verified: proof('export_verified') },
      responsive_complete: false,
      production_ready: false
    }
  };
}

export function completeRun({ runDirectory, failureInjection = null }) {
  const loaded = loadRun(runDirectory);
  if (!loaded.passed) return loaded;
  const derivation = fullDeriveAndCompare(loaded);
  const diagnostics = [...derivation.diagnostics];
  const { manifest, context, session, checkpoint } = loaded;
  if (checkpoint.runtime_state === 'COMPLETED') diagnostics.push(diagnostic('RUN-COMPLETE-001', 'Run is already COMPLETED.'));
  if (checkpoint.runtime_state !== 'BUILD_ACTIVE' || session.runtime_state !== 'BUILD_ACTIVE') diagnostics.push(diagnostic('RUN-COMPLETE-002', 'real-completion requires BUILD_ACTIVE Run carriers.'));
  if (!checkpointSequenceIsValid(checkpoint)) diagnostics.push(diagnostic('RUN-COMPLETE-003', 'Completion predecessor Checkpoint sequence/parent is invalid.'));
  const blockers = collectActiveBlockers(session, checkpoint);
  if (blockers.length) diagnostics.push(diagnostic('RUN-COMPLETE-004', `Completion is blocked by: ${blockers.join(', ')}.`));
  const confirmation = validateConfirmationForCompletion(loaded);
  diagnostics.push(...confirmation.diagnostics);
  const evidence = verifyInternalEvidence(loaded);
  diagnostics.push(...evidence.diagnostics);
  if (diagnostics.length) return { ...loaded, passed: false, diagnostics, active_blockers: blockers, confirmation, evidence };
  const derived = deriveCompletionArtifacts(evidence);
  if (Object.values(derived.status.states).some((value) => value !== true) || Object.values(derived.gate.proofs).some((entry) => entry.derived_status !== 'confirmed')) return { ...loaded, passed: false, diagnostics: [diagnostic('RUN-COMPLETE-005', 'Runtime-derived Completion predicates are incomplete.')] };
  const transitionId = `COMPLETE-${computeCanonicalDigest({ run_id: manifest.run_id, checkpoint_id: checkpoint.checkpoint_id, evidence: evidence.verified.map((entry) => entry.evidence_snapshot_sha256) }).slice(0, 16)}`;
  const relativeTransition = `transitions/completion/${transitionId}`;
  const resulting = buildCheckpoint({
    runId: manifest.run_id,
    sessionId: session.session_id,
    context,
    sequence: checkpoint.checkpoint_sequence + 1,
    parentId: checkpoint.checkpoint_id,
    state: 'COMPLETED',
    confirmedActionIds: context.action_batch.action_ids,
    unconfirmedActionIds: [],
    unresolvedBlockers: [],
    assertions: checkpoint.assertions,
    evidenceLedger: checkpoint.evidence_ledger,
    createdFrom: 'export_json'
  });
  const nextSession = updateSessionForCheckpoint({ ...session, unresolved_evidence: [] }, resulting);
  const files = [`${relativeTransition}/checkpoint.json`, `${relativeTransition}/completion-gate.json`, `${relativeTransition}/completion-result.json`, `${relativeTransition}/completion-status.json`, `${relativeTransition}/session-state.json`, 'checkpoint.json', 'outputs/completion-gate.json', 'outputs/completion-result.json', 'outputs/completion-status.json', 'run-manifest.json', 'session-state.json'].sort();
  const result = {
    schema: 'ev4-builder-completion-result@2.0.0',
    run_id: manifest.run_id,
    transition_id: transitionId,
    status: 'accepted',
    source_snapshot_sha256: manifest.source_snapshot_sha256,
    context_digest: context.context_digest,
    package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id,
    confirmation_id: context.confirmation.confirmation_id,
    batch_id: context.action_batch.batch_id,
    action_ids: [...context.action_batch.action_ids],
    action_digests: { ...context.action_batch.action_digests },
    verified_evidence_ids: evidence.verified.map((entry) => entry.evidence_id),
    predecessor_checkpoint: { checkpoint_id: checkpoint.checkpoint_id, checkpoint_sequence: checkpoint.checkpoint_sequence },
    resulting_checkpoint: { checkpoint_id: resulting.checkpoint_id, checkpoint_sequence: resulting.checkpoint_sequence, parent_checkpoint_id: resulting.parent_checkpoint_id },
    runtime_state: 'COMPLETED',
    builder_build_complete: true,
    responsive_complete: false,
    production_ready: false,
    publication: { atomic: true, files },
    blocking_diagnostics: []
  };
  try {
    replaceRunAtomically(runDirectory, (stage) => {
      const transition = path.join(stage, relativeTransition);
      if (fs.existsSync(transition)) throw new Error('Completion transition already exists.');
      fs.mkdirSync(transition, { recursive: false });
      writeJson(path.join(transition, 'session-state.json'), nextSession, 'wx');
      writeJson(path.join(transition, 'checkpoint.json'), resulting, 'wx');
      writeJson(path.join(transition, 'completion-status.json'), derived.status, 'wx');
      writeJson(path.join(transition, 'completion-gate.json'), derived.gate, 'wx');
      writeJson(path.join(transition, 'completion-result.json'), result, 'wx');
      writeJson(path.join(stage, 'session-state.json'), nextSession);
      writeJson(path.join(stage, 'checkpoint.json'), resulting);
      writeJson(path.join(stage, 'outputs', 'completion-status.json'), derived.status);
      writeJson(path.join(stage, 'outputs', 'completion-gate.json'), derived.gate);
      writeJson(path.join(stage, 'outputs', 'completion-result.json'), result);
      writeJson(path.join(stage, 'run-manifest.json'), refreshManifest(manifest, context, resulting, {
        completion_result_ref: 'outputs/completion-result.json',
        completion_status_ref: 'outputs/completion-status.json',
        completion_gate_ref: 'outputs/completion-gate.json'
      }));
    }, (stage) => {
      const check = loadRun(stage);
      const localDiagnostics = [...check.diagnostics];
      const stagedResult = readJson(path.join(stage, 'outputs', 'completion-result.json'));
      const status = readJson(path.join(stage, 'outputs', 'completion-status.json'));
      const gate = readJson(path.join(stage, 'outputs', 'completion-gate.json'));
      localDiagnostics.push(...validatePublication(stagedResult, files, 'ev4-builder-completion-result@2.0.0', manifest.run_id));
      if (stagedResult.builder_build_complete !== true || stagedResult.runtime_state !== 'COMPLETED') localDiagnostics.push(diagnostic('RUN-COMPLETE-006', 'Generated Completion Result is not terminal.'));
      if (Object.values(status.states || {}).some((value) => value !== true) || Object.values(gate.proofs || {}).some((entry) => entry.derived_status !== 'confirmed')) localDiagnostics.push(diagnostic('RUN-COMPLETE-007', 'Generated Completion Status or Gate is incomplete.'));
      return { passed: localDiagnostics.length === 0, diagnostics: localDiagnostics };
    }, failureInjection);
    return { passed: true, diagnostics: [], result, status: derived.status, gate: derived.gate, nextSession, nextCheckpoint: resulting };
  } catch (error) {
    return { ...loaded, passed: false, diagnostics: [diagnostic('RUN-COMPLETE-008', 'Atomic Completion failed; active Run pointers were not modified.', error.message)] };
  }
}

export function validateCanonicalRun(runDirectory, { fullDerivation = false } = {}) {
  const loaded = loadRun(runDirectory);
  if (!loaded.passed || !fullDerivation) return loaded;
  const derivation = fullDeriveAndCompare(loaded);
  return { ...loaded, passed: derivation.passed, diagnostics: [...loaded.diagnostics, ...derivation.diagnostics], derivation };
}

export const CANONICAL_REAL_OPERATIONS = Object.freeze([
  'real-intake',
  'emit-batch',
  'confirm-batch',
  'attach-evidence',
  'real-completion'
]);
