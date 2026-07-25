import fs from 'node:fs';

import { runAjv } from '../builder-runtime-transition.mjs';
import { diagnostic, readJson, safeRunRef } from './run-primitives.mjs';
import { validateCommittedTransitionHistory } from './committed-transition-replay.mjs';

function validateConfirmationReceiptSchema(loaded) {
  const ref = loaded.manifest?.active_confirmation_receipt_ref;
  if (!ref) return [];
  const file = safeRunRef(loaded.runDirectory, ref);
  if (!file || !fs.existsSync(file)) return [diagnostic('RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT', 'Confirmation Receipt is missing or unsafe before replay reconstruction.', `mismatch=auxiliary:${ref}`)];
  const schema = runAjv('schemas/confirmation-receipt.v2.schema.json', file);
  return schema.passed ? [] : [diagnostic('RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT', 'Confirmation Receipt failed Schema validation before replay reconstruction.', `mismatch=auxiliary:${ref};${schema.detail}`)];
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

export function validateIndependentCommittedTransitions(runDirectory, loaded) {
  const diagnostics = [
    ...validateConfirmationReceiptSchema(loaded),
    ...validateEvidenceSnapshotSchemas(loaded)
  ];
  if (diagnostics.length) return { ...loaded, passed: false, diagnostics: [...loaded.diagnostics, ...diagnostics], committed_transition_history_validated: false };
  return validateCommittedTransitionHistory(runDirectory);
}
