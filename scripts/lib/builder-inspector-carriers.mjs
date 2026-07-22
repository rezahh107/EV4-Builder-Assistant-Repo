import { diagnostic, exactFileSha, readJson, run, schemaValidation, writeAtomic } from './builder-inspector-common.mjs';
import { validateIntakeCapsule } from './builder-inspector-intake.mjs';
import { isResumableState, validatePersonalTransition } from './builder-personal-transition.mjs';

export const STATE_SCHEMA = 'ev4-builder-personal-state-capsule@1.0.0';

export function validateCheckpointAndSession(sessionStatePath, checkpointPath) {
  const diagnostics = [];
  let session;
  let checkpoint;
  try { session = readJson(sessionStatePath); } catch (error) { diagnostics.push(diagnostic('BINS-STATE-001', `Invalid Session State JSON: ${error.message}`, sessionStatePath, 'Provide valid Session State.')); }
  try { checkpoint = readJson(checkpointPath); } catch (error) { diagnostics.push(diagnostic('BINS-STATE-002', `Invalid Checkpoint JSON: ${error.message}`, checkpointPath, 'Provide valid Checkpoint.')); }
  if (!session || !checkpoint) return { ok: false, diagnostics, session, checkpoint };
  const checks = [
    schemaValidation('schemas/checkpoint.schema.json', checkpointPath, ['schemas/evidence-record.schema.json']),
    run(process.execPath, ['scripts/validate-checkpoint.mjs', checkpointPath], 'Checkpoint semantic validation', 'BINS-STATE-003'),
    schemaValidation('schemas/session-state.schema.json', sessionStatePath, ['schemas/checkpoint.schema.json', 'schemas/evidence-record.schema.json', 'schemas/repair-packet.schema.json']),
    run(process.execPath, ['scripts/validate-session-state.mjs', sessionStatePath], 'Session State semantic validation', 'BINS-STATE-004')
  ];
  for (const check of checks) if (!check.ok) diagnostics.push(...check.diagnostics);
  if (JSON.stringify(session.last_verified_checkpoint) !== JSON.stringify(checkpoint)) diagnostics.push(diagnostic('BINS-STATE-005', 'Session State checkpoint does not exactly equal supplied Checkpoint.', '$.last_verified_checkpoint', 'Export matching carriers.'));
  if (session.current_state !== session.runtime_state) diagnostics.push(diagnostic('BINS-STATE-006', 'current_state must equal runtime_state.', '$.current_state', 'Correct Session State.'));
  return { ok: diagnostics.length === 0, diagnostics, session, checkpoint };
}

function stateBody(intake, session, checkpoint, options) {
  return {
    schema: STATE_SCHEMA,
    session_id: intake.session_id,
    source_file_sha256: intake.source_file_sha256,
    canonical_package_digest: intake.canonical_package_digest,
    selected_candidate_id: intake.selected_candidate_id,
    intake_capsule_sha256: exactFileSha(options.capsule),
    session_state_sha256: exactFileSha(options.sessionState),
    checkpoint_sha256: exactFileSha(options.checkpoint),
    workflow_mode: session.workflow_mode,
    runtime_state: session.runtime_state,
    previous_resumable_state: null,
    unresolved_blocking_evidence: [...new Set(session.unresolved_evidence || [])],
    parent_state_capsule_sha256: null,
    source_input_path_hint: options.input.split(/[\\/]/).at(-1),
    checkpoint_id: checkpoint.checkpoint_id,
    event: options.event
  };
}

export function createStateSnapshot(options) {
  const intakeResult = validateIntakeCapsule(options.input, options.capsule);
  const carrierResult = validateCheckpointAndSession(options.sessionState, options.checkpoint);
  const diagnostics = [...intakeResult.diagnostics, ...carrierResult.diagnostics];
  const intake = intakeResult.capsule;
  const session = carrierResult.session;
  const checkpoint = carrierResult.checkpoint;
  let previous = null;
  if (options.previousStateCapsule) {
    try { previous = readJson(options.previousStateCapsule); }
    catch (error) { diagnostics.push(diagnostic('BINS-SNAPSHOT-001', `Invalid previous state capsule: ${error.message}`, options.previousStateCapsule, 'Provide exact previous state capsule.')); }
  }
  if (intake && checkpoint?.package_sha256?.toLowerCase() !== intake.canonical_package_digest.toLowerCase()) diagnostics.push(diagnostic('BINS-SNAPSHOT-002', 'Checkpoint package digest mismatch.', '$.package_sha256', 'Bind Checkpoint to accepted input.'));
  if (intake && checkpoint?.selected_candidate_id !== intake.selected_candidate_id) diagnostics.push(diagnostic('BINS-SNAPSHOT-003', 'Checkpoint candidate mismatch.', '$.selected_candidate_id', 'Use accepted candidate.'));
  if (intake && session?.selected_candidate_id !== intake.selected_candidate_id) diagnostics.push(diagnostic('BINS-SNAPSHOT-004', 'Session candidate mismatch.', '$.selected_candidate_id', 'Use accepted candidate.'));
  if (diagnostics.length || !intake || !session || !checkpoint) return { ok: false, diagnostics };
  const next = stateBody(intake, session, checkpoint, options);
  next.previous_resumable_state = options.previousResumableState || previous?.previous_resumable_state || null;
  next.parent_state_capsule_sha256 = options.previousStateCapsule ? exactFileSha(options.previousStateCapsule) : null;
  if (session.runtime_state === 'PAUSED' && !next.previous_resumable_state && previous && isResumableState(previous.runtime_state)) next.previous_resumable_state = previous.runtime_state;
  diagnostics.push(...validatePersonalTransition(previous, next, options.event, { intakeAuthorized: true, completionAuthorized: options.completionAuthorized === true }));
  if (diagnostics.length) return { ok: false, diagnostics };
  writeAtomic(options.output, next, { replace: options.replace, forbiddenSources: [options.input, options.capsule, options.sessionState, options.checkpoint, options.previousStateCapsule] });
  return { ok: true, diagnostics: [], result: next };
}

export function verifyStateBindings(inputPath, intakePath, statePath, sessionStatePath, checkpointPath) {
  const intakeResult = validateIntakeCapsule(inputPath, intakePath);
  const carrierResult = validateCheckpointAndSession(sessionStatePath, checkpointPath);
  const diagnostics = [...intakeResult.diagnostics, ...carrierResult.diagnostics];
  let state;
  try { state = readJson(statePath); } catch (error) { diagnostics.push(diagnostic('BINS-STATE-007', `Invalid state capsule: ${error.message}`, statePath, 'Regenerate state capsule.')); }
  if (!state) return { ok: false, diagnostics, intakeResult, carrierResult, state: null };
  const schemaCheck = schemaValidation('schemas/builder-personal-state-capsule.schema.json', statePath);
  if (!schemaCheck.ok) diagnostics.push(...schemaCheck.diagnostics);
  const intake = intakeResult.capsule;
  const session = carrierResult.session;
  const checkpoint = carrierResult.checkpoint;
  const checks = [
    ['BINS-STATE-008', state.session_id, intake?.session_id, '$.session_id'],
    ['BINS-STATE-009', state.source_file_sha256, intake?.source_file_sha256, '$.source_file_sha256'],
    ['BINS-STATE-010', state.canonical_package_digest, intake?.canonical_package_digest, '$.canonical_package_digest'],
    ['BINS-STATE-011', state.selected_candidate_id, intake?.selected_candidate_id, '$.selected_candidate_id'],
    ['BINS-STATE-012', state.intake_capsule_sha256, intake ? exactFileSha(intakePath) : null, '$.intake_capsule_sha256'],
    ['BINS-STATE-013', state.session_state_sha256, session ? exactFileSha(sessionStatePath) : null, '$.session_state_sha256'],
    ['BINS-STATE-014', state.checkpoint_sha256, checkpoint ? exactFileSha(checkpointPath) : null, '$.checkpoint_sha256'],
    ['BINS-STATE-015', state.workflow_mode, session?.workflow_mode, '$.workflow_mode'],
    ['BINS-STATE-016', state.runtime_state, session?.runtime_state, '$.runtime_state']
  ];
  for (const [code, actual, expected, field] of checks) if (expected !== undefined && actual !== expected) diagnostics.push(diagnostic(code, `State binding mismatch at ${field}.`, field, 'Use exact matching carriers.'));
  if (checkpoint && intake && checkpoint.package_sha256.toLowerCase() !== intake.canonical_package_digest.toLowerCase()) diagnostics.push(diagnostic('BINS-STATE-017', 'Checkpoint package digest mismatch.', '$.package_sha256', 'Use accepted package digest.'));
  if (checkpoint && intake && checkpoint.selected_candidate_id !== intake.selected_candidate_id) diagnostics.push(diagnostic('BINS-STATE-018', 'Checkpoint candidate mismatch.', '$.selected_candidate_id', 'Use accepted candidate.'));
  if (session && intake && session.selected_candidate_id !== intake.selected_candidate_id) diagnostics.push(diagnostic('BINS-STATE-019', 'Session candidate mismatch.', '$.selected_candidate_id', 'Use accepted candidate.'));
  const a = [...new Set(session?.unresolved_evidence || [])].sort();
  const b = [...new Set(state.unresolved_blocking_evidence || [])].sort();
  if (JSON.stringify(a) !== JSON.stringify(b)) diagnostics.push(diagnostic('BINS-STATE-020', 'Unresolved blocker set mismatch.', '$.unresolved_blocking_evidence', 'Regenerate state capsule.'));
  return { ok: diagnostics.length === 0, diagnostics, intakeResult, carrierResult, state };
}
