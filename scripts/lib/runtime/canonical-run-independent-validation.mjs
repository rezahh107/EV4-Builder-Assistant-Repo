import fs from 'node:fs';

import { runAjv } from '../builder-runtime-transition.mjs';
import { diagnostic, generationRef, readBytes, readJson, safeRunRef } from './run-primitives.mjs';
import { verifyCommittedTransitionReplay } from './committed-transition-replay.mjs';

function conflict(loaded, mismatch, message) {
  return {
    ...loaded,
    passed: false,
    diagnostics: [
      ...(loaded.diagnostics || []),
      diagnostic('RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT', message, `mismatch=${mismatch}`)
    ],
    committed_transition_history_validated: false,
    active_committed_transition_validated: false
  };
}

function validateConfirmationReceiptSchema(loaded) {
  const ref = loaded.manifest?.active_confirmation_receipt_ref;
  if (!ref) return [];
  const file = safeRunRef(loaded.runDirectory, ref);
  if (!file || !fs.existsSync(file)) return [diagnostic('RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT', 'Confirmation Receipt is missing or unsafe before replay reconstruction.', `mismatch=auxiliary:${ref}`)];
  const schema = runAjv('schemas/confirmation-receipt.v2.schema.json', file);
  if (!schema.passed) return [diagnostic('RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT', 'Confirmation Receipt failed Schema validation before replay reconstruction.', `mismatch=auxiliary:${ref};${schema.detail}`)];
  try {
    const receipt = readJson(file);
    if (receipt?.schema !== 'ev4-builder-confirmation-receipt@2.0.0' || typeof receipt.operator_token !== 'string' || !receipt.operator_token) return [diagnostic('RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT', 'Confirmation Receipt failed structural validation before replay input recovery.', `mismatch=auxiliary:${ref}`)];
  } catch (error) {
    return [diagnostic('RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT', 'Confirmation Receipt is malformed before replay input recovery.', `mismatch=auxiliary:${ref};${error.message}`)];
  }
  return [];
}

function validateEvidenceSnapshotSchemas(loaded) {
  const diagnostics = [];
  for (const ref of loaded.manifest?.evidence_snapshot_refs || []) {
    const file = safeRunRef(loaded.runDirectory, ref);
    if (!file || !fs.existsSync(file)) {
      diagnostics.push(diagnostic('RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT', 'Evidence snapshot is missing or unsafe before replay reconstruction.', `mismatch=auxiliary:${ref}`));
      continue;
    }
    try {
      const source = readJson(file);
      if (source?.schema !== 'ev4-builder-evidence-source@1.0.0') diagnostics.push(diagnostic('RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT', 'Evidence snapshot Schema is invalid before replay reconstruction.', `mismatch=auxiliary:${ref}`));
    } catch (error) {
      diagnostics.push(diagnostic('RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT', 'Evidence snapshot is malformed before replay reconstruction.', `mismatch=auxiliary:${ref};${error.message}`));
    }
  }
  return diagnostics;
}

function loadRecordedPredecessorManifest(loaded) {
  const number = loaded.current?.generation;
  if (!Number.isInteger(number) || number <= 1) return { passed: true, manifest: null };
  const ref = `${generationRef(number - 1)}/run-manifest.json`;
  const file = safeRunRef(loaded.runDirectory, ref);
  if (!file || !fs.existsSync(file)) return { passed: false, mismatch: 'generation:run-manifest.json' };
  try {
    return { passed: true, manifest: readJson(file) };
  } catch {
    return { passed: false, mismatch: 'generation:run-manifest.json' };
  }
}

function inferActiveOperation(activeManifest, predecessorManifest) {
  if (!activeManifest || !predecessorManifest) return null;
  if (activeManifest.completion_result_ref && activeManifest.completion_result_ref !== predecessorManifest.completion_result_ref) return 'real-completion';
  if ((activeManifest.evidence_attachment_result_refs || []).length === (predecessorManifest.evidence_attachment_result_refs || []).length + 1) return 'attach-evidence';
  if (activeManifest.active_confirmation_result_ref && activeManifest.active_confirmation_result_ref !== predecessorManifest.active_confirmation_result_ref) return 'confirm-batch';
  if (activeManifest.active_emit_result_ref && activeManifest.active_emit_result_ref !== predecessorManifest.active_emit_result_ref) return 'emit-batch';
  return null;
}

function recoverActiveCommandInput(loaded, operation) {
  if (operation === 'confirm-batch') {
    const ref = loaded.manifest.active_confirmation_receipt_ref;
    const file = safeRunRef(loaded.runDirectory, ref);
    try {
      const receipt = file ? readJson(file) : null;
      if (typeof receipt?.operator_token !== 'string' || !receipt.operator_token) return { passed: false, mismatch: `auxiliary:${ref || 'confirmation-receipt.json'}` };
      return { passed: true, commandInput: { userToken: receipt.operator_token } };
    } catch {
      return { passed: false, mismatch: `auxiliary:${ref || 'confirmation-receipt.json'}` };
    }
  }
  if (operation === 'attach-evidence') {
    const ref = loaded.manifest.evidence_snapshot_refs?.at(-1);
    const file = safeRunRef(loaded.runDirectory, ref);
    if (!file || !fs.existsSync(file)) return { passed: false, mismatch: `auxiliary:${ref || 'evidence-snapshot'}` };
    return { passed: true, commandInput: { evidenceBytes: readBytes(file), evidenceRef: ref } };
  }
  return { passed: true, commandInput: {} };
}

export function validateIndependentCommittedTransitions(runDirectory, loaded) {
  const diagnostics = [
    ...validateConfirmationReceiptSchema(loaded),
    ...validateEvidenceSnapshotSchemas(loaded)
  ];
  if (diagnostics.length) return { ...loaded, passed: false, diagnostics: [...(loaded.diagnostics || []), ...diagnostics], committed_transition_history_validated: false, active_committed_transition_validated: false };
  if (loaded.current?.generation === 1) return { ...loaded, passed: true, committed_transition_history_validated: true, active_committed_transition_validated: true };

  const predecessor = loadRecordedPredecessorManifest(loaded);
  if (!predecessor.passed) return conflict(loaded, predecessor.mismatch, 'Exact predecessor Manifest is unavailable for active committed transition reconstruction.');
  const operation = inferActiveOperation(loaded.manifest, predecessor.manifest);
  if (!operation) return conflict(loaded, 'generation:run-manifest.json', 'Active committed transition operation cannot be identified from exact predecessor bindings.');
  const recovered = recoverActiveCommandInput(loaded, operation);
  if (!recovered.passed) return conflict(loaded, recovered.mismatch, 'Canonical command input cannot be recovered for active committed transition reconstruction.');

  const replay = verifyCommittedTransitionReplay({ active: loaded, operation, commandInput: recovered.commandInput });
  if (!replay.matched || !replay.outcome?.passed) {
    return {
      ...loaded,
      passed: false,
      diagnostics: [
        ...(loaded.diagnostics || []),
        ...(replay.outcome?.diagnostics || [diagnostic('RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT', 'Active committed transition exactness validation failed.', 'mismatch=generation:run-manifest.json')])
      ],
      committed_transition_history_validated: false,
      active_committed_transition_validated: false
    };
  }
  return { ...loaded, passed: true, diagnostics: loaded.diagnostics || [], committed_transition_history_validated: true, active_committed_transition_validated: true };
}
