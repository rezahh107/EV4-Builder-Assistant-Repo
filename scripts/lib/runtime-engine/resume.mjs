import { RuntimeTransactionError, readJson, sameCanonical, setEquals } from './common.mjs';
import { verifyBuilderInput, verifyCapsuleAgainstInput } from './input.mjs';
import { loadTransitionAuthority, evaluateTransition } from './transitions.mjs';
import { createNextCheckpoint, createNextSession, transactionIdFor, unresolvedFromCheckpoint, validateSessionAndCheckpoint } from './carriers.mjs';
import { publishAtomicDirectory, validateGeneratedStage } from './publication.mjs';
import { baseTransitionResult } from './results.mjs';

export function executeResumeTransaction(input) {
  const authority = loadTransitionAuthority();
  const verification = verifyBuilderInput(input.builderInputFile);
  const capsule = readJson(input.capsuleFile);
  const capsuleCheck = verifyCapsuleAgainstInput(capsule, verification);
  const carriers = validateSessionAndCheckpoint(input.sessionFile, input.checkpointFile, verification, authority);
  const diagnostics = [...verification.diagnostics, ...capsuleCheck.diagnostics, ...carriers.diagnostics];
  const { session, checkpoint } = carriers;

  const checkpointBlockers = unresolvedFromCheckpoint(checkpoint);
  const sessionBlockers = session.unresolved_evidence || [];
  const guardFacts = {
    prior_initialized_state_exists: Boolean(session.session_id && session.resume_target),
    session_id_matches: session.session_id === checkpoint.session_id,
    package_digest_matches: session.package_digest === verification.canonical_package_digest && checkpoint.package_digest === verification.canonical_package_digest,
    source_file_sha256_matches: session.source_file_sha256 === verification.source_file_sha256 && checkpoint.source_file_sha256 === verification.source_file_sha256,
    candidate_matches: session.selected_candidate_id === verification.selected_candidate_id && checkpoint.selected_candidate_id === verification.selected_candidate_id,
    checkpoint_valid: carriers.checkpointValidation.passed && sameCanonical(session.last_verified_checkpoint, checkpoint),
    unresolved_blockers_preserved: setEquals(checkpointBlockers, sessionBlockers),
    builder_input_verified: verification.passed,
    intake_capsule_reconciled: capsuleCheck.passed
  };
  if (diagnostics.length > 0) throw new RuntimeTransactionError('RESUME-INPUT-INVALID', 'Resume inputs are invalid.', diagnostics);
  const evaluated = evaluateTransition(authority, 'resume', { session, checkpoint, guardFacts });

  const transactionId = transactionIdFor('resume', {
    input: verification.source_file_sha256,
    session,
    checkpoint,
    target: evaluated.target
  });
  const nextCheckpoint = createNextCheckpoint(checkpoint, evaluated.target, transactionId);
  const nextSession = createNextSession(session, evaluated.target, nextCheckpoint);
  delete nextSession.resume_target;

  const transitionResult = baseTransitionResult(
    'resume',
    transactionId,
    { workflow_mode: session.workflow_mode, runtime_state: session.runtime_state, checkpoint_id: checkpoint.checkpoint_id, checkpoint_sequence: checkpoint.checkpoint_sequence },
    { ...evaluated.target, checkpoint_id: nextCheckpoint.checkpoint_id, checkpoint_sequence: nextCheckpoint.checkpoint_sequence },
    verification,
    evaluated.guardResults
  );
  const resumeResult = {
    schema: 'ev4-builder-resume-result@1.0.0',
    status: 'accepted',
    transaction_id: transactionId,
    resumed_from: { workflow_mode: session.workflow_mode, runtime_state: session.runtime_state },
    resumed_to: evaluated.target,
    checkpoint_sequence: nextCheckpoint.checkpoint_sequence,
    unresolved_blockers_preserved: true
  };
  const publication = publishAtomicDirectory(
    input.outputDirectory,
    {
      'transition-result.json': transitionResult,
      'session-state.json': nextSession,
      'checkpoint.json': nextCheckpoint,
      'resume-result.json': resumeResult
    },
    (staging) => validateGeneratedStage(staging, 'resume')
  );
  return { ...resumeResult, publication };
}
