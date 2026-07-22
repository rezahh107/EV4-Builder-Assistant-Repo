import { diagnostic, exactFileSha, readJson, run, schemaValidation, writeAtomic } from './builder-inspector-common.mjs';
import { verifyStateBindings } from './builder-inspector-carriers.mjs';
import { validatePersonalTransition } from './builder-personal-transition.mjs';

const COMPLETION_SCHEMA = 'ev4-builder-completion-authorization@1.0.0';

function validateCompletionCarriers(statusPath, gatePath) {
  const diagnostics = [];
  let status;
  let gate;
  try { status = readJson(statusPath); } catch (error) { diagnostics.push(diagnostic('BINS-COMPLETE-001', `Invalid Completion Status: ${error.message}`, statusPath, 'Provide valid status.')); }
  try { gate = readJson(gatePath); } catch (error) { diagnostics.push(diagnostic('BINS-COMPLETE-002', `Invalid Completion Gate: ${error.message}`, gatePath, 'Provide valid gate.')); }
  if (!status || !gate) return { ok: false, diagnostics, status, gate };
  const checks = [
    schemaValidation('schemas/completion-status.schema.json', statusPath),
    run(process.execPath, ['scripts/validate-completion-status.mjs', statusPath], 'Completion Status semantic validation', 'BINS-COMPLETE-003'),
    schemaValidation('schemas/completion-gate.schema.json', gatePath),
    run(process.execPath, ['scripts/validate-completion-gate.mjs', gatePath], 'Completion Gate semantic validation', 'BINS-COMPLETE-004')
  ];
  for (const check of checks) if (!check.ok) diagnostics.push(...check.diagnostics);
  if (status.production_ready !== false) diagnostics.push(diagnostic('BINS-COMPLETE-005', 'production_ready must remain false.', '$.production_ready', 'Keep false.'));
  if (status.scope_excludes_responsive !== true) diagnostics.push(diagnostic('BINS-COMPLETE-006', 'Builder completion must exclude Responsive.', '$.scope_excludes_responsive', 'Set true.'));
  if (gate.production_ready_allowed !== false || gate.production_ready_claim !== false) diagnostics.push(diagnostic('BINS-COMPLETE-007', 'Completion Gate must not authorize production readiness.', '$.production_ready_claim', 'Keep false.'));
  return { ok: diagnostics.length === 0, diagnostics, status, gate };
}

export function authorizeCompletion(options) {
  const bindings = verifyStateBindings(options.input, options.capsule, options.stateCapsule, options.sessionState, options.checkpoint);
  const completion = validateCompletionCarriers(options.completionStatus, options.completionGate);
  const diagnostics = [...bindings.diagnostics, ...completion.diagnostics];
  let previous;
  let previousSha = null;
  try { previous = readJson(options.previousStateCapsule); previousSha = exactFileSha(options.previousStateCapsule); }
  catch (error) { diagnostics.push(diagnostic('BINS-COMPLETE-008', `Invalid previous state: ${error.message}`, options.previousStateCapsule, 'Provide exact previous state.')); }
  const state = bindings.state;
  const session = bindings.carrierResult.session;
  const checkpoint = bindings.carrierResult.checkpoint;
  const pkg = bindings.intakeResult.validation.pkg;
  if (state && previousSha && state.parent_state_capsule_sha256 !== previousSha) diagnostics.push(diagnostic('BINS-COMPLETE-009', 'Final state is not direct child of previous state.', '$.parent_state_capsule_sha256', 'Provide actual previous state.'));
  if (state?.event !== 'completion_accepted') diagnostics.push(diagnostic('BINS-COMPLETE-010', 'Final state must record completion_accepted.', '$.event', 'Create final state after completion checks.'));
  if (session?.runtime_state !== 'COMPLETED' || session?.current_state !== 'COMPLETED') diagnostics.push(diagnostic('BINS-COMPLETE-011', 'Final Session State must be COMPLETED.', '$.runtime_state', 'Do not claim completion.'));
  if (checkpoint) {
    if ((checkpoint.unconfirmed_action_ids || []).length) diagnostics.push(diagnostic('BINS-COMPLETE-013', 'Final Checkpoint has unconfirmed actions.', '$.unconfirmed_action_ids', 'Confirm required actions.'));
    if ((checkpoint.assertions || []).some((item) => !['confirmed', 'not_applicable'].includes(item.status))) diagnostics.push(diagnostic('BINS-COMPLETE-014', 'Final Checkpoint has incomplete assertions.', '$.assertions', 'Resolve assertions.'));
    for (const action of pkg?.first_builder_batch?.actions || []) if (!(checkpoint.confirmed_action_ids || []).includes(action.action_id)) diagnostics.push(diagnostic('BINS-COMPLETE-015', `Required action not confirmed: ${action.action_id}`, '$.confirmed_action_ids', 'Complete action.'));
  }
  if ((session?.unresolved_evidence || []).length || (state?.unresolved_blocking_evidence || []).length) diagnostics.push(diagnostic('BINS-COMPLETE-016', 'Unresolved blockers remain.', '$.unresolved_evidence', 'Resolve blockers.'));
  if (previous && state) diagnostics.push(...validatePersonalTransition(previous, state, 'completion_accepted', { intakeAuthorized: true, completionAuthorized: completion.ok && diagnostics.length === 0 }));
  const accepted = diagnostics.length === 0;
  const result = {
    schema: COMPLETION_SCHEMA,
    status: accepted ? 'accepted' : 'blocked',
    completion_scope: 'builder_completion_only',
    session_id: state?.session_id ?? null,
    canonical_package_digest: state?.canonical_package_digest ?? null,
    selected_candidate_id: state?.selected_candidate_id ?? null,
    final_state_capsule_sha256: state ? exactFileSha(options.stateCapsule) : null,
    final_checkpoint_sha256: checkpoint ? exactFileSha(options.checkpoint) : null,
    blocking_diagnostics: diagnostics,
    responsive_complete: false,
    production_ready: false
  };
  writeAtomic(options.output, result, { replace: options.replace, forbiddenSources: [options.input, options.capsule, options.previousStateCapsule, options.stateCapsule, options.sessionState, options.checkpoint, options.completionStatus, options.completionGate] });
  return { ok: accepted, diagnostics, result };
}
