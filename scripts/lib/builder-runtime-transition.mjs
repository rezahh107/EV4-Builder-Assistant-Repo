import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  computeCanonicalDigest,
  computePackageDigest,
  sha256Bytes,
  sortedCanonicalJson
} from './canonical-builder-package.mjs';

const ROOT = process.cwd();
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const TRANSITIONS_PATH = path.join(ROOT, 'runtime', 'state-transitions.v1.json');
const HASH = /^[a-f0-9]{64}$/;

const RESUME_GUARDS = [
  'builder_input_verified',
  'intake_capsule_verified',
  'prior_initialized_state_exists',
  'session_id_matches',
  'package_digest_matches',
  'candidate_matches',
  'checkpoint_valid',
  'checkpoint_and_state_consistent',
  'unresolved_blockers_preserved',
  'resume_target_legal'
];

const COMPLETION_GUARDS = [
  'builder_input_verified',
  'intake_capsule_verified',
  'predecessor_checkpoint_valid',
  'package_digest_matches',
  'candidate_matches',
  'session_id_matches',
  'checkpoint_sequence_valid',
  'required_actions_reconciled',
  'unresolved_blocking_evidence_count_zero',
  'completion_status_valid',
  'completion_gate_bound'
];

export function resolveFile(value) {
  if (!value || typeof value !== 'string') throw new Error('A file path is required.');
  return path.resolve(ROOT, value);
}

function readBytes(file) {
  return fs.readFileSync(resolveFile(file));
}

function readJson(file) {
  return JSON.parse(readBytes(file).toString('utf8'));
}

function diagnostic(code, message, detail = '') {
  return { code, message, ...(detail ? { detail } : {}) };
}

function diagnosticText(result) {
  return `${result.stderr || ''}\n${result.stdout || ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-10)
    .join(' | ')
    .slice(0, 1600);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: false
  });
  return {
    passed: !result.error && result.status === 0,
    exit_code: result.status ?? 1,
    detail: result.error?.message || diagnosticText(result)
  };
}

export function runAjv(schema, data, refs = []) {
  const args = [
    '--yes', 'ajv-cli@5', 'validate',
    '--spec=draft2020', '--strict=false',
    '-s', schema
  ];
  for (const ref of refs) args.push('-r', ref);
  args.push('-d', data);
  return run(NPX, args);
}

function runNode(script, ...args) {
  return run(process.execPath, [script, ...args]);
}

function validateSessionFile(file) {
  const schema = runAjv('schemas/session-state.schema.json', file, [
    'schemas/checkpoint.schema.json',
    'schemas/evidence-record.schema.json',
    'schemas/repair-packet.schema.json'
  ]);
  const semantic = runNode('scripts/validate-session-state.mjs', file);
  return { passed: schema.passed && semantic.passed, schema, semantic };
}

function validateCheckpointFile(file) {
  const schema = runAjv('schemas/checkpoint.schema.json', file, ['schemas/evidence-record.schema.json']);
  const semantic = runNode('scripts/validate-checkpoint.mjs', file);
  return { passed: schema.passed && semantic.passed, schema, semantic };
}

function validateCompletionStatusFile(file) {
  const schema = runAjv('schemas/completion-status.schema.json', file);
  const semantic = runNode('scripts/validate-completion-status.mjs', file);
  return { passed: schema.passed && semantic.passed, schema, semantic };
}

function validateCompletionGateFile(file) {
  const schema = runAjv('schemas/completion-gate.schema.json', file);
  const semantic = runNode('scripts/validate-completion-gate.mjs', file);
  return { passed: schema.passed && semantic.passed, schema, semantic };
}

function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const orderedLeft = [...left].sort();
  const orderedRight = [...right].sort();
  return orderedLeft.every((value, index) => value === orderedRight[index]);
}

function unique(values) {
  return new Set(values).size === values.length;
}

function checkpointBlockers(checkpoint) {
  const explicit = Array.isArray(checkpoint?.unresolved_blockers) ? checkpoint.unresolved_blockers : [];
  const assertions = (checkpoint?.assertions || [])
    .filter((entry) => ['not_checked', 'insufficient_evidence'].includes(entry?.status))
    .map((entry) => entry.assertion_id || entry.subject_ref || 'unresolved_assertion');
  return [...new Set([...explicit, ...assertions])];
}

function checkpointSequenceIsValid(checkpoint) {
  if (!Number.isInteger(checkpoint?.checkpoint_sequence) || checkpoint.checkpoint_sequence < 1) return false;
  if (checkpoint.checkpoint_sequence === 1) return checkpoint.parent_checkpoint_id === null;
  return typeof checkpoint.parent_checkpoint_id === 'string' && checkpoint.parent_checkpoint_id.length > 0;
}

export function verifyBuilderInput(sourceFile) {
  const diagnostics = [];
  const bytes = readBytes(sourceFile);
  const sourceFileSha256 = sha256Bytes(bytes);
  let pkg;

  try {
    pkg = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    diagnostics.push(diagnostic('BUILDER-INPUT-001', 'Builder Input is malformed JSON.', error.message));
    return { passed: false, diagnostics, package: null, identity: null };
  }

  if (pkg.schema !== 'ev4-builder-context-package@1.0.0') {
    diagnostics.push(diagnostic('BUILDER-INPUT-002', 'Unsupported Builder Input Schema.', `received=${pkg.schema ?? '<missing>'}`));
  }

  if (diagnostics.length === 0) {
    const checks = [
      ['BUILDER-INPUT-003', 'Builder Context Schema validation failed.', runAjv('schemas/builder-context-package.schema.json', sourceFile)],
      ['BUILDER-INPUT-004', 'Builder semantic/cross-field validation failed.', runNode('scripts/validate-package.mjs', sourceFile)],
      ['BUILDER-INPUT-005', 'Decision-lineage validation failed.', runNode('scripts/validate-builder-context-decision-lineage.mjs', sourceFile)]
    ];
    for (const [code, message, result] of checks) {
      if (!result.passed) diagnostics.push(diagnostic(code, message, result.detail));
    }
  }

  if (pkg.selected_candidate_locked !== true || typeof pkg.selected_candidate_id !== 'string' || !pkg.selected_candidate_id) {
    diagnostics.push(diagnostic('BUILDER-INPUT-006', 'Selected candidate identity is not locked and usable.'));
  }

  const authorization = pkg.input_authorization;
  if (
    authorization?.decision !== 'approved'
    || authorization?.eligible_workflow_mode !== 'APPROVED_HANDOFF_MODE'
    || authorization?.eligible_runtime_state !== 'BUILD_ACTIVE'
    || (authorization.blocking_diagnostics || []).length !== 0
  ) {
    diagnostics.push(diagnostic('BUILDER-INPUT-007', 'input_authorization does not authorize a normal Builder Run.'));
  }

  const canonicalPackageDigest = computePackageDigest(pkg);
  if (authorization?.package_digest?.value !== canonicalPackageDigest) {
    diagnostics.push(diagnostic('BUILDER-INPUT-008', 'Package digest does not match canonical Builder Input content.'));
  }

  return {
    passed: diagnostics.length === 0,
    diagnostics,
    package: pkg,
    identity: {
      source_file_sha256: sourceFileSha256,
      canonical_package_digest: canonicalPackageDigest,
      selected_candidate_id: pkg.selected_candidate_id ?? null,
      builder_context_schema: pkg.schema ?? null
    }
  };
}

export function buildIntakeCapsule(sourceFile) {
  const verification = verifyBuilderInput(sourceFile);
  const result = {
    schema: 'ev4-builder-intake-result@1.0.0',
    status: verification.passed ? 'accepted' : 'blocked',
    source_file_sha256: verification.identity?.source_file_sha256 ?? sha256Bytes(readBytes(sourceFile)),
    canonical_package_digest: verification.identity?.canonical_package_digest ?? null,
    selected_candidate_id: verification.identity?.selected_candidate_id ?? null,
    builder_context_schema: verification.identity?.builder_context_schema ?? null,
    blocking_diagnostics: verification.diagnostics,
    warnings: verification.package?.input_authorization?.visible_flags || [],
    source_file_unchanged: true,
    publication: { atomic: true }
  };
  return { verification, result };
}

export function verifyIntakeCapsule(sourceFile, capsuleFile) {
  const builderInput = verifyBuilderInput(sourceFile);
  const diagnostics = [...builderInput.diagnostics];
  let capsule;

  try {
    capsule = readJson(capsuleFile);
  } catch (error) {
    diagnostics.push(diagnostic('BUILDER-CAPSULE-001', 'Intake Capsule is unreadable or malformed.', error.message));
    return { passed: false, diagnostics, builderInput, capsule: null };
  }

  const acceptedShape = capsule?.schema === 'ev4-builder-intake-result@1.0.0'
    && capsule.status === 'accepted'
    && HASH.test(capsule.source_file_sha256 || '')
    && HASH.test(capsule.canonical_package_digest || '')
    && Array.isArray(capsule.blocking_diagnostics)
    && capsule.blocking_diagnostics.length === 0
    && capsule.source_file_unchanged === true
    && capsule.publication?.atomic === true;
  if (!acceptedShape) diagnostics.push(diagnostic('BUILDER-CAPSULE-002', 'Capsule is not a complete accepted derived Intake result.'));

  const identity = builderInput.identity;
  if (identity && capsule.source_file_sha256 !== identity.source_file_sha256) diagnostics.push(diagnostic('BUILDER-CAPSULE-003', 'Capsule source SHA-256 does not match actual Builder Input bytes.'));
  if (identity && capsule.canonical_package_digest !== identity.canonical_package_digest) diagnostics.push(diagnostic('BUILDER-CAPSULE-004', 'Capsule package digest does not match recomputed Builder Input digest.'));
  if (identity && capsule.selected_candidate_id !== identity.selected_candidate_id) diagnostics.push(diagnostic('BUILDER-CAPSULE-005', 'Capsule candidate does not match Builder Input candidate.'));
  if (identity && capsule.builder_context_schema !== identity.builder_context_schema) diagnostics.push(diagnostic('BUILDER-CAPSULE-006', 'Capsule Builder Context Schema does not match Builder Input.'));

  return {
    passed: builderInput.passed && diagnostics.length === 0,
    diagnostics,
    builderInput,
    capsule
  };
}

function loadTransitions() {
  const authority = JSON.parse(fs.readFileSync(TRANSITIONS_PATH, 'utf8'));
  if (authority.schema !== 'ev4-builder-state-transitions@1.0.0') throw new Error('Unsupported canonical transition table schema.');
  return authority;
}

export function requireCanonicalTransition(id) {
  const authority = loadTransitions();
  const matches = (authority.transitions || []).filter((entry) => entry.id === id);
  if (matches.length !== 1) throw new Error(`Canonical transition ${id} must exist exactly once.`);
  const transition = matches[0];

  if (id === 'resume') {
    if (
      transition.trigger !== 'استارت'
      || transition.from?.runtime_state !== 'PAUSED'
      || transition.to !== 'PREVIOUS_RESUMABLE_STATE'
      || !sameSet(transition.guards, RESUME_GUARDS)
    ) throw new Error('Canonical Resume transition is incompatible with the bounded implementation.');
  }

  if (id === 'complete-builder') {
    if (
      transition.trigger !== 'completion_validation_passed'
      || transition.from?.workflow_mode !== 'APPROVED_HANDOFF_MODE'
      || transition.from?.runtime_state !== 'BUILD_ACTIVE'
      || transition.to?.workflow_mode !== 'APPROVED_HANDOFF_MODE'
      || transition.to?.runtime_state !== 'COMPLETED'
      || !sameSet(transition.guards, COMPLETION_GUARDS)
    ) throw new Error('Canonical Completion transition is incompatible with the bounded implementation.');
  }

  return { authority, transition };
}

export function verifyRuntimeIdentity(verification, session, checkpoint) {
  const diagnostics = [];
  const identity = verification.builderInput?.identity || verification.identity;
  if (!identity) {
    diagnostics.push(diagnostic('BUILDER-IDENTITY-001', 'Verified Builder Input identity is required.'));
    return { passed: false, diagnostics, identity: null };
  }
  if (!session?.session_id || session.session_id !== checkpoint?.session_id) diagnostics.push(diagnostic('BUILDER-IDENTITY-002', 'Session ID does not match Checkpoint.'));
  if (session?.package_digest !== identity.canonical_package_digest || checkpoint?.package_digest !== identity.canonical_package_digest) diagnostics.push(diagnostic('BUILDER-IDENTITY-003', 'Runtime package digest does not match Builder Input.'));
  if (session?.selected_candidate_id !== identity.selected_candidate_id || checkpoint?.selected_candidate_id !== identity.selected_candidate_id) diagnostics.push(diagnostic('BUILDER-IDENTITY-004', 'Runtime candidate does not match Builder Input.'));
  if (
    session?.last_verified_checkpoint?.checkpoint_id !== checkpoint?.checkpoint_id
    || sortedCanonicalJson(session?.last_verified_checkpoint) !== sortedCanonicalJson(checkpoint)
  ) diagnostics.push(diagnostic('BUILDER-IDENTITY-005', 'Session State does not embed the exact current Checkpoint.'));
  return { passed: diagnostics.length === 0, diagnostics, identity };
}

export function validateResumeTransition({ sourceFile, capsuleFile, sessionFile, checkpointFile }) {
  const diagnostics = [];
  let canonical;
  try {
    canonical = requireCanonicalTransition('resume');
  } catch (error) {
    diagnostics.push(diagnostic('BUILDER-RESUME-001', error.message));
  }

  const capsuleVerification = verifyIntakeCapsule(sourceFile, capsuleFile);
  diagnostics.push(...capsuleVerification.diagnostics);
  const session = readJson(sessionFile);
  const checkpoint = readJson(checkpointFile);
  const sessionValidation = validateSessionFile(sessionFile);
  const checkpointValidation = validateCheckpointFile(checkpointFile);
  if (!sessionValidation.passed) diagnostics.push(diagnostic('BUILDER-RESUME-002', 'Session State validation failed.', sessionValidation.semantic.detail || sessionValidation.schema.detail));
  if (!checkpointValidation.passed) diagnostics.push(diagnostic('BUILDER-RESUME-003', 'Checkpoint validation failed.', checkpointValidation.semantic.detail || checkpointValidation.schema.detail));

  const runtimeIdentity = verifyRuntimeIdentity(capsuleVerification, session, checkpoint);
  diagnostics.push(...runtimeIdentity.diagnostics);

  const blockers = checkpointBlockers(checkpoint);
  const sessionBlockers = Array.isArray(session.unresolved_evidence) ? session.unresolved_evidence : [];
  if (!blockers.every((item) => sessionBlockers.includes(item))) diagnostics.push(diagnostic('BUILDER-RESUME-004', 'Unresolved Checkpoint blockers disappeared from Session State.'));

  const target = session.resume_target;
  const allowed = canonical?.authority?.allowed_combinations?.[target?.workflow_mode] || [];
  const targetLegal = session.runtime_state === 'PAUSED'
    && session.current_state === 'PAUSED'
    && target
    && target.runtime_state !== 'COMPLETED'
    && allowed.includes(target.runtime_state)
    && target.workflow_mode === checkpoint.workflow_mode
    && target.runtime_state === checkpoint.runtime_state;
  if (!targetLegal) diagnostics.push(diagnostic('BUILDER-RESUME-005', 'Resume target is missing, illegal, terminal, or inconsistent with the current Checkpoint.'));
  if (!checkpointSequenceIsValid(checkpoint)) diagnostics.push(diagnostic('BUILDER-RESUME-006', 'Checkpoint sequence/parent shape is invalid.'));

  const nextSession = structuredClone(session);
  if (diagnostics.length === 0) {
    nextSession.workflow_mode = target.workflow_mode;
    nextSession.runtime_state = target.runtime_state;
    nextSession.current_state = target.runtime_state;
    delete nextSession.resume_target;
  }

  return {
    passed: diagnostics.length === 0,
    diagnostics,
    transition: canonical?.transition ?? null,
    identity: runtimeIdentity.identity,
    session,
    checkpoint,
    nextSession,
    nextCheckpoint: structuredClone(checkpoint),
    blockers
  };
}

function expectedActions(pkg) {
  const actions = pkg?.first_builder_batch?.actions;
  const diagnostics = [];
  if (!Array.isArray(actions) || actions.length === 0) {
    diagnostics.push(diagnostic('BUILDER-ACTIONS-001', 'Builder Input does not define a non-empty first_builder_batch.actions universe.'));
    return { passed: false, diagnostics, expected_action_ids: [], batch_id: null };
  }
  const ids = actions.map((action) => action?.action_id);
  if (ids.some((value) => typeof value !== 'string' || !value)) diagnostics.push(diagnostic('BUILDER-ACTIONS-002', 'Every expected Action must have a non-empty action_id.'));
  if (!unique(ids)) diagnostics.push(diagnostic('BUILDER-ACTIONS-003', 'Builder Input contains duplicate expected Action IDs.'));
  const batches = ids.map((value) => value?.match(/^(.+)-A\d+$/)?.[1] ?? null);
  if (batches.some((value) => !value) || new Set(batches).size !== 1) diagnostics.push(diagnostic('BUILDER-ACTIONS-004', 'Expected Action IDs must identify one unambiguous bounded Action Batch.'));
  return { passed: diagnostics.length === 0, diagnostics, expected_action_ids: ids, batch_id: batches[0] ?? null };
}

export function reconcileRequiredActions(pkg, checkpoint) {
  const source = expectedActions(pkg);
  const diagnostics = [...source.diagnostics];
  const confirmed = Array.isArray(checkpoint?.confirmed_action_ids) ? checkpoint.confirmed_action_ids : [];
  const unconfirmed = Array.isArray(checkpoint?.unconfirmed_action_ids) ? checkpoint.unconfirmed_action_ids : [];
  if (!unique(confirmed)) diagnostics.push(diagnostic('BUILDER-ACTIONS-005', 'confirmed_action_ids contains duplicates.'));
  if (!unique(unconfirmed)) diagnostics.push(diagnostic('BUILDER-ACTIONS-006', 'unconfirmed_action_ids contains duplicates.'));
  const overlap = confirmed.filter((value) => unconfirmed.includes(value));
  if (overlap.length) diagnostics.push(diagnostic('BUILDER-ACTIONS-007', `Action IDs have conflicting dispositions: ${overlap.join(', ')}.`));
  const observed = [...new Set([...confirmed, ...unconfirmed])];
  const missing = source.expected_action_ids.filter((value) => !observed.includes(value));
  const foreign = observed.filter((value) => !source.expected_action_ids.includes(value));
  if (missing.length) diagnostics.push(diagnostic('BUILDER-ACTIONS-008', `Required Actions disappeared by omission: ${missing.join(', ')}.`));
  if (foreign.length) diagnostics.push(diagnostic('BUILDER-ACTIONS-009', `Checkpoint contains foreign Action IDs: ${foreign.join(', ')}.`));
  if (source.batch_id && checkpoint?.batch_id !== source.batch_id) diagnostics.push(diagnostic('BUILDER-ACTIONS-010', `Checkpoint batch_id must equal ${source.batch_id}.`));
  if (unconfirmed.length) diagnostics.push(diagnostic('BUILDER-ACTIONS-011', `Completion has unconfirmed required Actions: ${unconfirmed.join(', ')}.`));
  if (!sameSet(confirmed, source.expected_action_ids)) diagnostics.push(diagnostic('BUILDER-ACTIONS-012', 'Every expected required Action must be confirmed exactly once for Completion.'));
  return {
    passed: source.passed && diagnostics.length === 0,
    diagnostics,
    expected_action_ids: source.expected_action_ids,
    confirmed_action_ids: confirmed,
    unconfirmed_action_ids: unconfirmed,
    batch_id: source.batch_id
  };
}

function validateBuilderCompletionStatus(statusFile) {
  const diagnostics = [];
  const validation = validateCompletionStatusFile(statusFile);
  const status = readJson(statusFile);
  if (!validation.passed) diagnostics.push(diagnostic('BUILDER-STATUS-001', 'Completion Status Schema or semantic validation failed.', validation.semantic.detail || validation.schema.detail));
  if (status.claim_scope !== 'desktop') diagnostics.push(diagnostic('BUILDER-STATUS-002', 'The active bounded Builder completion scope is desktop.'));
  for (const state of ['scaffold_built', 'structure_built', 'content_filled', 'desktop_layout_established', 'export_checked']) {
    if (status.states?.[state] !== true) diagnostics.push(diagnostic('BUILDER-STATUS-003', `Required Builder completion state is false: ${state}.`));
  }
  if (status.evidence?.export !== true) diagnostics.push(diagnostic('BUILDER-STATUS-004', 'Bounded Builder completion requires export evidence truth to be true.'));
  if (status.scope_excludes_responsive !== true) diagnostics.push(diagnostic('BUILDER-STATUS-005', 'Desktop Builder completion must explicitly exclude Responsive completion.'));
  if (status.production_ready !== false) diagnostics.push(diagnostic('BUILDER-STATUS-006', 'Builder completion must keep production_ready false.'));
  return { passed: diagnostics.length === 0, diagnostics, status };
}

function validateGate(gateFile, identity, session, checkpoint) {
  const diagnostics = [];
  const validation = validateCompletionGateFile(gateFile);
  const gate = readJson(gateFile);
  if (!validation.passed) diagnostics.push(diagnostic('BUILDER-GATE-001', 'Completion Gate Schema or semantic validation failed.', validation.semantic.detail || validation.schema.detail));
  if (gate.selected_candidate_id !== identity.selected_candidate_id) diagnostics.push(diagnostic('BUILDER-GATE-002', 'Completion Gate candidate is foreign.'));
  if (gate.package_digest !== identity.canonical_package_digest) diagnostics.push(diagnostic('BUILDER-GATE-003', 'Completion Gate package digest is foreign.'));
  if (gate.session_id !== session.session_id) diagnostics.push(diagnostic('BUILDER-GATE-004', 'Completion Gate Session ID is foreign.'));
  if (gate.checkpoint_id !== checkpoint.checkpoint_id) diagnostics.push(diagnostic('BUILDER-GATE-005', 'Completion Gate Checkpoint ID is stale or foreign.'));
  if (gate.checkpoint_sequence !== checkpoint.checkpoint_sequence) diagnostics.push(diagnostic('BUILDER-GATE-006', 'Completion Gate Checkpoint sequence is stale or foreign.'));
  const evidenceIds = new Set((checkpoint.evidence_ledger || []).map((entry) => entry.evidence_id));
  for (const [proofName, proof] of Object.entries(gate.proofs || {})) {
    for (const evidenceRef of proof?.evidence_refs || []) {
      if (!evidenceIds.has(evidenceRef)) diagnostics.push(diagnostic('BUILDER-GATE-007', `Completion Gate proof ${proofName} references foreign evidence ${evidenceRef}.`));
    }
  }
  return { passed: diagnostics.length === 0, diagnostics, gate };
}

export function validateCompletionTransition({ sourceFile, capsuleFile, sessionFile, checkpointFile, statusFile, gateFile }) {
  const diagnostics = [];
  let canonical;
  try {
    canonical = requireCanonicalTransition('complete-builder');
  } catch (error) {
    diagnostics.push(diagnostic('BUILDER-COMPLETE-001', error.message));
  }

  const capsuleVerification = verifyIntakeCapsule(sourceFile, capsuleFile);
  diagnostics.push(...capsuleVerification.diagnostics);
  const session = readJson(sessionFile);
  const checkpoint = readJson(checkpointFile);
  const sessionValidation = validateSessionFile(sessionFile);
  const checkpointValidation = validateCheckpointFile(checkpointFile);
  if (!sessionValidation.passed) diagnostics.push(diagnostic('BUILDER-COMPLETE-002', 'Predecessor Session State validation failed.', sessionValidation.semantic.detail || sessionValidation.schema.detail));
  if (!checkpointValidation.passed) diagnostics.push(diagnostic('BUILDER-COMPLETE-003', 'Predecessor Checkpoint validation failed.', checkpointValidation.semantic.detail || checkpointValidation.schema.detail));

  const runtimeIdentity = verifyRuntimeIdentity(capsuleVerification, session, checkpoint);
  diagnostics.push(...runtimeIdentity.diagnostics);
  if (
    session.workflow_mode !== 'APPROVED_HANDOFF_MODE'
    || session.runtime_state !== 'BUILD_ACTIVE'
    || session.current_state !== 'BUILD_ACTIVE'
    || checkpoint.workflow_mode !== 'APPROVED_HANDOFF_MODE'
    || checkpoint.runtime_state !== 'BUILD_ACTIVE'
  ) diagnostics.push(diagnostic('BUILDER-COMPLETE-004', 'Completion requires an APPROVED_HANDOFF_MODE / BUILD_ACTIVE predecessor Session State and Checkpoint.'));
  if (!checkpointSequenceIsValid(checkpoint)) diagnostics.push(diagnostic('BUILDER-COMPLETE-005', 'Predecessor Checkpoint sequence/parent shape is invalid.'));

  const blockers = [...new Set([
    ...(Array.isArray(session.unresolved_evidence) ? session.unresolved_evidence : []),
    ...checkpointBlockers(checkpoint)
  ])];
  if (blockers.length) diagnostics.push(diagnostic('BUILDER-COMPLETE-006', `Completion has unresolved blockers: ${blockers.join(', ')}.`));

  const actionReconciliation = reconcileRequiredActions(capsuleVerification.builderInput?.package, checkpoint);
  diagnostics.push(...actionReconciliation.diagnostics);
  const completionStatus = validateBuilderCompletionStatus(statusFile);
  diagnostics.push(...completionStatus.diagnostics);
  const gate = runtimeIdentity.identity
    ? validateGate(gateFile, runtimeIdentity.identity, session, checkpoint)
    : { passed: false, diagnostics: [diagnostic('BUILDER-GATE-000', 'Runtime identity unavailable.')], gate: null };
  diagnostics.push(...gate.diagnostics);

  let nextCheckpoint = null;
  let nextSession = null;
  if (diagnostics.length === 0) {
    const key = computeCanonicalDigest({
      session_id: session.session_id,
      package_digest: runtimeIdentity.identity.canonical_package_digest,
      checkpoint_id: checkpoint.checkpoint_id,
      checkpoint_sequence: checkpoint.checkpoint_sequence,
      expected_action_ids: actionReconciliation.expected_action_ids
    }).slice(0, 12);
    nextCheckpoint = structuredClone(checkpoint);
    nextCheckpoint.checkpoint_id = `${checkpoint.checkpoint_id}-COMPLETE-${key}`;
    nextCheckpoint.checkpoint_sequence = checkpoint.checkpoint_sequence + 1;
    nextCheckpoint.parent_checkpoint_id = checkpoint.checkpoint_id;
    nextCheckpoint.workflow_mode = 'APPROVED_HANDOFF_MODE';
    nextCheckpoint.runtime_state = 'COMPLETED';
    nextCheckpoint.unresolved_blockers = [];
    const predecessorTime = Date.parse(checkpoint.created_at || '');
    nextCheckpoint.created_at = Number.isFinite(predecessorTime)
      ? new Date(predecessorTime + 1000).toISOString()
      : '1970-01-01T00:00:01.000Z';
    nextCheckpoint.created_from = 'diagnostic';

    nextSession = structuredClone(session);
    nextSession.workflow_mode = 'APPROVED_HANDOFF_MODE';
    nextSession.runtime_state = 'COMPLETED';
    nextSession.current_state = 'COMPLETED';
    nextSession.last_verified_checkpoint = nextCheckpoint;
    nextSession.unresolved_evidence = [];
    delete nextSession.resume_target;
  }

  return {
    passed: diagnostics.length === 0,
    diagnostics,
    transition: canonical?.transition ?? null,
    identity: runtimeIdentity.identity,
    session,
    checkpoint,
    nextSession,
    nextCheckpoint,
    actionReconciliation,
    completionStatus: completionStatus.status,
    completionGate: gate.gate,
    blockers
  };
}

export function validateGeneratedResumeCarriers(stageDirectory) {
  const session = validateSessionFile(path.join(stageDirectory, 'session-state.json'));
  const checkpoint = validateCheckpointFile(path.join(stageDirectory, 'checkpoint.json'));
  const result = runAjv('schemas/builder-runtime-transition-result.v1.schema.json', path.join(stageDirectory, 'resume-result.json'));
  return { passed: session.passed && checkpoint.passed && result.passed, session, checkpoint, result };
}

export function validateGeneratedCompletionCarriers(stageDirectory) {
  const session = validateSessionFile(path.join(stageDirectory, 'session-state.json'));
  const checkpoint = validateCheckpointFile(path.join(stageDirectory, 'checkpoint.json'));
  const result = runAjv('schemas/builder-runtime-transition-result.v1.schema.json', path.join(stageDirectory, 'completion-result.json'));
  return { passed: session.passed && checkpoint.passed && result.passed, session, checkpoint, result };
}

export function publishDirectoryAtomically(outputDirectory, files, validateStage) {
  const target = resolveFile(outputDirectory);
  if (fs.existsSync(target)) throw new Error(`Output directory already exists: ${target}`);
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });
  const stage = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.mkdirSync(stage, { recursive: false });
  try {
    const entries = Object.entries(files);
    for (const [name, value] of entries.filter(([name]) => !name.endsWith('-result.json'))) {
      fs.writeFileSync(path.join(stage, name), `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    }
    for (const [name, value] of entries.filter(([name]) => name.endsWith('-result.json'))) {
      fs.writeFileSync(path.join(stage, name), `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    }
    const validation = validateStage(stage);
    if (!validation.passed) throw new Error(`Generated carrier validation failed: ${JSON.stringify(validation)}`);
    fs.renameSync(stage, target);
    return { atomic: true, output_directory: path.relative(ROOT, target), files: Object.keys(files).sort() };
  } catch (error) {
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}
