import { validateResumeTransition } from './builder-runtime-transition.mjs';
import { validateCheckpointSequence } from './checkpoint-sequence.mjs';
import {
  collectActiveBlockers,
  validateCanonicalSourceModeArguments
} from './runtime/canonical-run-runtime.mjs';

function inactiveLegacyAuthority(operation) {
  return {
    passed: false,
    status: 'blocked',
    authority_scope: 'legacy_fixture_and_historical_reproduction_only',
    builder_build_complete: false,
    responsive_complete: false,
    production_ready: false,
    diagnostics: [{
      code: 'BUILDER-LEGACY-AUTHORITY-INACTIVE',
      message: `${operation} is not an active real Runtime authority. Use scripts/builder-inspector.mjs with the canonical Run-directory API.`
    }]
  };
}

export function validateSourceModeArguments(options) {
  return validateCanonicalSourceModeArguments(options);
}

export function writeStrictRealIntake() {
  return inactiveLegacyAuthority('writeStrictRealIntake');
}

export function validateEmitBatchTransaction() {
  return inactiveLegacyAuthority('validateEmitBatchTransaction');
}

export function publishEmitBatchTransaction() {
  return inactiveLegacyAuthority('publishEmitBatchTransaction');
}

export function validateConfirmationTransaction() {
  return inactiveLegacyAuthority('validateConfirmationTransaction');
}

export function publishConfirmationTransaction() {
  return inactiveLegacyAuthority('publishConfirmationTransaction');
}

export function validateStrictConfirmationReceipt() {
  return inactiveLegacyAuthority('validateStrictConfirmationReceipt');
}

export function verifyStrictEvidenceLedger() {
  return inactiveLegacyAuthority('verifyStrictEvidenceLedger');
}

export function validateStrictRealCompletion() {
  return inactiveLegacyAuthority('validateStrictRealCompletion');
}

export function publishStrictRealCompletion() {
  return inactiveLegacyAuthority('publishStrictRealCompletion');
}

export function validateCanonicalResume(options) {
  const result = validateResumeTransition(options);
  const diagnostics = [...result.diagnostics];
  if (result.checkpoint) diagnostics.push(...validateCheckpointSequence(result.checkpoint, 'BUILDER-RESUME-SEQ-101', 'Resume Checkpoint'));
  if (result.nextCheckpoint) diagnostics.push(...validateCheckpointSequence(result.nextCheckpoint, 'BUILDER-RESUME-SEQ-102', 'Generated Resume Checkpoint'));
  const blockers = result.session && result.checkpoint ? collectActiveBlockers(result.session, result.checkpoint) : [];
  if (blockers.length) diagnostics.push({ code: 'BUILDER-RESUME-BLOCKERS-001', message: `Resume has active blockers: ${blockers.join(', ')}.` });
  return { ...result, passed: result.passed && diagnostics.length === 0, diagnostics, active_blockers: blockers };
}
