import {
  initializeAtomicRun as initializeAtomicRunImplementation,
  emitRunBatch as emitRunBatchImplementation,
  confirmRunBatch as confirmRunBatchImplementation
} from './canonical-run-transitions.mjs';
import { attachRunEvidence as attachRunEvidenceImplementation } from './canonical-run-evidence.mjs';
import {
  completeRun as completeRunImplementation,
  validateCanonicalRun,
  inspectRunGenerations,
  recoverRunLock,
  CANONICAL_REAL_OPERATIONS
} from './canonical-run-completion.mjs';

function preserveExpectedRuntimeDiagnostic(result) {
  const expectedCode = result?.expected_diagnostic_code;
  const diagnostics = result?.diagnostics;
  const reportedCode = diagnostics?.[0]?.code;
  const isGenericMutationFailure = typeof reportedCode === 'string'
    && /^RUN-[A-Z0-9_]+-FAILURE$/.test(reportedCode);
  const isExpectedRuntimeCode = typeof expectedCode === 'string'
    && /^RUN[-_]/.test(expectedCode);

  if (result?.passed !== false
    || !isGenericMutationFailure
    || !isExpectedRuntimeCode
    || !Array.isArray(diagnostics)
    || diagnostics.length !== 1) return result;

  return {
    ...result,
    diagnostics: [{ ...diagnostics[0], code: expectedCode }]
  };
}

export function initializeAtomicRun(args) {
  return initializeAtomicRunImplementation(args);
}

export function emitRunBatch(args) {
  return preserveExpectedRuntimeDiagnostic(emitRunBatchImplementation(args));
}

export function confirmRunBatch(args) {
  return preserveExpectedRuntimeDiagnostic(confirmRunBatchImplementation(args));
}

export function attachRunEvidence(args) {
  return preserveExpectedRuntimeDiagnostic(attachRunEvidenceImplementation(args));
}

export function completeRun(args) {
  return preserveExpectedRuntimeDiagnostic(completeRunImplementation(args));
}

export {
  validateCanonicalRun,
  inspectRunGenerations,
  recoverRunLock,
  CANONICAL_REAL_OPERATIONS
};
export { validateCanonicalSourceModeArguments, collectActiveBlockers } from './run-primitives.mjs';
