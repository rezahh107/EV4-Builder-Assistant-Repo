import fs from 'node:fs';
import { diagnostic, readBytes, readJson, safeRunRef } from './run-primitives.mjs';
import { fullDeriveAndCompare } from './run-state-validation.mjs';

function readCanonicalArtifact(predecessor, ref, expectedSchema, code, label) {
  const file = safeRunRef(predecessor.runDirectory, ref);
  if (!file || !fs.existsSync(file)) return { value: null, diagnostic: diagnostic(code, `${label} is missing or unsafe: ${ref || '<null>'}.`) };
  try {
    const value = readJson(file);
    return value?.schema === expectedSchema
      ? { value, diagnostic: null }
      : { value, diagnostic: diagnostic(code, `${label} Schema is invalid.`, `expected=${expectedSchema};actual=${value?.schema || '<missing>'}`) };
  } catch (error) {
    return { value: null, diagnostic: diagnostic(code, `${label} is malformed.`, error.message) };
  }
}

export function preparePlanningPredecessor(predecessor, operation) {
  const planning = { diagnostics: [], fullDerivation: null, emitResult: null, confirmationReceipt: null, confirmationResult: null, evidenceEntries: [] };
  if (operation === 'emit-batch' || operation === 'real-completion') planning.fullDerivation = fullDeriveAndCompare(predecessor);
  if (operation === 'confirm-batch') {
    const emit = readCanonicalArtifact(predecessor, predecessor.manifest?.active_emit_result_ref, 'ev4-builder-emit-batch-result@2.0.0', 'RUN-CONFIRM-001', 'Active emit-batch Result');
    planning.emitResult = emit.value;
    if (emit.diagnostic) planning.diagnostics.push(emit.diagnostic);
  }
  if (operation === 'real-completion') {
    const receipt = readCanonicalArtifact(predecessor, predecessor.manifest?.active_confirmation_receipt_ref, 'ev4-builder-confirmation-receipt@2.0.0', 'RUN-COMPLETE-CONFIRM-001', 'Canonical Confirmation Receipt');
    const result = readCanonicalArtifact(predecessor, predecessor.manifest?.active_confirmation_result_ref, 'ev4-builder-confirmation-result@2.0.0', 'RUN-COMPLETE-CONFIRM-001', 'Canonical Confirmation Result');
    planning.confirmationReceipt = receipt.value;
    planning.confirmationResult = result.value;
    if (receipt.diagnostic) planning.diagnostics.push(receipt.diagnostic);
    if (result.diagnostic) planning.diagnostics.push(result.diagnostic);
    for (const ref of predecessor.manifest?.evidence_snapshot_refs || []) {
      const file = safeRunRef(predecessor.runDirectory, ref);
      if (!file || !fs.existsSync(file)) {
        planning.evidenceEntries.push({ ref, bytes: null, source: null, error: `Evidence snapshot is missing or unsafe: ${ref}.` });
        continue;
      }
      try {
        const bytes = readBytes(file);
        planning.evidenceEntries.push({ ref, bytes, source: JSON.parse(bytes.toString('utf8')), error: null });
      } catch (error) {
        planning.evidenceEntries.push({ ref, bytes: null, source: null, error: error.message });
      }
    }
  }
  return { ...predecessor, planning };
}

export function failedPlan(predecessor, diagnostics, extra = {}) {
  return { ...predecessor, passed: false, diagnostics, ...extra };
}

export function successfulPlan(operation, context, session, checkpoint, manifestUpdates, result, auxiliaryFiles, refs, extra = {}) {
  return { passed: true, diagnostics: [], operation, context, session, checkpoint, manifestUpdates, result, auxiliaryFiles, refs, ...extra };
}
