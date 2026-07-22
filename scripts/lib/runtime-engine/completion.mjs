import { RuntimeTransactionError, readJson, sameCanonical, validateJsonFile } from './common.mjs';
import { verifyBuilderInput, verifyCapsuleAgainstInput } from './input.mjs';
import { loadTransitionAuthority, evaluateTransition } from './transitions.mjs';
import { validateActionLedger } from './ledger.mjs';
import { validateCompletionGateBinding, validateCompletionScope } from './completion-policy.mjs';
import { createNextCheckpoint, createNextSession, transactionIdFor, unresolvedFromCheckpoint, validateSessionAndCheckpoint } from './carriers.mjs';
import { publishAtomicDirectory, validateGeneratedStage } from './publication.mjs';
import { baseTransitionResult } from './results.mjs';

export function executeCompletionTransaction(input) {
  const authority = loadTransitionAuthority();
  const verification = verifyBuilderInput(input.builderInputFile);
  const capsule = readJson(input.capsuleFile);
  const capsuleCheck = verifyCapsuleAgainstInput(capsule, verification);
  const carriers = validateSessionAndCheckpoint(input.sessionFile, input.checkpointFile, verification, authority);
  const ledger = readJson(input.actionLedgerFile);
  const status = readJson(input.completionStatusFile);
  const gate = readJson(input.completionGateFile);
  const ledgerSchema = validateJsonFile(input.actionLedgerFile, 'schemas/action-ledger.schema.json');
  const statusSchema = validateJsonFile(input.completionStatusFile, 'schemas/completion-status.schema.json', [], 'scripts/validate-completion-status.mjs');
  const gateSchema = validateJsonFile(input.completionGateFile, 'schemas/completion-gate.schema.json', [], 'scripts/validate-completion-gate.mjs');

  const diagnostics = [
    ...verification.diagnostics,
    ...capsuleCheck.diagnostics,
    ...carriers.diagnostics,
    ...ledgerSchema.diagnostics,
    ...statusSchema.diagnostics,
    ...gateSchema.diagnostics
  ];
  const { session, checkpoint } = carriers;
  const ledgerValidation = validateActionLedger(ledger, checkpoint, verification);
  const scopeValidation = validateCompletionScope(status, checkpoint);
  const gateValidation = validateCompletionGateBinding(gate, status, checkpoint, ledger, ledgerValidation, verification, scopeValidation);
  diagnostics.push(...ledgerValidation.diagnostics, ...scopeValidation.diagnostics, ...gateValidation.diagnostics);

  const unresolved = [...new Set([...(session.unresolved_evidence || []), ...unresolvedFromCheckpoint(checkpoint)])];
  const guardFacts = {
    final_checkpoint_valid: carriers.checkpointValidation.passed && sameCanonical(session.last_verified_checkpoint, checkpoint),
    predecessor_checkpoint_bound: carriers.passed,
    package_digest_matches: session.package_digest === verification.canonical_package_digest && checkpoint.package_digest === verification.canonical_package_digest,
    source_file_sha256_matches: session.source_file_sha256 === verification.source_file_sha256 && checkpoint.source_file_sha256 === verification.source_file_sha256,
    candidate_matches: session.selected_candidate_id === verification.selected_candidate_id && checkpoint.selected_candidate_id === verification.selected_candidate_id,
    required_actions_complete: ledgerValidation.complete,
    action_ledger_reconciled: ledgerValidation.passed && ledgerValidation.complete,
    unresolved_blocking_evidence_count_zero: unresolved.length === 0,
    completion_status_valid: statusSchema.passed && scopeValidation.passed,
    completion_scope_satisfied: scopeValidation.passed,
    completion_gate_valid: gateSchema.passed && gateValidation.passed,
    completion_gate_cross_bound: gateValidation.passed,
    builder_input_verified: verification.passed,
    intake_capsule_reconciled: capsuleCheck.passed
  };
  if (diagnostics.length > 0) throw new RuntimeTransactionError('COMPLETION-INPUT-INVALID', 'Completion inputs are invalid.', diagnostics);
  const evaluated = evaluateTransition(authority, 'complete-builder', { session, checkpoint, guardFacts });

  const transactionId = transactionIdFor('completion', {
    input: verification.source_file_sha256,
    session,
    checkpoint,
    action_ledger_digest: ledgerValidation.digest,
    completion_status: status,
    completion_gate: gate
  });
  const nextCheckpoint = createNextCheckpoint(checkpoint, evaluated.target, transactionId, {
    confirmed_action_ids: ledgerValidation.confirmed_action_ids,
    unconfirmed_action_ids: [],
    unresolved_blockers: [],
    action_ledger_id: ledger.ledger_id,
    action_ledger_sequence: ledger.ledger_sequence,
    action_ledger_digest: ledgerValidation.digest,
    evidence_ledger_digest: gateValidation.evidence_ledger_digest
  });
  const nextSession = createNextSession(session, evaluated.target, nextCheckpoint, { unresolved_evidence: [] });
  delete nextSession.resume_target;

  const transitionResult = baseTransitionResult(
    'complete-builder',
    transactionId,
    { workflow_mode: session.workflow_mode, runtime_state: session.runtime_state, checkpoint_id: checkpoint.checkpoint_id, checkpoint_sequence: checkpoint.checkpoint_sequence },
    { ...evaluated.target, checkpoint_id: nextCheckpoint.checkpoint_id, checkpoint_sequence: nextCheckpoint.checkpoint_sequence },
    verification,
    evaluated.guardResults
  );
  const completionResult = {
    schema: 'ev4-builder-completion-result@1.0.0',
    status: 'accepted',
    transaction_id: transactionId,
    completion_scope: status.completion_scope,
    builder_build_complete: true,
    responsive_complete: false,
    production_ready: false,
    action_reconciliation: {
      required: ledgerValidation.required_action_ids,
      confirmed: ledgerValidation.confirmed_action_ids,
      cancelled: ledgerValidation.cancelled_action_ids,
      not_applicable: ledgerValidation.not_applicable_action_ids,
      pending: []
    },
    bindings: {
      session_id: session.session_id,
      package_digest: verification.canonical_package_digest,
      source_file_sha256: verification.source_file_sha256,
      selected_candidate_id: verification.selected_candidate_id,
      predecessor_checkpoint_id: checkpoint.checkpoint_id,
      predecessor_checkpoint_sequence: checkpoint.checkpoint_sequence,
      action_ledger_id: ledger.ledger_id,
      action_ledger_digest: ledgerValidation.digest,
      evidence_ledger_digest: gateValidation.evidence_ledger_digest
    }
  };
  const publication = publishAtomicDirectory(
    input.outputDirectory,
    {
      'transition-result.json': transitionResult,
      'session-state.json': nextSession,
      'checkpoint.json': nextCheckpoint,
      'completion-result.json': completionResult
    },
    (staging) => validateGeneratedStage(staging, 'completion')
  );
  return { ...completionResult, publication };
}
