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
const HASH = /^[a-f0-9]{64}$/;
const TRANSITIONS_PATH = path.join(ROOT, 'runtime', 'state-transitions.v1.json');

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

export function readBytes(file) {
  return fs.readFileSync(resolveFile(file));
}

export function readJson(file) {
  return JSON.parse(readBytes(file).toString('utf8'));
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
    detail: result.error?.message || diagnosticText(result),
    exit_code: result.status ?? 1
  };
}

export function runAjv(schema, data, refs = []) {
  const args = [
    '--yes',
    'ajv-cli@5',
    'validate',
    '--spec=draft2020',
    '--strict=false',
    '-s', schema
  ];
  for (const ref of refs) args.push('-r', ref);
  args.push('-d', data);
  return run(NPX, args);
}

export function runNode(script, ...args) {
  return run(process.execPath, [script, ...args]);
}

function addDiagnostic(target, code, message, detail = '') {
  target.push({ code, message, ...(detail ? { detail } : {}) });
}

function unique(values) {
  return new Set(values).size === values.length;
}

function sameStringSet(left, right) {
  return left.length === right.length
    && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function checkpointBlockers(checkpoint) {
  const explicit = Array.isArray(checkpoint?.unresolved_blockers) ? checkpoint.unresolved_blockers : [];
  const assertions = (checkpoint?.assertions || [])
    .filter((entry) => ['not_checked', 'insufficient_evidence'].includes(entry?.status))
    .map((entry) => entry.assertion_id || entry.subject_ref || 'unresolved_assertion');
  return [...new Set([...explicit, ...assertions])];
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
  const schema = runAjv('schemas/checkpoint.schema.json', file, [
    'schemas/evidence-record.schema.json'
  ]);
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

export function verifyBuilderInput(sourceFile) {
  const diagnostics = [];
  const bytes = readBytes(sourceFile);
  const sourceFileSha256 = sha256Bytes(bytes);
  let pkg = null;

  try {
    pkg = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    addDiagnostic(diagnostics, 'BUILDER-INPUT-001', 'Builder Input is malformed JSON.', error.message);
    return { passed: false, diagnostics, identity: null, package: null };
  }

  if (pkg.schema !== 'ev4-builder-context-package@1.0.0') {
    addDiagnostic(diagnostics, 'BUILDER-INPUT-002', 'Unsupported Builder Input Schema.', `received=${pkg.schema ?? '<missing>'}`);
  }

  if (diagnostics.length === 0) {
    const checks = [
      ['BUILDER-INPUT-003', 'Builder Context Schema validation failed.', runAjv('schemas/builder-context-package.schema.json', sourceFile)],
      ['BUILDER-INPUT-004', 'Builder semantic/cross-field validation failed.', runNode('scripts/validate-package.mjs', sourceFile)],
      ['BUILDER-INPUT-005', 'Decision-lineage validation failed.', runNode('scripts/validate-builder-context-decision-lineage.mjs', sourceFile)]
    ];
    for (const [code, message, result] of checks) {
      if (!result.passed) addDiagnostic(diagnostics, code, message, result.detail);
    }
  }

  if (pkg.selected_candidate_locked !== true || typeof pkg.selected_candidate_id !== 'string' || !pkg.selected_candidate_id) {
    addDiagnostic(diagnostics, 'BUILDER-INPUT-006', 'Selected candidate identity is not locked and usable.');
  }

  const authorization = pkg.input_authorization;
  if (
    authorization?.decision !== 'approved'
    || authorization?.eligible_workflow_mode !== 'APPROVED_HANDOFF_MODE'
    || authorization?.eligible_runtime_state !== 'BUILD_ACTIVE'
    || (authorization.blocking_diagnostics || []).length !== 0
  ) {
    addDiagnostic(diagnostics, 'BUILDER-INPUT-007', 'input_authorization does not authorize a normal Builder Run.');
  }

  const canonicalPackageDigest = computePackageDigest(pkg);
  if (authorization?.package_digest?.value !== canonicalPackageDigest) {
    addDiagnostic(diagnostics, 'BUILDER-INPUT-008', 'Package digest does not match canonical Builder Input content.');
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
  let capsule = null;

  try {
    capsule = readJson(capsuleFile);
  } catch (error) {
    addDiagnostic(diagnostics, 'BUILDER-CAPSULE-001', 'Intake Capsule is unreadable or malformed.', error.message);
    return { passed: false, diagnostics, builderInput, capsule: null };
  }

  const identity = builderInput.identity;
  const acceptedShape = capsule?.schema === 'ev4-builder-intake-result@1.0.0'
    && capsule.status === 'accepted'
    && HASH.test(capsule.source_file_sha256 || '')
    && HASH.test(capsule.canonical_package_digest || '')
    && Array.isArray(capsule.blocking_diagnostics)
    && capsule.blocking_diagnostics.length === 0
    && capsule.source_file_unchanged === true
    && capsule.publication?.atomic === true;

  if (!acceptedShape) addDiagnostic(diagnostics, 'BUILDER-CAPSULE-002', 'Capsule is not a complete accepted derived Intake result.');
  if (identity && capsule?.source_file_sha256 !== identity.source_file_sha256) addDiagnostic(diagnostics, 'BUILDER-CAPSULE-003', 'Capsule source SHA-256 does not match actual Builder Input bytes.');
  if (identity && capsule?.canonical_package_digest !== identity.canonical_package_digest) addDiagnostic(diagnostics, 'BUILDER-CAPSULE-004', 'Capsule package digest does not match recomputed Builder Input digest.');
  if (identity && capsule?.selected_candidate_id !== identity.selected_candidate_id) addDiagnostic(diagnostics, 'BUILDER-CAPSULE-005', 'Capsule candidate does not match Builder Input candidate.');
  if (identity && capsule?.builder_context_schema !== identity.builder_context_schema) addDiagnostic(diagnostics, 'BUILDER-CAPSULE-006', 'Capsule Builder Context Schema does not match Builder Input.');

  return {
    passed: builderInput.passed && diagnostics.length === 0,
    diagnostics,
    builderInput,
    capsule
  };
}

export function loadCanonicalTransitions() {
  const transitions = JSON.parse(fs.readFileSync(TRANSITIONS_PATH, 'utf8'));
  if (transitions.schema !== 'ev4-builder-state-transitions@1.0.0') {
    throw new Error('Unsupported canonical transition table schema.');
  }
  return transitions;
}

export function requireCanonicalTransition(id) {
  const authority = loadCanonicalTransitions();
  const matches = (authority.transitions || []).filter((entry) => entry.id === id);
  if (matches.length !== 1) throw new Error(`Canonical transition ${id} must exist exactly once.`);
  const transition = matches[0];

  if (id === 'resume') {
    if (transition.trigger !== 'استارت'
      || transition.from?.runtime_state !== 'PAUSED'
      || transition.to !== 'PREVIOUS_RESUMABLE_STATE'
      || !sameStringSet(transition.guards || [], RESUME_GUARDS)) {
      throw new Error('Canonical Resume transition is missing or incompatible with the bounded implementation.');
    }
  }

  if (id === 'complete-builder') {
    if (transition.trigger !== 'completion_validation_passed'
      || transition.from?.workflow_mode !== 'APPROVED_HANDOFF_MODE'
      || transition.from?.runtime_state !== 'BUILD_ACTIVE'
      || transition.to?.workflow_mode !== 'APPROVED_HANDOFF_MODE'
      || transition.to?.runtime_state !== 'COMPLETED'
      || !sameStringSet(transition.guards || [], COMPLETION_GUARDS)) {
      throw new Error('Canonical Completion transition is missing or incompatible with the bounded implementation.');
    }
  }

  return { authority, transition };
}

export function verifyRuntimeIdentity(builderVerification, session, checkpoint) {
  const diagnostics = [];
  const identity = builderVerification.builderInput?.identity || builderVerification.identity;
  if (!identity) {
    addDiagnostic(diagnostics, 'BUILDER-IDENTITY-001', 'Verified Builder Input identity is required.');
    return { passed: false, diagnostics };
  }

  if (!session?.session_id || session.session_id !== checkpoint?.session_id) addDiagnostic(diagnostics, 'BUILDER-IDENTITY-002', 'Session ID does not match Checkpoint.');
  if (session?.package_digest !== identity.canonical_package_digest || checkpoint?.package_digest !== identity.canonical_package_digest) addDiagnostic(diagnostics, 'BUILDER-IDENTITY-003', 'Runtime package digest does not match Builder Input.');
  if (session?.selected_candidate_id !== identity.selected_candidate_id || checkpoint?.selected_candidate_id !== identity.selected_candidate_id) addDiagnostic(diagnostics, 'BUILDER-IDENTITY-004', 'Runtime candidate does not match Builder Input.');
  if (session?.last_verified_checkpoint?.checkpoint_id !== checkpoint?.checkpoint_id
    || sortedCanonicalJson(session?.last_verified_checkpoint) !== sortedCanonicalJson(checkpoint)) {
    addDiagnostic(diagnostics, 'BUILDER-IDENTITY-005', 'Session State does not embed the exact current Checkpoint.');
  }

  return { passed: diagnostics.length === 0, diagnostics, identity };
}

function validateCheckpointParentShape(checkpoint) {
  if (!Number.isInteger(checkpoint?.checkpoint_sequence) || checkpoint.checkpoint_sequence < 1) return false;
  if (checkpoint.checkpoint_sequence === 1) return checkpoint.parent_checkpoint_id === null;
  return typeof checkpoint.parent_checkpoint_id === 'string' && checkpoint.parent_checkpoint_id.length > 0;
}

export function validateResumeTransition({ sourceFile, capsuleFile, sessionFile, checkpointFile }) {
  const diagnostics = [];
  let canonical = null;
  try {
    canonical = requireCanonicalTransition('resume');
  } catch (error) {
    addDiagnostic(diagnostics, 'BUILDER-RESUME-001', error.message);
  }

  const capsuleVerification = verifyIntakeCapsule(sourceFile, capsuleFile);
  diagnostics.push(...capsuleVerification.diagnostics);
  const session = readJson(sessionFile);
  const checkpoint = readJson(checkpointFile);
  const sessionValidation = validateSessionFile(sessionFile);
  const checkpointValidation = validateCheckpointFile(checkpointFile);
  if (!sessionValidation.passed) addDiagnostic(diagnostics, 'BUILDER-RESUME-002', 'Session State validation failed.', sessionValidation.semantic.detail || sessionValidation.schema.detail);
  if (!checkpointValidation.passed) addDiagnostic(diagnostics, 'BUILDER-RESUME-003', 'Checkpoint validation failed.', checkpointValidation.semantic.detail || checkpointValidation.schema.detail);

  const runtimeIdentity = verifyRuntimeIdentity(capsuleVerification, session, checkpoint);
  diagnostics.push(...runtimeIdentity.diagnostics);
  const blockers = checkpointBlockers(checkpoint);
  const sessionBlockers = Array.isArray(session.unresolved_evidence) ? session.unresolved_evidence : [];
  const blockersPreserved = blockers.every((item) => sessionBlockers.includes(item));
  if (!blockersPreserved) addDiagnostic(diagnostics, 'BUILDER-RESUME-004', 'Unresolved Checkpoint blockers disappeared from Session State.');

  const target = session.resume_target;
  const allowed = canonical?.authority?.allowed_combinations?.[target?.workflow_mode] || [];
  const targetLegal = session.runtime_state === 'PAUSED'
    && session.current_state === 'PAUSED'
    && target
    && target.runtime_state !== 'COMPLETED'
    && allowed.includes(target.runtime_state)
    && target.workflow_mode === checkpoint.workflow_mode
    && target.runtime_state === checkpoint.runtime_state;
  if (!targetLegal) addDiagnostic(diagnostics, 'BUILDER-RESUME-005', 'Resume target is missing, illegal, terminal, or inconsistent with the current Checkpoint.');
  if (!validateCheckpointParentShape(checkpoint)) addDiagnostic(diagnostics, 'BUILDER-RESUME-006', 'Checkpoint sequence/parent shape is invalid.');

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
    identity: runtimeIdentity.identity ?? null,
    session,
    checkpoint,
    nextSession,
    nextCheckpoint: structuredClone(checkpoint),
    blockers
  };
}

export function expectedActionsFromBuilderInput(pkg) {
  const actions = pkg?.first_builder_batch?.actions;
  if (!Array.isArray(actions) || actions.length === 0) {
    return { passed: false, diagnostics: [{ code: 'BUILDER-ACTIONS-001', message: 'Builder Input does not define a non-empty first_builder_batch.actions universe.' }] };
  }
  const expectedActionIds = actions.map((action) => action?.action_id);
  const diagnostics = [];
  if (expectedActionIds.some((value) => typeof value !== 'string' || !value)) addDiagnostic(diagnostics, 'BUILDER-ACTIONS-002', 'Every expected Action must have a non-empty action_id.');
  if (!unique(expectedActionIds)) addDiagnostic(diagnostics, 'BUILDER-ACTIONS-003', 'Builder Input contains duplicate expected Action IDs.');
  const batchIds = expectedActionIds.map((value) => value?.match(/^(.+)-A\d+$/)?.[1] ?? null);
  if (batchIds.some((value) => !value) || new Set(batchIds).size !== 1) addDiagnostic(diagnostics, 'BUILDER-ACTIONS-004', 'Expected Action IDs must identify one unambiguous bounded Action Batch.');
  return {
    passed: diagnostics.length === 0,
    diagnostics,
    expected_action_ids: expectedActionIds,
    batch_id: batchIds[0] ?? null
  };
}

export function reconcileRequiredActions(pkg, checkpoint) {
  const source = expectedActionsFromBuilderInput(pkg);
  const diagnostics = [...source.diagnostics];
  const confirmed = Array.isArray(checkpoint?.confirmed_action_ids) ? checkpoint.confirmed_action_ids : [];
  const unconfirmed = Array.isArray(checkpoint?.unconfirmed_action_ids) ? checkpoint.unconfirmed_action_ids : [];

  if (!unique(confirmed)) addDiagnostic(diagnostics, 'BUILDER-ACTIONS-005', 'confirmed_action_ids contains duplicates.');
  if (!unique(unconfirmed)) addDiagnostic(diagnostics, 'BUILDER-ACTIONS-006', 'unconfirmed_action_ids contains duplicates.');
  const overlap = confirmed.filter((value) => unconfirmed.includes(value));
  if (overlap.length > 0) addDiagnostic(diagnostics, 'BUILDER-ACTIONS-007', `Action IDs have conflicting dispositions: ${overlap.join(', ')}.`);

  const observed = [...new Set([...confirmed, ...unconfirmed])];
  const expected = source.expected_action_ids || [];
  const missing = expected.filter((value) => !observed.includes(value));
  const foreign = observed.filter((value) => !expected.includes(value));
  if (missing.length > 0) addDiagnostic(diagnostics, 'BUILDER-ACTIONS-008', `Required Actions disappeared by omission: ${missing.join(', ')}.`);
  if (foreign.length > 0) addDiagnostic(diagnostics, 'BUILDER-ACTIONS-009', `Checkpoint contains foreign Action IDs: ${foreign.join(', ')}.`);
  if (source.batch_id && checkpoint?.batch_id !== source.batch_id) addDiagnostic(diagnostics, 'BUILDER-ACTIONS-010', `Checkpoint batch_id must equal ${source.batch_id}.`);
  if (unconfirmed.length > 0) addDiagnostic(diagnostics, 'BUILDER-ACTIONS-011', `Completion has unconfirmed required Actions: ${unconfirmed.join(', ')}.`);
  if (confirmed.length !== expected.length || !sameStringSet(confirmed, expected)) addDiagnostic(diagnostics, 'BUILDER-ACTIONS-012', 'Every expected required Action must be confirmed exactly once for Completion.');

  return {
    passed: source.passed && diagnostics.length === 0,
    diagnostics,
    expected_action_ids: expected,
    confirmed_action_ids: confirmed,
    unconfirmed_action_ids: unconfirmed,
    batch_id: source.batch_id
  };
}

export function validateBuilderCompletionStatus(statusFile) {
  const validation = validateCompletionStatusFile(statusFile);
  const status = readJson(statusFile);
  const diagnostics = [];
  if (!validation.passed) addDiagnostic(diagnostics, 'BUILDER-STATUS-001', 'Completion Status Schema or semantic validation failed.', validation.semantic.detail || validation.schema.detail);
  if (status.claim_scope !== 'desktop') addDiagnostic(diagnostics, 'BUILDER-STATUS-002', 'The active bounded Builder completion scope is desktop.');
  const requiredStates = ['scaffold_built', 'structure_built', 'content_filled', 'desktop_layout_established', 'export_checked'];
  for (const state of requiredStates) {
    if (status.states?.[state] !== true) addDiagnostic(diagnostics, 'BUILDER-STATUS-003', `Required Builder completion state is false: ${state}.`);
  }
  if (status.evidence?.export !== true) addDiagnostic(diagnostics, 'BUILDER-STATUS-004', 'Bounded Builder completion requires export evidence truth to be true.');
  if (status.scope_excludes_responsive !== true) addDiagnostic(diagnostics, 'BUILDER-STATUS-005', 'Desktop Builder completion must explicitly exclude Responsive completion.');
  if (status.production_ready !== false) addDiagnostic(diagnostics, 'BUILDER-STATUS-006', 'Builder completion must keep production_ready false.');
  return { passed: diagnostics.length === 0, diagnostics, status, validation };
}

export function validateCompletionGateBinding(gateFile, identity, session, checkpoint) {
  const validation = validateCompletionGateFile(gateFile);
  const gate = readJson(gateFile);
  const diagnostics = [];
  if (!validation.passed) addDiagnostic(diagnostics, 'BUILDER-GATE-001', 'Completion Gate Schema or semantic validation failed.', validation.semantic.detail || validation.schema.detail);
  if (gate.selected_candidate_id !== identity.selected_candidate_id) addDiagnostic(diagnostics, 'BUILDER-GATE-002', 'Completion Gate candidate is foreign.');
  if (gate.package_digest !== identity.canonical_package_digest) addDiagnostic(diagnostics, 'BUILDER-GATE-003', 'Completion Gate package digest is foreign.');
  if (gate.session_id !== session.session_id) addDiagnostic(diagnostics, 'BUILDER-GATE-004', 'Completion Gate Session ID is foreign.');
  if (gate.checkpoint_id !== checkpoint.checkpoint_id) addDiagnostic(diagnostics, 'BUILDER-GATE-005', 'Completion Gate Checkpoint ID is stale or foreign.');
  if (gate.checkpoint_sequence !== checkpoint.checkpoint_sequence) addDiagnostic(diagnostics, 'BUILDER-GATE-006', 'Completion Gate Checkpoint sequence is stale or foreign.');

  const evidenceIds = new Set((checkpoint.evidence_ledger || []).map((entry) => entry.evidence_id));
  for (const [proofName, proof] of Object.entries(gate.proofs || {})) {
    for (const evidenceRef of proof?.evidence_refs || []) {
      if (!evidenceIds.has(evidenceRef)) addDiagnostic(diagnostics, 'BUILDER-GATE-007', `Completion Gate proof ${proofName} references foreign evidence ${evidenceRef}.`);
    }
  }

  return { passed: diagnostics.length === 0, diagnostics, gate, validation };
}

export function validateCompletionTransition({ sourceFile, capsuleFile, sessionFile, checkpointFile, statusFile, gateFile }) {
  const diagnostics = [];
  let canonical = null;
  try {
    canonical = requireCanonicalTransition('complete-builder');
  } catch (error) {
    addDiagnostic(diagnostics, 'BUILDER-COMPLETE-001', error.message);
  }

  const capsuleVerification = verifyIntakeCapsule(sourceFile, capsuleFile);
  diagnostics.push(...capsuleVerification.diagnostics);
  const session = readJson(sessionFile);
  const checkpoint = readJson(checkpointFile);
  const sessionValidation = validateSessionFile(sessionFile);
  const checkpointValidation = validateCheckpointFile(checkpointFile);
  if (!sessionValidation.passed) addDiagnostic(diagnostics, 'BUILDER-COMPLETE-002', 'Predecessor Session State validation failed.', sessionValidation.semantic.detail || sessionValidation.schema.detail);
  if (!checkpointValidation.passed) addDiagnostic(diagnostics, 'BUILDER-COMPLETE-003', 'Predecessor Checkpoint validation failed.', checkpointValidation.semantic.detail || checkpointValidation.schema.detail);

  const runtimeIdentity = verifyRuntimeIdentity(capsuleVerification, session, checkpoint);
  diagnostics.push(...runtimeIdentity.diagnostics);
  if (session.workflow_mode !== 'APPROVED_HANDOFF_MODE'
    || session.runtime_state !== 'BUILD_ACTIVE'
    || session.current_state !== 'BUILD_ACTIVE'
    || checkpoint.workflow_mode !== 'APPROVED_HANDOFF_MODE'
    || checkpoint.runtime_state !== 'BUILD_ACTIVE') {
    addDiagnostic(diagnostics, 'BUILDER-COMPLETE-004', 'Completion requires an APPROVED_HANDOFF_MODE / BUILD_ACTIVE predecessor Session State and Checkpoint.');
  }
  if (!validateCheckpointParentShape(checkpoint)) addDiagnostic(diagnostics, 'BUILDER-COMPLETE-005', 'Predecessor Checkpoint sequence/parent shape is invalid.');

  const blockers = [...new Set([
    ...(Array.isArray(session.unresolved_evidence) ? session.unresolved_evidence : []),
    ...checkpointBlockers(checkpoint)
  ])];
  if (blockers.length > 0) addDiagnostic(diagnostics, 'BUILDER-COMPLETE-006', `Completion has unresolved blockers: ${blockers.join(', ')}.`);

  const actionReconciliation = reconcileRequiredActions(capsuleVerification.builderInput?.package, checkpoint);
  diagnostics.push(...actionReconciliation.diagnostics);
  const statusValidation = validateBuilderCompletionStatus(statusFile);
  diagnostics.push(...statusValidation.diagnostics);
  const gateValidation = runtimeIdentity.identity
    ? validateCompletionGateBinding(gateFile, runtimeIdentity.identity, session, checkpoint)
    : { passed: false, diagnostics: [{ code: 'BUILDER-GATE-000', message: 'Runtime identity unavailable.' }], gate: null };
  diagnostics.push(...gateValidation.diagnostics);

  let nextCheckpoint = null;
  let nextSession = null;
  if (diagnostics.length === 0) {
    const completionKey = computeCanonicalDigest({
      session_id: session.session_id,
      package_digest: runtimeIdentity.identity.canonical_package_digest,
      checkpoint_id: checkpoint.checkpoint_id,
      checkpoint_sequence: checkpoint.checkpoint_sequence,
      expected_action_ids: actionReconciliation.expected_action_ids
    }).slice(0, 12);
    nextCheckpoint = structuredClone(checkpoint);
    nextCheckpoint.checkpoint_id = `${checkpoint.checkpoint_id}-COMPLETE-${completionKey}`;
    nextCheckpoint.checkpoint_sequence = checkpoint.checkpoint_sequence + 1;
    nextCheckpoint.parent_checkpoint_id = checkpoint.checkpoint_id;
    nextCheckpoint.workflow_mode = 'APPROVED_HANDOFF_MODE';
    nextCheckpoint.runtime_state = 'COMPLETED';
    nextCheckpoint.unresolved_blockers = [];
    nextCheckpoint.created_at = new Date().toISOString();
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
    identity: runtimeIdentity.identity ?? null,
    session,
    checkpoint,
    nextSession,
    nextCheckpoint,
    actionReconciliation,
    completionStatus: statusValidation.status,
    completionGate: gateValidation.gate,
    blockers
  };
}

export function validateGeneratedResumeCarriers(stageDirectory) {
  const sessionFile = path.join(stageDirectory, 'session-state.json');
  const checkpointFile = path.join(stageDirectory, 'checkpoint.json');
  const resultFile = path.join(stageDirectory, 'resume-result.json');
  const session = validateSessionFile(sessionFile);
  const checkpoint = validateCheckpointFile(checkpointFile);
  const result = runAjv('schemas/builder-runtime-transition-result.v1.schema.json', resultFile);
  return { passed: session.passed && checkpoint.passed && result.passed, session, checkpoint, result };
}

export function validateGeneratedCompletionCarriers(stageDirectory) {
  const sessionFile = path.join(stageDirectory, 'session-state.json');
  const checkpointFile = path.join(stageDirectory, 'checkpoint.json');
  const resultFile = path.join(stageDirectory, 'completion-result.json');
  const session = validateSessionFile(sessionFile);
  const checkpoint = validateCheckpointFile(checkpointFile);
  const result = runAjv('schemas/builder-runtime-transition-result.v1.schema.json', resultFile);
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
    const resultEntry = entries.find(([name]) => name.endsWith('-result.json'));
    for (const [name, value] of entries.filter(([name]) => !name.endsWith('-result.json'))) {
      fs.writeFileSync(path.join(stage, name), `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    }
    if (resultEntry) {
      fs.writeFileSync(path.join(stage, resultEntry[0]), `${JSON.stringify(resultEntry[1], null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
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
