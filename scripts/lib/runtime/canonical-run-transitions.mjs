import fs from 'node:fs';
import path from 'node:path';

import { computeCanonicalDigest, sortedCanonicalJson } from '../canonical-builder-package.mjs';
import { RUNTIME_MODES } from '../builder-explicit-source-runtime.mjs';
import {
  diagnostic,
  resolveRoot,
  sameSet,
  digestWithout,
  safeRunRef,
  generationRef,
  injectedPoint,
  fsyncDirectory,
  validateCanonicalSourceModeArguments,
  deriveFromInternalSnapshot,
  collectActiveBlockers,
  buildCheckpoint,
  updateSessionForCheckpoint,
  readJson
} from './run-primitives.mjs';
import { loadRunUnlocked, fullDeriveAndCompare } from './run-state-validation.mjs';
import {
  expectedPublicationFiles,
  validatePublication,
  publishSuccessor,
  withRunMutation,
  initializeStage,
  detectCommittedTransitionReplay
} from './run-state-store.mjs';

export function initializeAtomicRun({ sourceMode, sourceArtifactFile = null, builderInputFile = null, runDirectory, failureInjection = null }) {
  const args = validateCanonicalSourceModeArguments({ sourceMode, sourceArtifactFile, builderInputFile });
  if (!args.passed) return { passed: false, diagnostics: args.diagnostics };
  const target = resolveRoot(runDirectory);
  if (fs.existsSync(target)) return { passed: false, diagnostics: [diagnostic('RUN_ALREADY_EXISTS', 'Target Run directory already exists.')] };
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });
  const stage = path.join(parent, `.${path.basename(target)}.init-${process.pid}-${Date.now()}`);
  try {
    fs.mkdirSync(stage, { recursive: false });
    const output = initializeStage({ stage, logicalRunDirectory: target, sourceMode, sourceArtifactFile, builderInputFile });
    injectedPoint(failureInjection, 'after_successor_temp_write');
    const loaded = loadRunUnlocked(stage);
    const diagnostics = [...loaded.diagnostics];
    const derived = loaded.passed ? deriveFromInternalSnapshot({ actualRunDirectory: stage, logicalRunDirectory: target, sourceMode }) : { passed: false, diagnostics: [] };
    diagnostics.push(...(derived.diagnostics || []));
    if (derived.context && sortedCanonicalJson(derived.context) !== sortedCanonicalJson(output.context)) diagnostics.push(diagnostic('RUN-INTAKE-001', 'Generated Context does not match internal snapshot derivation.'));
    diagnostics.push(...validatePublication(output.result, 'real-intake', { generation_ref: generationRef(1), result_ref: output.refs.result_ref, receipt_ref: output.refs.receipt_ref }, 'ev4-builder-real-intake-result@2.0.0', output.manifest.run_id));
    if (diagnostics.length) throw new Error(JSON.stringify(diagnostics));
    injectedPoint(failureInjection, 'after_successor_validation');
    injectedPoint(failureInjection, 'before_successor_generation_rename');
    if (fs.existsSync(target)) throw Object.assign(new Error('Target Run directory already exists.'), { code: 'RUN_ALREADY_EXISTS' });
    fs.renameSync(stage, target);
    fsyncDirectory(parent);
    injectedPoint(failureInjection, 'after_successor_generation_rename');
    return { passed: true, diagnostics: [], ...output, runDirectory: target, generation: 1 };
  } catch (error) {
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
    return {
      passed: false,
      failure_stage: error?.failureStage || null,
      diagnostics: [diagnostic(error?.code === 'RUN_ALREADY_EXISTS' ? 'RUN_ALREADY_EXISTS' : error?.code === 'RUN-INJECTED-FAILURE' ? 'RUN-INJECTED-FAILURE' : 'RUN-INTAKE-FAILURE', 'Atomic Run initialization failed; this process did not modify an existing target Run.', error.message)]
    };
  }
}

export function loadTransitionResult(run, ref, expectedSchema) {
  const file = safeRunRef(run, ref);
  if (!file || !fs.existsSync(file)) throw new Error(`Transition result is missing or unsafe: ${ref}`);
  const value = readJson(file);
  if (value.schema !== expectedSchema) throw new Error(`Unexpected transition result schema: ${value.schema}`);
  return value;
}

function validateEmitBinding(loaded) {
  const diagnostics = [];
  let emitResult = null;
  try {
    emitResult = loadTransitionResult(loaded.runDirectory, loaded.manifest.active_emit_result_ref, 'ev4-builder-emit-batch-result@2.0.0');
  } catch (error) {
    return { passed: false, diagnostics: [diagnostic('RUN-CONFIRM-001', 'Active emit-batch result is unavailable.', error.message)], emitResult };
  }
  const { context, checkpoint, manifest } = loaded;
  if (emitResult.run_id !== manifest.run_id || emitResult.context_digest !== context.context_digest) diagnostics.push(diagnostic('RUN-CONFIRM-002', 'emit-batch Run/Context binding is stale.'));
  if (emitResult.source_snapshot_sha256 !== manifest.source_snapshot_sha256) diagnostics.push(diagnostic('RUN-CONFIRM-003', 'emit-batch source snapshot binding is stale.'));
  if (emitResult.package_digest !== context.canonical_package_digest || emitResult.selected_candidate_id !== context.selected_candidate_id || emitResult.batch_id !== context.action_batch.batch_id) diagnostics.push(diagnostic('RUN-CONFIRM-004', 'emit-batch Package/Candidate/Batch binding is stale.'));
  if (!sameSet(emitResult.action_ids, context.action_batch.action_ids) || sortedCanonicalJson(emitResult.action_digests) !== sortedCanonicalJson(context.action_batch.action_digests)) diagnostics.push(diagnostic('RUN-CONFIRM-005', 'emit-batch Action binding is stale.'));
  if (emitResult.resulting_checkpoint?.checkpoint_id !== checkpoint.checkpoint_id || emitResult.resulting_checkpoint?.checkpoint_sequence !== checkpoint.checkpoint_sequence || emitResult.resulting_checkpoint?.parent_checkpoint_id !== checkpoint.parent_checkpoint_id) diagnostics.push(diagnostic('RUN-CONFIRM-006', 'Current WAITING Checkpoint is not the exact emitted Checkpoint.'));
  return { passed: diagnostics.length === 0, diagnostics, emitResult };
}

function detectEmitReplay(loaded) {
  const { manifest, context, session, checkpoint } = loaded;
  return detectCommittedTransitionReplay({
    loaded,
    operation: 'emit-batch',
    resultRef: manifest.active_emit_result_ref,
    expectedSchema: 'ev4-builder-emit-batch-result@2.0.0',
    matches: (result) => {
      const binding = validateEmitBinding(loaded);
      const diagnostics = [...binding.diagnostics];
      if (checkpoint.runtime_state !== 'WAITING_FOR_CONFIRMATION' || session.runtime_state !== 'WAITING_FOR_CONFIRMATION') diagnostics.push(diagnostic('RUN-EMIT-REPLAY-001', 'Active State is not the exact committed emit-batch transition.'));
      if (manifest.active_confirmation_receipt_ref || manifest.active_confirmation_result_ref) diagnostics.push(diagnostic('RUN-EMIT-REPLAY-002', 'A later Confirmation transition is already active.'));
      if (result.context_digest !== context.context_digest || result.batch_id !== context.action_batch.batch_id) diagnostics.push(diagnostic('RUN-EMIT-REPLAY-003', 'Committed emit-batch identity differs from the active Context.'));
      const refs = { generation_ref: loaded.current.generation_ref, result_ref: manifest.active_emit_result_ref };
      diagnostics.push(...validatePublication(result, 'emit-batch', refs, 'ev4-builder-emit-batch-result@2.0.0', manifest.run_id));
      return { passed: diagnostics.length === 0, diagnostics };
    }
  });
}

export function emitRunBatch({ runDirectory, failureInjection = null }) {
  return withRunMutation({ runDirectory, operation: 'emit-batch', failureInjection }, (loaded) => {
    const replay = detectEmitReplay(loaded);
    if (replay.matched) return replay.outcome;

    const derivation = fullDeriveAndCompare(loaded);
    const diagnostics = [...derivation.diagnostics];
    const { manifest, context, session, checkpoint } = loaded;
    if (manifest.active_emit_result_ref || manifest.active_confirmation_receipt_ref) diagnostics.push(diagnostic('RUN-EMIT-001', 'Action Batch was already emitted or confirmed.'));
    if (checkpoint.runtime_state !== 'BUILD_ACTIVE' || session.runtime_state !== 'BUILD_ACTIVE') diagnostics.push(diagnostic('RUN-EMIT-002', 'emit-batch requires BUILD_ACTIVE State.'));
    if (!sameSet(checkpoint.unconfirmed_action_ids, context.action_batch.action_ids) || (checkpoint.confirmed_action_ids || []).length !== 0) diagnostics.push(diagnostic('RUN-EMIT-003', 'Action mirrors do not match the complete derived Action set.'));
    const blockers = collectActiveBlockers(session, checkpoint);
    if (blockers.length) diagnostics.push(diagnostic('RUN-EMIT-004', `Action emission is blocked by: ${blockers.join(', ')}.`));
    if (diagnostics.length) return { ...loaded, passed: false, diagnostics, active_blockers: blockers };
    const transitionId = `EMIT-${computeCanonicalDigest({ run_id: manifest.run_id, context_digest: context.context_digest, predecessor: checkpoint.checkpoint_id }).slice(0, 16)}`;
    const resultRef = `transitions/emit-batch/${transitionId}/emit-batch-result.json`;
    const resulting = buildCheckpoint({
      runId: manifest.run_id,
      sessionId: session.session_id,
      context,
      sequence: checkpoint.checkpoint_sequence + 1,
      parentId: checkpoint.checkpoint_id,
      state: 'WAITING_FOR_CONFIRMATION',
      confirmedActionIds: [],
      unconfirmedActionIds: context.action_batch.action_ids,
      unresolvedBlockers: checkpoint.unresolved_blockers || [],
      assertions: checkpoint.assertions,
      evidenceLedger: checkpoint.evidence_ledger,
      createdFrom: 'initial'
    });
    const nextSession = updateSessionForCheckpoint(session, resulting);
    const refs = { generation_ref: generationRef(loaded.current.generation + 1), result_ref: resultRef };
    const result = {
      schema: 'ev4-builder-emit-batch-result@2.0.0',
      run_id: manifest.run_id,
      transition_id: transitionId,
      status: 'accepted',
      source_snapshot_sha256: manifest.source_snapshot_sha256,
      context_digest: context.context_digest,
      package_digest: context.canonical_package_digest,
      selected_candidate_id: context.selected_candidate_id,
      batch_id: context.action_batch.batch_id,
      action_ids: [...context.action_batch.action_ids],
      action_digests: { ...context.action_batch.action_digests },
      predecessor_checkpoint: { checkpoint_id: checkpoint.checkpoint_id, checkpoint_sequence: checkpoint.checkpoint_sequence },
      resulting_checkpoint: { checkpoint_id: resulting.checkpoint_id, checkpoint_sequence: resulting.checkpoint_sequence, parent_checkpoint_id: resulting.parent_checkpoint_id },
      runtime_state: 'WAITING_FOR_CONFIRMATION',
      builder_build_complete: false,
      responsive_complete: false,
      production_ready: false,
      publication: { atomic: true, files: expectedPublicationFiles('emit-batch', refs) },
      blocking_diagnostics: []
    };
    const publicationDiagnostics = validatePublication(result, 'emit-batch', refs, 'ev4-builder-emit-batch-result@2.0.0', manifest.run_id);
    if (publicationDiagnostics.length) return { ...loaded, passed: false, diagnostics: publicationDiagnostics };
    return publishSuccessor({ loaded, operation: 'emit-batch', context, session: nextSession, checkpoint: resulting, manifestUpdates: { active_emit_result_ref: resultRef }, result, auxiliaryFiles: [{ ref: resultRef, kind: 'json', value: result }], failureInjection });
  });
}

function detectConfirmationReplay(loaded, userToken) {
  const { manifest, context, session, checkpoint } = loaded;
  return detectCommittedTransitionReplay({
    loaded,
    operation: 'confirm-batch',
    resultRef: manifest.active_confirmation_result_ref,
    expectedSchema: 'ev4-builder-confirmation-result@2.0.0',
    matches: (result) => {
      const diagnostics = [];
      let receipt = null;
      try {
        receipt = loadTransitionResult(loaded.runDirectory, manifest.active_confirmation_receipt_ref, 'ev4-builder-confirmation-receipt@2.0.0');
      } catch (error) {
        diagnostics.push(diagnostic('RUN-CONFIRM-REPLAY-001', 'Committed Confirmation Receipt is unavailable.', error.message));
      }
      if (checkpoint.runtime_state !== 'BUILD_ACTIVE' || session.runtime_state !== 'BUILD_ACTIVE' || checkpoint.checkpoint_id !== manifest.confirmed_checkpoint_id || checkpoint.checkpoint_sequence !== manifest.confirmed_checkpoint_sequence) diagnostics.push(diagnostic('RUN-CONFIRM-REPLAY-002', 'Active State is not the exact committed Confirmation transition.'));
      if (receipt?.operator_token !== userToken) diagnostics.push(diagnostic('RUN-CONFIRM-REPLAY-003', 'Confirmation replay token differs from the committed token.'));
      if (receipt?.receipt_digest !== digestWithout(receipt, 'receipt_digest') || result.receipt_digest !== receipt?.receipt_digest) diagnostics.push(diagnostic('RUN-CONFIRM-REPLAY-004', 'Committed Confirmation Receipt/Result binding is invalid.'));
      if (receipt?.context_digest !== context.context_digest || receipt?.package_digest !== context.canonical_package_digest || receipt?.selected_candidate_id !== context.selected_candidate_id || receipt?.batch_id !== context.action_batch.batch_id) diagnostics.push(diagnostic('RUN-CONFIRM-REPLAY-005', 'Committed Confirmation identity differs from the active Context.'));
      if (!sameSet(receipt?.action_ids, context.action_batch.action_ids) || sortedCanonicalJson(receipt?.action_digests) !== sortedCanonicalJson(context.action_batch.action_digests)) diagnostics.push(diagnostic('RUN-CONFIRM-REPLAY-006', 'Committed Confirmation Action binding is invalid.'));
      const refs = { generation_ref: loaded.current.generation_ref, receipt_ref: manifest.active_confirmation_receipt_ref, result_ref: manifest.active_confirmation_result_ref };
      diagnostics.push(...validatePublication(result, 'confirm-batch', refs, 'ev4-builder-confirmation-result@2.0.0', manifest.run_id));
      return { passed: diagnostics.length === 0, diagnostics };
    }
  });
}

export function confirmRunBatch({ runDirectory, userToken, failureInjection = null }) {
  return withRunMutation({ runDirectory, operation: 'confirm-batch', failureInjection }, (loaded) => {
    const replay = detectConfirmationReplay(loaded, userToken);
    if (replay.matched) return replay.outcome;

    const diagnostics = [];
    const { manifest, context, session, checkpoint } = loaded;
    if (manifest.active_confirmation_receipt_ref) diagnostics.push(diagnostic('RUN-CONFIRM-007', 'Action Batch is already confirmed.'));
    if (checkpoint.runtime_state !== 'WAITING_FOR_CONFIRMATION' || session.runtime_state !== 'WAITING_FOR_CONFIRMATION') diagnostics.push(diagnostic('RUN-CONFIRM-008', 'confirm-batch accepts only WAITING_FOR_CONFIRMATION State.'));
    if ((checkpoint.confirmed_action_ids || []).length !== 0 || !sameSet(checkpoint.unconfirmed_action_ids, context.action_batch.action_ids)) diagnostics.push(diagnostic('RUN-CONFIRM-009', 'WAITING Checkpoint Action mirrors are invalid.'));
    if (checkpoint.batch_id !== context.action_batch.batch_id) diagnostics.push(diagnostic('RUN-CONFIRM-010', 'WAITING Checkpoint Batch binding is invalid.'));
    if (userToken !== context.confirmation.expected_user_token) diagnostics.push(diagnostic('RUN-CONFIRM-011', 'Operator token does not match active Confirmation binding.'));
    const blockers = collectActiveBlockers(session, checkpoint);
    if (blockers.length) diagnostics.push(diagnostic('RUN-CONFIRM-012', `Confirmation is blocked by: ${blockers.join(', ')}.`));
    const emit = validateEmitBinding(loaded);
    diagnostics.push(...emit.diagnostics);
    if (diagnostics.length) return { ...loaded, passed: false, diagnostics, active_blockers: blockers };
    const transitionId = `CONFIRM-${computeCanonicalDigest({ run_id: manifest.run_id, emit_transition: emit.emitResult.transition_id, token: userToken }).slice(0, 16)}`;
    const receiptRef = `transitions/confirmation/${transitionId}/confirmation-receipt.json`;
    const resultRef = `transitions/confirmation/${transitionId}/confirmation-result.json`;
    const resulting = buildCheckpoint({
      runId: manifest.run_id,
      sessionId: session.session_id,
      context,
      sequence: checkpoint.checkpoint_sequence + 1,
      parentId: checkpoint.checkpoint_id,
      state: 'BUILD_ACTIVE',
      confirmedActionIds: context.action_batch.action_ids,
      unconfirmedActionIds: [],
      unresolvedBlockers: checkpoint.unresolved_blockers || [],
      assertions: checkpoint.assertions,
      evidenceLedger: checkpoint.evidence_ledger,
      createdFrom: 'user_confirmation'
    });
    const nextSession = updateSessionForCheckpoint(session, resulting);
    const receipt = {
      schema: 'ev4-builder-confirmation-receipt@2.0.0',
      run_id: manifest.run_id,
      runtime_mode: RUNTIME_MODES.REAL,
      context_digest: context.context_digest,
      package_digest: context.canonical_package_digest,
      selected_candidate_id: context.selected_candidate_id,
      confirmation_id: context.confirmation.confirmation_id,
      operator_token: userToken,
      batch_id: context.action_batch.batch_id,
      action_ids: [...context.action_batch.action_ids],
      action_digests: { ...context.action_batch.action_digests },
      predecessor_checkpoint: { checkpoint_id: checkpoint.checkpoint_id, checkpoint_sequence: checkpoint.checkpoint_sequence },
      resulting_checkpoint: { checkpoint_id: resulting.checkpoint_id, checkpoint_sequence: resulting.checkpoint_sequence, parent_checkpoint_id: resulting.parent_checkpoint_id },
      receipt_digest: null
    };
    receipt.receipt_digest = digestWithout(receipt, 'receipt_digest');
    const refs = { generation_ref: generationRef(loaded.current.generation + 1), receipt_ref: receiptRef, result_ref: resultRef };
    const result = {
      schema: 'ev4-builder-confirmation-result@2.0.0',
      run_id: manifest.run_id,
      transition_id: transitionId,
      status: 'accepted',
      context_digest: context.context_digest,
      package_digest: context.canonical_package_digest,
      selected_candidate_id: context.selected_candidate_id,
      confirmation_id: context.confirmation.confirmation_id,
      batch_id: context.action_batch.batch_id,
      action_ids: [...context.action_batch.action_ids],
      action_digests: { ...context.action_batch.action_digests },
      predecessor_checkpoint: receipt.predecessor_checkpoint,
      resulting_checkpoint: receipt.resulting_checkpoint,
      receipt_digest: receipt.receipt_digest,
      runtime_state: 'BUILD_ACTIVE',
      builder_build_complete: false,
      responsive_complete: false,
      production_ready: false,
      publication: { atomic: true, files: expectedPublicationFiles('confirm-batch', refs) },
      blocking_diagnostics: []
    };
    const publicationDiagnostics = validatePublication(result, 'confirm-batch', refs, 'ev4-builder-confirmation-result@2.0.0', manifest.run_id);
    if (publicationDiagnostics.length) return { ...loaded, passed: false, diagnostics: publicationDiagnostics };
    return publishSuccessor({
      loaded,
      operation: 'confirm-batch',
      context,
      session: nextSession,
      checkpoint: resulting,
      manifestUpdates: { active_confirmation_receipt_ref: receiptRef, active_confirmation_result_ref: resultRef, confirmed_checkpoint_id: resulting.checkpoint_id, confirmed_checkpoint_sequence: resulting.checkpoint_sequence },
      result,
      auxiliaryFiles: [{ ref: receiptRef, kind: 'json', value: receipt }, { ref: resultRef, kind: 'json', value: result }],
      failureInjection
    });
  });
}
