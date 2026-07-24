import { computeCanonicalDigest, sortedCanonicalJson } from '../canonical-builder-package.mjs';
import { RUNTIME_MODES } from '../builder-explicit-source-runtime.mjs';
import { diagnostic, sameSet, digestWithout, generationRef, collectActiveBlockers, buildCheckpoint, updateSessionForCheckpoint } from './run-primitives.mjs';
import { expectedPublicationFiles, validatePublication } from './run-state-store.mjs';
import { failedPlan, successfulPlan } from './transition-planner-common.mjs';

function validateEmitBinding(predecessor) {
  const diagnostics = [...(predecessor.planning?.diagnostics || [])];
  const emitResult = predecessor.planning?.emitResult;
  const { context, checkpoint, manifest } = predecessor;
  if (!emitResult) return { passed: false, diagnostics, emitResult };
  if (emitResult.run_id !== manifest.run_id || emitResult.context_digest !== context.context_digest) diagnostics.push(diagnostic('RUN-CONFIRM-002', 'emit-batch Run/Context binding is stale.'));
  if (emitResult.source_snapshot_sha256 !== manifest.source_snapshot_sha256) diagnostics.push(diagnostic('RUN-CONFIRM-003', 'emit-batch source snapshot binding is stale.'));
  if (emitResult.package_digest !== context.canonical_package_digest || emitResult.selected_candidate_id !== context.selected_candidate_id || emitResult.batch_id !== context.action_batch.batch_id) diagnostics.push(diagnostic('RUN-CONFIRM-004', 'emit-batch Package/Candidate/Batch binding is stale.'));
  if (!sameSet(emitResult.action_ids, context.action_batch.action_ids) || sortedCanonicalJson(emitResult.action_digests) !== sortedCanonicalJson(context.action_batch.action_digests)) diagnostics.push(diagnostic('RUN-CONFIRM-005', 'emit-batch Action binding is stale.'));
  if (emitResult.resulting_checkpoint?.checkpoint_id !== checkpoint.checkpoint_id || emitResult.resulting_checkpoint?.checkpoint_sequence !== checkpoint.checkpoint_sequence || emitResult.resulting_checkpoint?.parent_checkpoint_id !== checkpoint.parent_checkpoint_id) diagnostics.push(diagnostic('RUN-CONFIRM-006', 'Current WAITING Checkpoint is not the exact emitted Checkpoint.'));
  return { passed: diagnostics.length === 0, diagnostics, emitResult };
}

export function planEmitTransition({ predecessor }) {
  const derivation = predecessor.planning?.fullDerivation;
  const diagnostics = [...(derivation?.diagnostics || predecessor.planning?.diagnostics || [])];
  const { manifest, context, session, checkpoint } = predecessor;
  if (manifest.active_emit_result_ref || manifest.active_confirmation_receipt_ref) diagnostics.push(diagnostic('RUN-EMIT-001', 'Action Batch was already emitted or confirmed.'));
  if (checkpoint.runtime_state !== 'BUILD_ACTIVE' || session.runtime_state !== 'BUILD_ACTIVE') diagnostics.push(diagnostic('RUN-EMIT-002', 'emit-batch requires BUILD_ACTIVE State.'));
  if (!sameSet(checkpoint.unconfirmed_action_ids, context.action_batch.action_ids) || (checkpoint.confirmed_action_ids || []).length !== 0) diagnostics.push(diagnostic('RUN-EMIT-003', 'Action mirrors do not match the complete derived Action set.'));
  const blockers = collectActiveBlockers(session, checkpoint);
  if (blockers.length) diagnostics.push(diagnostic('RUN-EMIT-004', `Action emission is blocked by: ${blockers.join(', ')}.`));
  if (diagnostics.length) return failedPlan(predecessor, diagnostics, { active_blockers: blockers });
  const transitionId = `EMIT-${computeCanonicalDigest({ run_id: manifest.run_id, context_digest: context.context_digest, predecessor: checkpoint.checkpoint_id }).slice(0, 16)}`;
  const resultRef = `transitions/emit-batch/${transitionId}/emit-batch-result.json`;
  const resulting = buildCheckpoint({ runId: manifest.run_id, sessionId: session.session_id, context, sequence: checkpoint.checkpoint_sequence + 1, parentId: checkpoint.checkpoint_id, state: 'WAITING_FOR_CONFIRMATION', confirmedActionIds: [], unconfirmedActionIds: context.action_batch.action_ids, unresolvedBlockers: checkpoint.unresolved_blockers || [], assertions: checkpoint.assertions, evidenceLedger: checkpoint.evidence_ledger, createdFrom: 'initial' });
  const nextSession = updateSessionForCheckpoint(session, resulting);
  const refs = { generation_ref: generationRef(predecessor.current.generation + 1), result_ref: resultRef };
  const result = { schema: 'ev4-builder-emit-batch-result@2.0.0', run_id: manifest.run_id, transition_id: transitionId, status: 'accepted', source_snapshot_sha256: manifest.source_snapshot_sha256, context_digest: context.context_digest, package_digest: context.canonical_package_digest, selected_candidate_id: context.selected_candidate_id, batch_id: context.action_batch.batch_id, action_ids: [...context.action_batch.action_ids], action_digests: { ...context.action_batch.action_digests }, predecessor_checkpoint: { checkpoint_id: checkpoint.checkpoint_id, checkpoint_sequence: checkpoint.checkpoint_sequence }, resulting_checkpoint: { checkpoint_id: resulting.checkpoint_id, checkpoint_sequence: resulting.checkpoint_sequence, parent_checkpoint_id: resulting.parent_checkpoint_id }, runtime_state: 'WAITING_FOR_CONFIRMATION', builder_build_complete: false, responsive_complete: false, production_ready: false, publication: { atomic: true, files: expectedPublicationFiles('emit-batch', refs) }, blocking_diagnostics: [] };
  const publicationDiagnostics = validatePublication(result, 'emit-batch', refs, 'ev4-builder-emit-batch-result@2.0.0', manifest.run_id);
  if (publicationDiagnostics.length) return failedPlan(predecessor, publicationDiagnostics);
  return successfulPlan('emit-batch', context, nextSession, resulting, { active_emit_result_ref: resultRef }, result, [{ ref: resultRef, kind: 'json', value: result }], refs);
}

export function planConfirmationTransition({ predecessor, userToken }) {
  const diagnostics = [];
  const { manifest, context, session, checkpoint } = predecessor;
  if (manifest.active_confirmation_receipt_ref) diagnostics.push(diagnostic('RUN-CONFIRM-007', 'Action Batch is already confirmed.'));
  if (checkpoint.runtime_state !== 'WAITING_FOR_CONFIRMATION' || session.runtime_state !== 'WAITING_FOR_CONFIRMATION') diagnostics.push(diagnostic('RUN-CONFIRM-008', 'confirm-batch accepts only WAITING_FOR_CONFIRMATION State.'));
  if ((checkpoint.confirmed_action_ids || []).length !== 0 || !sameSet(checkpoint.unconfirmed_action_ids, context.action_batch.action_ids)) diagnostics.push(diagnostic('RUN-CONFIRM-009', 'WAITING Checkpoint Action mirrors are invalid.'));
  if (checkpoint.batch_id !== context.action_batch.batch_id) diagnostics.push(diagnostic('RUN-CONFIRM-010', 'WAITING Checkpoint Batch binding is invalid.'));
  if (userToken !== context.confirmation.expected_user_token) diagnostics.push(diagnostic('RUN-CONFIRM-011', 'Operator token does not match active Confirmation binding.'));
  const blockers = collectActiveBlockers(session, checkpoint);
  if (blockers.length) diagnostics.push(diagnostic('RUN-CONFIRM-012', `Confirmation is blocked by: ${blockers.join(', ')}.`));
  const emit = validateEmitBinding(predecessor);
  diagnostics.push(...emit.diagnostics);
  if (diagnostics.length) return failedPlan(predecessor, diagnostics, { active_blockers: blockers });
  const transitionId = `CONFIRM-${computeCanonicalDigest({ run_id: manifest.run_id, emit_transition: emit.emitResult.transition_id, token: userToken }).slice(0, 16)}`;
  const receiptRef = `transitions/confirmation/${transitionId}/confirmation-receipt.json`;
  const resultRef = `transitions/confirmation/${transitionId}/confirmation-result.json`;
  const resulting = buildCheckpoint({ runId: manifest.run_id, sessionId: session.session_id, context, sequence: checkpoint.checkpoint_sequence + 1, parentId: checkpoint.checkpoint_id, state: 'BUILD_ACTIVE', confirmedActionIds: context.action_batch.action_ids, unconfirmedActionIds: [], unresolvedBlockers: checkpoint.unresolved_blockers || [], assertions: checkpoint.assertions, evidenceLedger: checkpoint.evidence_ledger, createdFrom: 'user_confirmation' });
  const nextSession = updateSessionForCheckpoint(session, resulting);
  const receipt = { schema: 'ev4-builder-confirmation-receipt@2.0.0', run_id: manifest.run_id, runtime_mode: RUNTIME_MODES.REAL, context_digest: context.context_digest, package_digest: context.canonical_package_digest, selected_candidate_id: context.selected_candidate_id, confirmation_id: context.confirmation.confirmation_id, operator_token: userToken, batch_id: context.action_batch.batch_id, action_ids: [...context.action_batch.action_ids], action_digests: { ...context.action_batch.action_digests }, predecessor_checkpoint: { checkpoint_id: checkpoint.checkpoint_id, checkpoint_sequence: checkpoint.checkpoint_sequence }, resulting_checkpoint: { checkpoint_id: resulting.checkpoint_id, checkpoint_sequence: resulting.checkpoint_sequence, parent_checkpoint_id: resulting.parent_checkpoint_id }, receipt_digest: null };
  receipt.receipt_digest = digestWithout(receipt, 'receipt_digest');
  const refs = { generation_ref: generationRef(predecessor.current.generation + 1), receipt_ref: receiptRef, result_ref: resultRef };
  const result = { schema: 'ev4-builder-confirmation-result@2.0.0', run_id: manifest.run_id, transition_id: transitionId, status: 'accepted', context_digest: context.context_digest, package_digest: context.canonical_package_digest, selected_candidate_id: context.selected_candidate_id, confirmation_id: context.confirmation.confirmation_id, batch_id: context.action_batch.batch_id, action_ids: [...context.action_batch.action_ids], action_digests: { ...context.action_batch.action_digests }, predecessor_checkpoint: receipt.predecessor_checkpoint, resulting_checkpoint: receipt.resulting_checkpoint, receipt_digest: receipt.receipt_digest, runtime_state: 'BUILD_ACTIVE', builder_build_complete: false, responsive_complete: false, production_ready: false, publication: { atomic: true, files: expectedPublicationFiles('confirm-batch', refs) }, blocking_diagnostics: [] };
  const publicationDiagnostics = validatePublication(result, 'confirm-batch', refs, 'ev4-builder-confirmation-result@2.0.0', manifest.run_id);
  if (publicationDiagnostics.length) return failedPlan(predecessor, publicationDiagnostics);
  return successfulPlan('confirm-batch', context, nextSession, resulting, { active_confirmation_receipt_ref: receiptRef, active_confirmation_result_ref: resultRef, confirmed_checkpoint_id: resulting.checkpoint_id, confirmed_checkpoint_sequence: resulting.checkpoint_sequence }, result, [{ ref: receiptRef, kind: 'json', value: receipt }, { ref: resultRef, kind: 'json', value: result }], refs, { receipt });
}
