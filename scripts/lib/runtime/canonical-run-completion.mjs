import fs from 'node:fs';
import path from 'node:path';

import { computeCanonicalDigest, sha256Bytes, sortedCanonicalJson } from '../canonical-builder-package.mjs';
import { CLAIM_COMPATIBILITY } from '../builder-explicit-source-runtime.mjs';
import { checkpointSequenceIsValid } from '../checkpoint-sequence.mjs';
import {
  GENERATION_NAME,
  REQUIRED_COMPLETION_CLAIMS,
  diagnostic,
  resolveRoot,
  readBytes,
  sameSet,
  digestWithout,
  safeRunRef,
  generationRef,
  collectActiveBlockers,
  buildCheckpoint,
  updateSessionForCheckpoint
} from './run-primitives.mjs';
import { validateGeneration, loadRunUnlocked, fullDeriveAndCompare } from './run-state-validation.mjs';
import { expectedPublicationFiles, validatePublication, publishSuccessor, withRunMutation } from './run-state-store.mjs';
import { loadTransitionResult } from './canonical-run-transitions.mjs';
import { validateEvidenceSource } from './canonical-run-evidence.mjs';

function verifyInternalEvidence(loaded) {
  const diagnostics = [];
  const verified = [];
  const verifiedClaimClasses = new Set();
  const verifiedActionIds = new Set();
  const records = new Map((loaded.checkpoint.evidence_ledger || []).map((entry) => [entry.evidence_id, entry]));
  const assertions = new Map((loaded.checkpoint.assertions || []).map((entry) => [entry.assertion_id, entry]));
  for (const ref of loaded.manifest.evidence_snapshot_refs || []) {
    const file = safeRunRef(loaded.runDirectory, ref);
    if (!file || !fs.existsSync(file)) {
      diagnostics.push(diagnostic('RUN-COMPLETE-EVIDENCE-001', `Evidence snapshot is missing or unsafe: ${ref}.`));
      continue;
    }
    const bytes = readBytes(file);
    const actualSha = sha256Bytes(bytes);
    const evidenceId = `EV-${actualSha.slice(0, 20)}`;
    const record = records.get(evidenceId);
    if (!record) {
      diagnostics.push(diagnostic('RUN-COMPLETE-EVIDENCE-002', `Evidence ledger record is missing for ${ref}.`));
      continue;
    }
    if (record.source_ref !== ref || record.content_sha256 !== actualSha || record.status !== 'available') diagnostics.push(diagnostic('RUN-COMPLETE-EVIDENCE-003', `Evidence ledger binding is invalid for ${evidenceId}.`));
    let source;
    try {
      source = JSON.parse(bytes.toString('utf8'));
    } catch (error) {
      diagnostics.push(diagnostic('RUN-COMPLETE-EVIDENCE-004', `Evidence snapshot is malformed: ${evidenceId}.`, error.message));
      continue;
    }
    const local = validateEvidenceSource(source, loaded);
    for (const claimId of source.claim_ids || []) {
      const assertion = assertions.get(claimId);
      if (!assertion || assertion.status !== 'confirmed' || assertion.subject_ref !== source.subject_ref || !assertion.evidence_refs?.includes(evidenceId)) local.push(diagnostic('RUN-COMPLETE-EVIDENCE-005', `Evidence does not bind the exact confirmed assertion ${claimId}.`));
      if (!(record.supports_claim_ids || []).includes(claimId)) local.push(diagnostic('RUN-COMPLETE-EVIDENCE-006', `Evidence record does not support the exact assertion ${claimId}.`));
    }
    diagnostics.push(...local);
    if (!local.length) {
      verified.push({ evidence_id: evidenceId, evidence_snapshot_ref: ref, evidence_snapshot_sha256: actualSha, claim_classes: [...source.claim_classes], action_id: source.action_id ?? null });
      for (const claimClass of source.claim_classes) verifiedClaimClasses.add(claimClass);
      if (source.claim_classes.includes('required_action_execution')) verifiedActionIds.add(source.action_id);
    }
  }
  for (const actionId of loaded.context.action_batch.action_ids) if (!verifiedActionIds.has(actionId)) diagnostics.push(diagnostic('RUN-COMPLETE-EVIDENCE-007', `Required Action lacks internal Action-specific Evidence: ${actionId}.`));
  for (const claimClass of REQUIRED_COMPLETION_CLAIMS) if (!verifiedClaimClasses.has(claimClass)) diagnostics.push(diagnostic('RUN-COMPLETE-EVIDENCE-008', `Required Completion claim lacks internal verified Evidence: ${claimClass}.`));
  return { passed: diagnostics.length === 0, diagnostics, verified, verified_action_ids: [...verifiedActionIds].sort(), verified_claim_classes: [...verifiedClaimClasses].sort() };
}

function validateConfirmationForCompletion(loaded) {
  const diagnostics = [];
  let receipt;
  let result;
  try {
    receipt = loadTransitionResult(loaded.runDirectory, loaded.manifest.active_confirmation_receipt_ref, 'ev4-builder-confirmation-receipt@2.0.0');
    result = loadTransitionResult(loaded.runDirectory, loaded.manifest.active_confirmation_result_ref, 'ev4-builder-confirmation-result@2.0.0');
  } catch (error) {
    return { passed: false, diagnostics: [diagnostic('RUN-COMPLETE-CONFIRM-001', 'Canonical Confirmation artifacts are unavailable.', error.message)] };
  }
  const { manifest, context, checkpoint } = loaded;
  if (receipt.receipt_digest !== digestWithout(receipt, 'receipt_digest')) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-002', 'Confirmation Receipt digest is invalid.'));
  if (receipt.run_id !== manifest.run_id || result.run_id !== manifest.run_id) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-003', 'Confirmation Run binding is invalid.'));
  if (receipt.context_digest !== context.context_digest || result.context_digest !== context.context_digest) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-004', 'Confirmation Context binding is invalid.'));
  if (receipt.package_digest !== context.canonical_package_digest || receipt.selected_candidate_id !== context.selected_candidate_id || receipt.confirmation_id !== context.confirmation.confirmation_id) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-005', 'Confirmation Package/Candidate/ID binding is invalid.'));
  if (receipt.batch_id !== context.action_batch.batch_id || checkpoint.batch_id !== context.action_batch.batch_id) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-006', 'Confirmation/current Checkpoint Batch binding is invalid.'));
  if (!sameSet(receipt.action_ids, context.action_batch.action_ids) || sortedCanonicalJson(receipt.action_digests) !== sortedCanonicalJson(context.action_batch.action_digests)) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-007', 'Confirmation Action binding is invalid.'));
  if (receipt.operator_token !== context.confirmation.expected_user_token) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-008', 'Confirmation operator token binding is invalid.'));
  if (receipt.resulting_checkpoint?.checkpoint_id !== manifest.confirmed_checkpoint_id || receipt.resulting_checkpoint?.checkpoint_sequence !== manifest.confirmed_checkpoint_sequence) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-009', 'Confirmation resulting Checkpoint binding is invalid.'));
  if (result.receipt_digest !== receipt.receipt_digest || result.resulting_checkpoint?.checkpoint_id !== receipt.resulting_checkpoint?.checkpoint_id) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-010', 'Confirmation Result and Receipt disagree.'));
  if (!sameSet(checkpoint.confirmed_action_ids, context.action_batch.action_ids) || (checkpoint.unconfirmed_action_ids || []).length !== 0) diagnostics.push(diagnostic('RUN-COMPLETE-CONFIRM-011', 'Current Checkpoint does not preserve exact confirmed Action set.'));
  return { passed: diagnostics.length === 0, diagnostics, receipt, result };
}

function deriveCompletionArtifacts(evidence) {
  const claims = new Set(evidence.verified_claim_classes);
  const states = {
    scaffold_built: claims.has('scaffold_built'),
    structure_built: claims.has('structure_built'),
    content_filled: claims.has('content_filled'),
    desktop_layout_established: claims.has('desktop_layout_established'),
    export_checked: claims.has('export_checked')
  };
  const status = {
    schema: 'ev4-builder-derived-completion-status@1.0.0',
    claim_scope: 'desktop',
    states,
    evidence: { export: states.export_checked },
    derivation: { required_actions_verified: true, verified_evidence_refs: evidence.verified.map((entry) => entry.evidence_id), unresolved_blockers: [] },
    scope_excludes_responsive: true,
    production_ready: false
  };
  const proof = (claim) => ({
    claim_id: claim,
    subject_ref: 'builder-output',
    verification_method: 'internal_run_evidence_snapshot',
    required_evidence_types: CLAIM_COMPATIBILITY[claim],
    verified_evidence_refs: evidence.verified.filter((entry) => entry.claim_classes.includes(claim)).map((entry) => entry.evidence_id),
    derived_status: claims.has(claim) ? 'confirmed' : 'missing',
    diagnostics: []
  });
  return {
    status,
    gate: {
      schema: 'ev4-builder-derived-completion-gate@1.0.0',
      proofs: { layout_verified: proof('layout_verified'), export_verified: proof('export_verified') },
      responsive_complete: false,
      production_ready: false
    }
  };
}

export function completeRun({ runDirectory, failureInjection = null }) {
  return withRunMutation({ runDirectory, operation: 'real-completion', failureInjection }, (loaded) => {
    const derivation = fullDeriveAndCompare(loaded);
    const diagnostics = [...derivation.diagnostics];
    const { manifest, context, session, checkpoint } = loaded;
    if (checkpoint.runtime_state === 'COMPLETED') diagnostics.push(diagnostic('RUN-COMPLETE-001', 'Run is already COMPLETED.'));
    if (checkpoint.runtime_state !== 'BUILD_ACTIVE' || session.runtime_state !== 'BUILD_ACTIVE') diagnostics.push(diagnostic('RUN-COMPLETE-002', 'real-completion requires BUILD_ACTIVE State.'));
    if (!checkpointSequenceIsValid(checkpoint)) diagnostics.push(diagnostic('RUN-COMPLETE-003', 'Completion predecessor Checkpoint sequence/parent is invalid.'));
    const blockers = collectActiveBlockers(session, checkpoint);
    if (blockers.length) diagnostics.push(diagnostic('RUN-COMPLETE-004', `Completion is blocked by: ${blockers.join(', ')}.`));
    const confirmation = validateConfirmationForCompletion(loaded);
    diagnostics.push(...confirmation.diagnostics);
    const evidence = verifyInternalEvidence(loaded);
    diagnostics.push(...evidence.diagnostics);
    if (diagnostics.length) return { ...loaded, passed: false, diagnostics, active_blockers: blockers, confirmation, evidence };
    const derived = deriveCompletionArtifacts(evidence);
    if (Object.values(derived.status.states).some((value) => value !== true) || Object.values(derived.gate.proofs).some((entry) => entry.derived_status !== 'confirmed')) return { ...loaded, passed: false, diagnostics: [diagnostic('RUN-COMPLETE-005', 'Runtime-derived Completion predicates are incomplete.')] };
    const transitionId = `COMPLETE-${computeCanonicalDigest({ run_id: manifest.run_id, checkpoint_id: checkpoint.checkpoint_id, evidence: evidence.verified.map((entry) => entry.evidence_snapshot_sha256) }).slice(0, 16)}`;
    const resultRef = `transitions/completion/${transitionId}/completion-result.json`;
    const statusRef = `outputs/${transitionId}/completion-status.json`;
    const gateRef = `outputs/${transitionId}/completion-gate.json`;
    const resulting = buildCheckpoint({
      runId: manifest.run_id,
      sessionId: session.session_id,
      context,
      sequence: checkpoint.checkpoint_sequence + 1,
      parentId: checkpoint.checkpoint_id,
      state: 'COMPLETED',
      confirmedActionIds: context.action_batch.action_ids,
      unconfirmedActionIds: [],
      unresolvedBlockers: [],
      assertions: checkpoint.assertions,
      evidenceLedger: checkpoint.evidence_ledger,
      createdFrom: 'export_json'
    });
    const nextSession = updateSessionForCheckpoint({ ...session, unresolved_evidence: [] }, resulting);
    const refs = { generation_ref: generationRef(loaded.current.generation + 1), result_ref: resultRef, status_ref: statusRef, gate_ref: gateRef };
    const result = {
      schema: 'ev4-builder-completion-result@2.0.0',
      run_id: manifest.run_id,
      transition_id: transitionId,
      status: 'accepted',
      source_snapshot_sha256: manifest.source_snapshot_sha256,
      context_digest: context.context_digest,
      package_digest: context.canonical_package_digest,
      selected_candidate_id: context.selected_candidate_id,
      confirmation_id: context.confirmation.confirmation_id,
      batch_id: context.action_batch.batch_id,
      action_ids: [...context.action_batch.action_ids],
      action_digests: { ...context.action_batch.action_digests },
      verified_evidence_ids: evidence.verified.map((entry) => entry.evidence_id),
      predecessor_checkpoint: { checkpoint_id: checkpoint.checkpoint_id, checkpoint_sequence: checkpoint.checkpoint_sequence },
      resulting_checkpoint: { checkpoint_id: resulting.checkpoint_id, checkpoint_sequence: resulting.checkpoint_sequence, parent_checkpoint_id: resulting.parent_checkpoint_id },
      runtime_state: 'COMPLETED',
      builder_build_complete: true,
      responsive_complete: false,
      production_ready: false,
      publication: { atomic: true, files: expectedPublicationFiles('real-completion', refs) },
      blocking_diagnostics: []
    };
    const publicationDiagnostics = validatePublication(result, 'real-completion', refs, 'ev4-builder-completion-result@2.0.0', manifest.run_id);
    if (publicationDiagnostics.length) return { ...loaded, passed: false, diagnostics: publicationDiagnostics };
    return publishSuccessor({
      loaded,
      operation: 'real-completion',
      context,
      session: nextSession,
      checkpoint: resulting,
      manifestUpdates: { completion_result_ref: resultRef, completion_status_ref: statusRef, completion_gate_ref: gateRef },
      result,
      auxiliaryFiles: [{ ref: resultRef, kind: 'json', value: result }, { ref: statusRef, kind: 'json', value: derived.status }, { ref: gateRef, kind: 'json', value: derived.gate }],
      failureInjection
    });
  });
}

export function validateCanonicalRun(runDirectory, { fullDerivation = false } = {}) {
  const loaded = loadRunUnlocked(runDirectory);
  if (!loaded.passed || !fullDerivation) return loaded;
  const derivation = fullDeriveAndCompare(loaded);
  return { ...loaded, passed: derivation.passed, diagnostics: [...loaded.diagnostics, ...derivation.diagnostics], derivation };
}

export function inspectRunGenerations({ runDirectory }) {
  const run = resolveRoot(runDirectory);
  const active = loadRunUnlocked(run);
  if (!active.passed) return active;
  const generationsDirectory = path.join(run, 'generations');
  const validGenerations = [];
  const invalidGenerations = [];
  const orphanGenerations = [];
  const temporaryPaths = [];
  for (const name of fs.readdirSync(generationsDirectory).sort()) {
    if (name.startsWith('.tmp-')) {
      temporaryPaths.push(`generations/${name}`);
      continue;
    }
    if (!GENERATION_NAME.test(name)) continue;
    const number = Number.parseInt(name, 10);
    const validation = validateGeneration(run, path.join(generationsDirectory, name), number);
    if (validation.passed) {
      validGenerations.push(number);
      if (number !== active.current.generation) orphanGenerations.push(number);
    } else invalidGenerations.push({ generation: number, diagnostics: validation.diagnostics });
  }
  for (const name of fs.readdirSync(run).filter((entry) => entry.startsWith('CURRENT.tmp-'))) temporaryPaths.push(name);
  return {
    passed: true,
    diagnostics: [],
    result: {
      schema: 'ev4-builder-generation-inspection@1.0.0',
      status: 'accepted',
      run_id: active.manifest.run_id,
      active_generation: active.current.generation,
      valid_generations: validGenerations,
      orphan_generations: orphanGenerations,
      invalid_generations: invalidGenerations,
      temporary_paths: temporaryPaths,
      builder_build_complete: active.checkpoint.runtime_state === 'COMPLETED',
      responsive_complete: false,
      production_ready: false
    }
  };
}

export function recoverRunLock({ runDirectory }) {
  const run = resolveRoot(runDirectory);
  const lockDirectory = path.join(run, '.mutation-lock');
  if (!fs.existsSync(lockDirectory)) return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-001', 'No Run mutation lock exists.')] };
  const currentTemporary = fs.readdirSync(run).filter((entry) => entry.startsWith('CURRENT.tmp-'));
  if (currentTemporary.length) return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-002', 'Temporary CURRENT pointer files exist; lock recovery is blocked.')] };
  const loaded = loadRunUnlocked(run);
  if (!loaded.passed) return { ...loaded, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-003', 'Active Run validation failed; lock recovery is blocked.'), ...loaded.diagnostics] };
  fs.rmSync(lockDirectory, { recursive: true, force: true });
  return {
    passed: true,
    diagnostics: [],
    result: {
      schema: 'ev4-builder-run-lock-recovery-result@1.0.0',
      status: 'accepted',
      run_id: loaded.manifest.run_id,
      active_generation: loaded.current.generation,
      state_modified: false,
      lock_removed: true,
      builder_build_complete: false,
      responsive_complete: false,
      production_ready: false
    }
  };
}

export const CANONICAL_REAL_OPERATIONS = Object.freeze(['real-intake', 'emit-batch', 'confirm-batch', 'attach-evidence', 'real-completion']);
