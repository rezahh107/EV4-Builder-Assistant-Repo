import { computeCanonicalDigest } from '../canonical-builder-package.mjs';
import { diagnostic, duplicates, setEquals } from './common.mjs';

export function validateActionLedger(ledger, checkpoint, verification) {
  const diagnostics = [];
  const actionIds = (ledger.actions || []).map((action) => action.action_id);
  const batchIds = (ledger.batches || []).map((batch) => batch.batch_id);
  for (const repeated of duplicates(actionIds)) diagnostics.push(diagnostic('LEDGER-DUPLICATE-ACTION', `Duplicate Action ID: ${repeated}`));
  for (const repeated of duplicates(batchIds)) diagnostics.push(diagnostic('LEDGER-DUPLICATE-BATCH', `Duplicate Batch ID: ${repeated}`));

  if (ledger.session_id !== checkpoint.session_id) diagnostics.push(diagnostic('LEDGER-SESSION-MISMATCH', 'Action Ledger session_id does not match Checkpoint.'));
  if (ledger.package_digest !== verification.canonical_package_digest) diagnostics.push(diagnostic('LEDGER-PACKAGE-MISMATCH', 'Action Ledger package_digest does not match Builder Input.'));
  if (ledger.source_file_sha256 !== verification.source_file_sha256) diagnostics.push(diagnostic('LEDGER-SOURCE-MISMATCH', 'Action Ledger source_file_sha256 does not match Builder Input bytes.'));
  if (ledger.selected_candidate_id !== verification.selected_candidate_id) diagnostics.push(diagnostic('LEDGER-CANDIDATE-MISMATCH', 'Action Ledger selected_candidate_id does not match Builder Input.'));
  if (ledger.checkpoint_sequence !== checkpoint.checkpoint_sequence) diagnostics.push(diagnostic('LEDGER-SEQUENCE-MISMATCH', 'Action Ledger checkpoint_sequence is stale or foreign.'));

  const expectedBatchIds = ledger.expected_batch_ids || [];
  const expectedRequiredIds = ledger.expected_required_action_ids || [];
  if (!setEquals(expectedBatchIds, batchIds)) diagnostics.push(diagnostic('LEDGER-BATCH-UNIVERSE-MISMATCH', 'Ledger batches do not match expected_batch_ids; an entire Batch may have disappeared.'));

  const actionById = new Map((ledger.actions || []).map((action) => [action.action_id, action]));
  const requiredIds = [];
  for (const batch of ledger.batches || []) {
    for (const repeated of duplicates(batch.required_action_ids || [])) diagnostics.push(diagnostic('LEDGER-DUPLICATE-REQUIRED', `Batch ${batch.batch_id} repeats required Action ${repeated}.`));
    for (const actionId of batch.required_action_ids || []) {
      requiredIds.push(actionId);
      const action = actionById.get(actionId);
      if (!action) {
        diagnostics.push(diagnostic('LEDGER-REQUIRED-ACTION-MISSING', `Required Action disappeared from Ledger: ${actionId}`));
      } else if (action.batch_id !== batch.batch_id) {
        diagnostics.push(diagnostic('LEDGER-BATCH-MISMATCH', `Action ${actionId} is assigned to the wrong Batch.`));
      }
    }
  }
  for (const repeated of duplicates(requiredIds)) diagnostics.push(diagnostic('LEDGER-REQUIRED-ACTION-DUPLICATE', `Action ${repeated} is required by more than one Batch.`));
  if (!setEquals(expectedRequiredIds, requiredIds)) diagnostics.push(diagnostic('LEDGER-REQUIRED-UNIVERSE-MISMATCH', 'Batch required Action IDs do not match expected_required_action_ids; an Action may have disappeared by omission.'));
  for (const action of ledger.actions || []) {
    if (!requiredIds.includes(action.action_id)) diagnostics.push(diagnostic('LEDGER-FOREIGN-ACTION', `Action ${action.action_id} is outside the required Action universe.`));
    if (!batchIds.includes(action.batch_id)) diagnostics.push(diagnostic('LEDGER-FOREIGN-BATCH', `Action ${action.action_id} references an unknown Batch.`));
    if (action.status === 'confirmed' && !action.confirmation_ref) diagnostics.push(diagnostic('LEDGER-CONFIRMATION-MISSING', `Confirmed Action ${action.action_id} lacks confirmation_ref.`));
    if (['cancelled', 'not_applicable'].includes(action.status) && (!action.disposition_reason || !action.authorization_ref)) {
      diagnostics.push(diagnostic('LEDGER-DISPOSITION-UNAUTHORIZED', `${action.status} Action ${action.action_id} requires disposition_reason and authorization_ref.`));
    }
  }

  const builderRequiredIds = verification.package?.first_builder_batch?.actions?.map((action) => action.action_id) || [];
  for (const actionId of builderRequiredIds) {
    if (!requiredIds.includes(actionId)) diagnostics.push(diagnostic('LEDGER-BUILDER-ACTION-MISSING', `Builder Input required Action is absent from Ledger: ${actionId}`));
  }

  const digest = computeCanonicalDigest(ledger);
  if (checkpoint.action_ledger_id !== ledger.ledger_id) diagnostics.push(diagnostic('LEDGER-ID-MISMATCH', 'Checkpoint action_ledger_id does not match Ledger.'));
  if (checkpoint.action_ledger_sequence !== ledger.ledger_sequence) diagnostics.push(diagnostic('LEDGER-VERSION-MISMATCH', 'Checkpoint action_ledger_sequence does not match Ledger.'));
  if (checkpoint.action_ledger_digest !== digest) diagnostics.push(diagnostic('LEDGER-DIGEST-MISMATCH', 'Checkpoint action_ledger_digest does not match current Ledger bytes.'));

  const confirmed = (ledger.actions || []).filter((action) => action.status === 'confirmed').map((action) => action.action_id);
  const cancelled = (ledger.actions || []).filter((action) => action.status === 'cancelled').map((action) => action.action_id);
  const notApplicable = (ledger.actions || []).filter((action) => action.status === 'not_applicable').map((action) => action.action_id);
  const pending = (ledger.actions || []).filter((action) => action.status === 'pending').map((action) => action.action_id);
  const terminalUnion = [...confirmed, ...cancelled, ...notApplicable];

  if (!setEquals(checkpoint.confirmed_action_ids || [], confirmed)) diagnostics.push(diagnostic('LEDGER-CHECKPOINT-CONFIRMED-MISMATCH', 'Checkpoint confirmed_action_ids do not reconcile with Ledger.'));
  if (!setEquals(checkpoint.unconfirmed_action_ids || [], pending)) diagnostics.push(diagnostic('LEDGER-CHECKPOINT-PENDING-MISMATCH', 'Checkpoint unconfirmed_action_ids do not reconcile with Ledger.'));
  if (!setEquals(requiredIds, [...terminalUnion, ...pending])) diagnostics.push(diagnostic('LEDGER-UNIVERSE-MISMATCH', 'Every required Action must have exactly one disposition.'));

  return {
    passed: diagnostics.length === 0,
    diagnostics,
    digest,
    required_action_ids: requiredIds,
    confirmed_action_ids: confirmed,
    cancelled_action_ids: cancelled,
    not_applicable_action_ids: notApplicable,
    pending_action_ids: pending,
    complete: diagnostics.length === 0 && pending.length === 0 && setEquals(requiredIds, terminalUnion)
  };
}
