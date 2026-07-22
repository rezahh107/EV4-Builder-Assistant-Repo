import { computePackageDigest, sha256Bytes } from '../canonical-builder-package.mjs';
import { diagnostic, readBytes, runAjv, runNode } from './common.mjs';

export function verifyBuilderInput(builderInputFile) {
  const diagnostics = [];
  const bytes = readBytes(builderInputFile);
  const sourceFileSha256 = sha256Bytes(bytes);
  let pkg = null;
  try { pkg = JSON.parse(bytes.toString('utf8')); }
  catch (error) { diagnostics.push(diagnostic('BUILDER-INPUT-001', 'Builder Input is malformed JSON.', error.message)); }

  if (pkg && pkg.schema !== 'ev4-builder-context-package@1.0.0') {
    diagnostics.push(diagnostic('BUILDER-INPUT-002', 'Builder Input schema is not authorized.', `received=${pkg.schema ?? '<missing>'}`));
  }
  if (pkg && diagnostics.length === 0) {
    for (const [code, message, check] of [
      ['BUILDER-INPUT-003', 'Builder Context Schema validation failed.', runAjv('schemas/builder-context-package.schema.json', builderInputFile)],
      ['BUILDER-INPUT-004', 'Builder semantic/cross-field validation failed.', runNode('scripts/validate-package.mjs', builderInputFile)],
      ['BUILDER-INPUT-005', 'Builder decision-lineage validation failed.', runNode('scripts/validate-builder-context-decision-lineage.mjs', builderInputFile)]
    ]) if (!check.passed) diagnostics.push(diagnostic(code, message, check.detail));

    if (pkg.selected_candidate_locked !== true || typeof pkg.selected_candidate_id !== 'string' || !pkg.selected_candidate_id) {
      diagnostics.push(diagnostic('BUILDER-INPUT-006', 'selected_candidate_id is not locked and usable.'));
    }
    const authorization = pkg.input_authorization;
    if (authorization?.decision !== 'approved'
      || authorization?.eligible_workflow_mode !== 'APPROVED_HANDOFF_MODE'
      || authorization?.eligible_runtime_state !== 'BUILD_ACTIVE'
      || !Array.isArray(authorization?.blocking_diagnostics)
      || authorization.blocking_diagnostics.length !== 0) {
      diagnostics.push(diagnostic('BUILDER-INPUT-007', 'input_authorization does not authorize an active Builder run.'));
    }
    const packageDigest = computePackageDigest(pkg);
    if (authorization?.package_digest?.algorithm !== 'sha256'
      || authorization?.package_digest?.scope !== 'canonical_package_without_digest'
      || authorization?.package_digest?.value !== packageDigest) {
      diagnostics.push(diagnostic('BUILDER-INPUT-008', 'Canonical package digest does not match Builder Input.'));
    }
  }

  return {
    passed: diagnostics.length === 0,
    package: pkg,
    source_file_sha256: sourceFileSha256,
    canonical_package_digest: pkg ? computePackageDigest(pkg) : null,
    selected_candidate_id: pkg?.selected_candidate_id ?? null,
    builder_context_schema: pkg?.schema ?? null,
    warnings: pkg?.input_authorization?.visible_flags ?? [],
    diagnostics
  };
}

export function createIntakeResult(verification, outputPath = null) {
  return {
    schema: 'ev4-builder-intake-result@1.0.0',
    status: verification.passed ? 'accepted' : 'blocked',
    source_file_sha256: verification.source_file_sha256,
    canonical_package_digest: verification.canonical_package_digest,
    selected_candidate_id: verification.selected_candidate_id,
    builder_context_schema: verification.builder_context_schema,
    blocking_diagnostics: verification.diagnostics,
    warnings: verification.warnings,
    source_file_unchanged: true,
    publication: { atomic: true, output_path: outputPath }
  };
}

export function verifyCapsuleAgainstInput(capsule, verification) {
  const diagnostics = [];
  if (!verification.passed) diagnostics.push(...verification.diagnostics);
  if (capsule?.schema !== 'ev4-builder-intake-result@1.0.0' || capsule?.status !== 'accepted') diagnostics.push(diagnostic('BUILDER-CAPSULE-001', 'Intake Capsule is not an accepted derived result.'));
  if (capsule?.source_file_sha256 !== verification.source_file_sha256) diagnostics.push(diagnostic('BUILDER-CAPSULE-002', 'Intake Capsule source SHA-256 does not match actual Builder Input bytes.'));
  if (capsule?.canonical_package_digest !== verification.canonical_package_digest) diagnostics.push(diagnostic('BUILDER-CAPSULE-003', 'Intake Capsule package digest does not match recomputed Builder Input digest.'));
  if (capsule?.selected_candidate_id !== verification.selected_candidate_id) diagnostics.push(diagnostic('BUILDER-CAPSULE-004', 'Intake Capsule candidate does not match actual Builder Input.'));
  if (capsule?.builder_context_schema !== verification.builder_context_schema) diagnostics.push(diagnostic('BUILDER-CAPSULE-005', 'Intake Capsule Builder Context schema identity does not match actual Builder Input.'));
  return { passed: diagnostics.length === 0, diagnostics };
}
