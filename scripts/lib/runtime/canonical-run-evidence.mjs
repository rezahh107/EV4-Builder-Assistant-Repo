import { sha256Bytes } from '../canonical-builder-package.mjs';
import { diagnostic, resolveRoot, readBytes } from './run-primitives.mjs';
import { executePlannedMutation } from './committed-transition-replay.mjs';
export { claimSetCompatible, validateEvidenceSource } from './transition-planner-evidence.mjs';

export function attachRunEvidence({ runDirectory, evidenceSourceFile, failureInjection = null }) {
  let evidenceBytes;
  try {
    evidenceBytes = readBytes(resolveRoot(evidenceSourceFile));
  } catch (error) {
    return { passed: false, operation: 'attach-evidence', state_modified: false, diagnostics: [diagnostic('RUN-EVIDENCE-013', 'External Evidence source is unreadable or malformed.', error.message)] };
  }
  const evidenceSha = sha256Bytes(evidenceBytes);
  return executePlannedMutation({
    runDirectory,
    operation: 'attach-evidence',
    commandInput: { evidenceBytes, evidenceRef: `evidence/EV-${evidenceSha.slice(0, 20)}.json` },
    failureInjection
  });
}
