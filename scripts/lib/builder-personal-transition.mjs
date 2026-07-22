const ALLOWED_MODE_STATES = new Map([
  ['START_INTAKE_MODE', new Set(['INTAKE_WAITING', 'INTAKE_VALIDATING', 'EVIDENCE_REQUIRED', 'REVIEW_ONLY', 'CORRECTION', 'PAUSED', 'COMPLETED'])],
  ['APPROVED_HANDOFF_MODE', new Set(['BUILD_ACTIVE', 'WAITING_FOR_CONFIRMATION', 'EVIDENCE_REQUIRED', 'CORRECTION', 'REVIEW_ONLY', 'PAUSED', 'COMPLETED'])],
  ['FRESH_IMAGE_MODE_LIMITED', new Set(['INTAKE_WAITING', 'EVIDENCE_REQUIRED', 'BUILD_ACTIVE', 'WAITING_FOR_CONFIRMATION', 'CORRECTION', 'REVIEW_ONLY', 'PAUSED', 'COMPLETED'])]
]);

const RESUMABLE_STATES = new Set(['BUILD_ACTIVE', 'WAITING_FOR_CONFIRMATION', 'EVIDENCE_REQUIRED', 'CORRECTION', 'REVIEW_ONLY']);

function sameIdentity(previous, next) {
  return previous.session_id === next.session_id
    && previous.canonical_package_digest === next.canonical_package_digest
    && previous.selected_candidate_id === next.selected_candidate_id;
}

function blockerSet(value) {
  return new Set(Array.isArray(value?.unresolved_blocking_evidence) ? value.unresolved_blocking_evidence : []);
}

function blockersPreserved(previous, next) {
  const nextSet = blockerSet(next);
  return [...blockerSet(previous)].every((item) => nextSet.has(item));
}

function transitionKey(previous, next, event) {
  return `${previous?.runtime_state ?? 'null'}>${next.runtime_state}:${event}`;
}

export function validatePersonalTransition(previous, next, event, options = {}) {
  const diagnostics = [];
  const fail = (code, message) => diagnostics.push({ code, message });

  if (!next || typeof next !== 'object') return [{ code: 'BINS-TRN-001', message: 'next state capsule is required.' }];
  if (!ALLOWED_MODE_STATES.get(next.workflow_mode)?.has(next.runtime_state)) {
    fail('BINS-TRN-002', `Illegal workflow_mode/runtime_state pair: ${next.workflow_mode}/${next.runtime_state}.`);
  }
  if (!event) fail('BINS-TRN-003', 'A transition event is required.');

  if (!previous) {
    const allowedInitial = new Set([
      'null>INTAKE_WAITING:start_intake',
      'null>BUILD_ACTIVE:intake_authorized'
    ]);
    if (!allowedInitial.has(transitionKey(previous, next, event))) {
      fail('BINS-TRN-004', 'A new session may only start intake or enter BUILD_ACTIVE from a verified intake authorization.');
    }
    if (event === 'intake_authorized' && options.intakeAuthorized !== true) {
      fail('BINS-TRN-005', 'intake_authorized requires a verified accepted intake capsule.');
    }
    return diagnostics;
  }

  if (!sameIdentity(previous, next)) fail('BINS-TRN-006', 'Session, package digest, and selected candidate must remain continuous.');

  const key = transitionKey(previous, next, event);
  const legal = new Set([
    'INTAKE_WAITING>INTAKE_VALIDATING:input_received',
    'INTAKE_VALIDATING>BUILD_ACTIVE:intake_authorized',
    'BUILD_ACTIVE>WAITING_FOR_CONFIRMATION:batch_emitted',
    'WAITING_FOR_CONFIRMATION>BUILD_ACTIVE:confirmation_accepted',
    'BUILD_ACTIVE>PAUSED:pause',
    'WAITING_FOR_CONFIRMATION>PAUSED:pause',
    'EVIDENCE_REQUIRED>PAUSED:pause',
    'CORRECTION>PAUSED:pause',
    'REVIEW_ONLY>PAUSED:pause',
    'BUILD_ACTIVE>CORRECTION:correction_required',
    'WAITING_FOR_CONFIRMATION>CORRECTION:correction_required',
    'EVIDENCE_REQUIRED>CORRECTION:correction_required',
    'CORRECTION>BUILD_ACTIVE:repair_resolved',
    'BUILD_ACTIVE>REVIEW_ONLY:review_requested',
    'WAITING_FOR_CONFIRMATION>REVIEW_ONLY:review_requested',
    'EVIDENCE_REQUIRED>REVIEW_ONLY:review_requested',
    'REVIEW_ONLY>BUILD_ACTIVE:review_completed',
    'EVIDENCE_REQUIRED>BUILD_ACTIVE:evidence_resolved',
    'BUILD_ACTIVE>COMPLETED:completion_accepted',
    'BUILD_ACTIVE>BUILD_ACTIVE:repeated_start',
    'WAITING_FOR_CONFIRMATION>WAITING_FOR_CONFIRMATION:repeated_start',
    'EVIDENCE_REQUIRED>EVIDENCE_REQUIRED:repeated_start',
    'CORRECTION>CORRECTION:repeated_start',
    'REVIEW_ONLY>REVIEW_ONLY:repeated_start',
    'PAUSED>PAUSED:repeated_start'
  ]);

  if (previous.runtime_state === 'PAUSED' && event === 'resume') {
    if (!next.previous_resumable_state || next.runtime_state !== next.previous_resumable_state || !RESUMABLE_STATES.has(next.runtime_state)) {
      fail('BINS-TRN-007', 'PAUSED may resume only to its bound previous resumable state.');
    }
  } else if (event === 'resume' && RESUMABLE_STATES.has(previous.runtime_state)) {
    if (next.runtime_state !== previous.runtime_state || next.workflow_mode !== previous.workflow_mode) {
      fail('BINS-TRN-008', 'An active saved session resumes without changing its workflow or runtime state.');
    }
  } else if (!legal.has(key)) {
    fail('BINS-TRN-009', `Illegal transition: ${key}.`);
  }

  if (event === 'intake_authorized' && options.intakeAuthorized !== true) {
    fail('BINS-TRN-010', 'intake_authorized requires a verified accepted intake capsule.');
  }
  if (event === 'completion_accepted' && options.completionAuthorized !== true) {
    fail('BINS-TRN-011', 'No direct jump to COMPLETED is allowed without accepted completion validation.');
  }

  const resolvingEvent = new Set(['evidence_resolved', 'repair_resolved', 'completion_accepted']);
  if (!resolvingEvent.has(event) && !blockersPreserved(previous, next)) {
    fail('BINS-TRN-012', 'Unresolved blocking evidence must be preserved across the transition.');
  }
  if (event === 'completion_accepted' && blockerSet(previous).size > 0) {
    fail('BINS-TRN-013', 'Completion is blocked while unresolved blocking evidence exists.');
  }

  return diagnostics;
}

export function isResumableState(state) {
  return RESUMABLE_STATES.has(state);
}
