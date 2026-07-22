import { diagnostic, exactFileSha, writeAtomic } from './builder-inspector-common.mjs';
import { verifyStateBindings } from './builder-inspector-carriers.mjs';
import { validatePersonalTransition } from './builder-personal-transition.mjs';

const RESUME_SCHEMA = 'ev4-builder-resume-authorization@1.0.0';

export function authorizeResume(options) {
  const bindings = verifyStateBindings(options.input, options.capsule, options.stateCapsule, options.sessionState, options.checkpoint);
  const diagnostics = [...bindings.diagnostics];
  const state = bindings.state;
  let resumeState = null;
  if (state) {
    const next = { ...state };
    if (state.runtime_state === 'PAUSED') next.runtime_state = state.previous_resumable_state;
    diagnostics.push(...validatePersonalTransition(state, next, 'resume', { intakeAuthorized: true }));
    if (['INTAKE_WAITING', 'INTAKE_VALIDATING', 'COMPLETED'].includes(state.runtime_state)) diagnostics.push(diagnostic('BINS-RESUME-001', `State ${state.runtime_state} is not resumable.`, '$.runtime_state', 'Use fresh intake or resumable state.'));
    resumeState = state.runtime_state === 'PAUSED' ? state.previous_resumable_state : state.runtime_state;
  }
  const accepted = diagnostics.length === 0;
  const result = {
    schema: RESUME_SCHEMA,
    status: accepted ? 'accepted' : 'blocked',
    session_id: state?.session_id ?? null,
    canonical_package_digest: state?.canonical_package_digest ?? null,
    selected_candidate_id: state?.selected_candidate_id ?? null,
    resume_workflow_mode: accepted ? state.workflow_mode : null,
    resume_runtime_state: accepted ? resumeState : null,
    source_state_capsule_sha256: state ? exactFileSha(options.stateCapsule) : null,
    blocking_diagnostics: diagnostics,
    production_ready: false
  };
  writeAtomic(options.output, result, { replace: options.replace, forbiddenSources: [options.input, options.capsule, options.stateCapsule, options.sessionState, options.checkpoint] });
  return { ok: accepted, diagnostics, result };
}
