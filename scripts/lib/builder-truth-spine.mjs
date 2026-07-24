import {
  CLAIM_COMPATIBILITY,
  RUNTIME_MODES,
  fixtureValidateBuilderInput
} from './builder-explicit-source-runtime.mjs';

function inactiveLegacyAuthority(operation) {
  return {
    passed: false,
    status: 'blocked',
    authority_scope: 'legacy_fixture_and_historical_reproduction_only',
    runtime_mode: RUNTIME_MODES.FIXTURE,
    runtime_state: 'NOT_A_REAL_RUN',
    builder_build_complete: false,
    responsive_complete: false,
    production_ready: false,
    diagnostics: [{
      code: 'BUILDER-LEGACY-AUTHORITY-INACTIVE',
      message: `${operation} is not an active real Runtime authority. Use the canonical Run-directory API.`
    }]
  };
}

export { CLAIM_COMPATIBILITY, RUNTIME_MODES, fixtureValidateBuilderInput };

export function createConfirmationReceipt() {
  return inactiveLegacyAuthority('createConfirmationReceipt');
}

export function writeConfirmationReceipt() {
  return inactiveLegacyAuthority('writeConfirmationReceipt');
}

export function validateConfirmationReceipt() {
  return inactiveLegacyAuthority('validateConfirmationReceipt');
}

export function verifyEvidenceLedger() {
  return inactiveLegacyAuthority('verifyEvidenceLedger');
}

export function resolveRealBuilderSource() {
  return inactiveLegacyAuthority('resolveRealBuilderSource');
}

export function verifyDerivedContext() {
  return inactiveLegacyAuthority('verifyDerivedContext');
}

export function validateRealCompletion() {
  return inactiveLegacyAuthority('validateRealCompletion');
}

export function publishRealCompletion() {
  return inactiveLegacyAuthority('publishRealCompletion');
}

export function writeRealIntake() {
  return inactiveLegacyAuthority('writeRealIntake');
}
