import { computeCanonicalDigest } from '../canonical-builder-package.mjs';
import { diagnostic, clone, readJson, sameCanonical, validateJsonFile } from './common.mjs';
import { isAllowedCombination } from './transitions.mjs';

export function unresolvedFromCheckpoint(checkpoint) {
  const explicit = Array.isArray(checkpoint.unresolved_blockers) ? checkpoint.unresolved_blockers : [];
  const assertions = (checkpoint.assertions || [])
    .filter((entry) => ['not_checked', 'insufficient_evidence'].includes(entry?.status))
    .map((entry) => entry.assertion_id || entry.subject_ref || 'unresolved_assertion');
  return [...new Set([...explicit, ...assertions])];
}

function validateCheckpointSequenceShape(checkpoint) {
  if (!Number.isInteger(checkpoint.checkpoint_sequence) || checkpoint.checkpoint_sequence < 1) return false;
  if (checkpoint.checkpoint_sequence === 1) return checkpoint.parent_checkpoint_id === null;
  return typeof checkpoint.parent_checkpoint_id === 'string' && checkpoint.parent_checkpoint_id.length > 0;
}

export function validateSessionAndCheckpoint(sessionFile, checkpointFile, verification, authority) {
  const diagnostics = [];
  const session = readJson(sessionFile);
  const checkpoint = readJson(checkpointFile);
  const sessionValidation = validateJsonFile(
    sessionFile,
    'schemas/session-state.schema.json',
    ['schemas/checkpoint.schema.json', 'schemas/evidence-record.schema.json', 'schemas/repair-packet.schema.json'],
    'scripts/validate-session-state.mjs'
  );
  const checkpointValidation = validateJsonFile(
    checkpointFile,
    'schemas/checkpoint.schema.json',
    ['schemas/evidence-record.schema.json'],
    'scripts/validate-checkpoint.mjs'
  );
  diagnostics.push(...sessionValidation.diagnostics, ...checkpointValidation.diagnostics);

  if (session.current_state !== session.runtime_state) diagnostics.push(diagnostic('CARRIER-STATE-MISMATCH', 'Session current_state must equal runtime_state.'));
  if (!isAllowedCombination(session.workflow_mode, session.runtime_state, authority)) diagnostics.push(diagnostic('CARRIER-STATE-ILLEGAL', 'Session mode/state combination is not allowed by the canonical transition table.'));
  if (!isAllowedCombination(checkpoint.workflow_mode, checkpoint.runtime_state, authority)) diagnostics.push(diagnostic('CHECKPOINT-STATE-ILLEGAL', 'Checkpoint mode/state combination is not allowed by the canonical transition table.'));
  if (session.session_id !== checkpoint.session_id) diagnostics.push(diagnostic('CARRIER-SESSION-MISMATCH', 'Session State and Checkpoint session_id differ.'));
  if (session.package_digest !== verification.canonical_package_digest || checkpoint.package_digest !== verification.canonical_package_digest) diagnostics.push(diagnostic('CARRIER-PACKAGE-MISMATCH', 'Session State or Checkpoint package digest differs from actual Builder Input.'));
  if (session.source_file_sha256 !== verification.source_file_sha256 || checkpoint.source_file_sha256 !== verification.source_file_sha256) diagnostics.push(diagnostic('CARRIER-SOURCE-MISMATCH', 'Session State or Checkpoint source SHA-256 differs from actual Builder Input bytes.'));
  if (session.selected_candidate_id !== verification.selected_candidate_id || checkpoint.selected_candidate_id !== verification.selected_candidate_id) diagnostics.push(diagnostic('CARRIER-CANDIDATE-MISMATCH', 'Session State or Checkpoint candidate differs from actual Builder Input.'));
  if (session.last_verified_checkpoint?.checkpoint_id !== checkpoint.checkpoint_id || !sameCanonical(session.last_verified_checkpoint, checkpoint)) diagnostics.push(diagnostic('CARRIER-CHECKPOINT-MISMATCH', 'Session State is not bound to the exact supplied Checkpoint.'));
  if (!validateCheckpointSequenceShape(checkpoint)) diagnostics.push(diagnostic('CHECKPOINT-SEQUENCE-INVALID', 'Checkpoint sequence and parent_checkpoint_id are inconsistent.'));

  return {
    passed: diagnostics.length === 0,
    session,
    checkpoint,
    sessionValidation,
    checkpointValidation,
    diagnostics
  };
}

export function transactionIdFor(kind, values) {
  return computeCanonicalDigest({ schema: 'ev4-runtime-transaction-id@1.0.0', kind, values });
}

function nextCheckpointId(sessionId, sequence, transactionId) {
  const safeSession = String(sessionId).replace(/[^A-Za-z0-9._:-]/g, '_');
  return `${safeSession}-CP-${String(sequence).padStart(4, '0')}-${transactionId.slice(0, 12)}`;
}

export function createNextCheckpoint(current, target, transactionId, extra = {}) {
  const next = clone(current);
  next.parent_checkpoint_id = current.checkpoint_id;
  next.checkpoint_sequence = current.checkpoint_sequence + 1;
  next.checkpoint_id = nextCheckpointId(current.session_id, next.checkpoint_sequence, transactionId);
  next.workflow_mode = target.workflow_mode;
  next.runtime_state = target.runtime_state;
  next.created_from = 'diagnostic';
  const predecessorTime = Date.parse(current.created_at || '');
  if (Number.isFinite(predecessorTime)) next.created_at = new Date(predecessorTime + 1000).toISOString();
  Object.assign(next, extra);
  return next;
}

export function createNextSession(current, target, checkpoint, extra = {}) {
  const next = clone(current);
  next.workflow_mode = target.workflow_mode;
  next.runtime_state = target.runtime_state;
  next.current_state = target.runtime_state;
  next.last_verified_checkpoint = checkpoint;
  Object.assign(next, extra);
  return next;
}
