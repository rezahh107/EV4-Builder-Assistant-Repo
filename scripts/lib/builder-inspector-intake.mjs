import crypto from 'node:crypto';
import {
  BUILDER_CONTEXT_SCHEMA_ID, BUILDER_INSPECTOR_ID, computePackageDigest, sha256Bytes
} from './builder-package-identity.mjs';
import {
  diagnostic, exactFileSha, gitHead, readBuffer, readJson, run, schemaValidation, writeAtomic
} from './builder-inspector-common.mjs';

export const INTAKE_SCHEMA = 'ev4-builder-intake-authorization@1.0.0';
export const VALIDATION_PROFILE = 'personal_correctness';

export function validateBuilderInputFile(inputPath) {
  const diagnostics = [];
  let inputBytes;
  let pkg;
  try { inputBytes = readBuffer(inputPath); }
  catch (error) { return { ok: false, diagnostics: [diagnostic('BINS-INTAKE-001', `Cannot read input: ${error.message}`, inputPath, 'Provide standalone builder-input.json.')], inputBytes: null, pkg: null }; }
  try { pkg = JSON.parse(inputBytes.toString('utf8')); }
  catch (error) { return { ok: false, diagnostics: [diagnostic('BINS-INTAKE-002', `Invalid JSON: ${error.message}`, inputPath, 'Regenerate through Project Gate.')], inputBytes, pkg: null }; }

  if (pkg?.schema !== BUILDER_CONTEXT_SCHEMA_ID) {
    let code = 'BINS-INTAKE-003';
    let message = `Expected ${BUILDER_CONTEXT_SCHEMA_ID}; received ${pkg?.schema ?? '<missing>'}.`;
    if (pkg?.schema_version && !pkg?.schema) { code = 'BINS-INTAKE-004'; message = 'Receipt-only input is not Builder semantic input.'; }
    else if (pkg?.result || pkg?.downstream_artifact || pkg?.final_stage_bundle) { code = 'BINS-INTAKE-005'; message = 'Raw Project Gate or CE envelopes are not accepted; manual extraction is forbidden.'; }
    return { ok: false, diagnostics: [diagnostic(code, message, '$.schema', 'Provide Project Gate standalone builder-input.json.')], inputBytes, pkg };
  }

  const checks = [
    schemaValidation('schemas/builder-context-package.schema.json', inputPath),
    run(process.execPath, ['scripts/validate-package.mjs', inputPath], 'Builder semantic/cross-field validation', 'BINS-INTAKE-006'),
    run(process.execPath, ['scripts/validate-builder-context-decision-lineage.mjs', inputPath], 'Builder decision-lineage validation', 'BINS-INTAKE-007')
  ];
  for (const check of checks) if (!check.ok) diagnostics.push(...check.diagnostics);
  return { ok: diagnostics.length === 0, diagnostics, inputBytes, pkg };
}

function capsuleBase(validation, sessionId) {
  return {
    schema: INTAKE_SCHEMA,
    validation_profile: VALIDATION_PROFILE,
    validator_version: BUILDER_INSPECTOR_ID,
    session_id: sessionId,
    source_file_sha256: validation.inputBytes ? sha256Bytes(validation.inputBytes) : null,
    canonical_package_digest: validation.pkg ? computePackageDigest(validation.pkg) : null,
    builder_context_schema: validation.pkg?.schema ?? null,
    selected_candidate_id: validation.pkg?.selected_candidate_id ?? null,
    builder_repository_commit: gitHead()
  };
}

export function buildIntakeResult(validation, sessionId) {
  if (!validation.ok) return { ...capsuleBase(validation, sessionId), status: 'blocked', authorization_basis: 'official_validators_failed', blocking_diagnostics: validation.diagnostics, warnings: [] };
  return {
    ...capsuleBase(validation, sessionId),
    status: 'accepted',
    authorization_basis: validation.pkg.input_authorization ? 'verified_embedded_input_authorization' : 'derived_by_official_validators',
    blocking_diagnostics: [],
    warnings: validation.pkg.input_authorization ? [] : ['input_authorization was absent; this Inspector capsule is the sole personal-path authorization carrier.']
  };
}

export function createIntake(inputPath, outputPath, options = {}) {
  const sessionId = options.sessionId || `BSESSION-${crypto.randomUUID()}`;
  const validation = validateBuilderInputFile(inputPath);
  const result = buildIntakeResult(validation, sessionId);
  writeAtomic(outputPath, result, { replace: options.replace, forbiddenSources: [inputPath] });
  return { ok: validation.ok, diagnostics: validation.diagnostics, result };
}

export function validateIntakeCapsule(inputPath, capsulePath) {
  const validation = validateBuilderInputFile(inputPath);
  const diagnostics = [...validation.diagnostics];
  let capsule;
  try { capsule = readJson(capsulePath); }
  catch (error) { return { ok: false, diagnostics: [...diagnostics, diagnostic('BINS-CAPSULE-001', `Cannot read capsule: ${error.message}`, capsulePath, 'Run intake again.')], validation, capsule: null }; }

  const schemaCheck = schemaValidation('schemas/builder-intake-authorization.schema.json', capsulePath);
  if (!schemaCheck.ok) diagnostics.push(...schemaCheck.diagnostics);
  if (capsule.status !== 'accepted') diagnostics.push(diagnostic('BINS-CAPSULE-002', 'Intake capsule is not accepted.', '$.status', 'Correct input and regenerate.'));
  if (capsule.validator_version !== BUILDER_INSPECTOR_ID) diagnostics.push(diagnostic('BINS-CAPSULE-003', 'Unsupported Inspector identity.', '$.validator_version', 'Regenerate with current repository.'));
  if (capsule.validation_profile !== VALIDATION_PROFILE) diagnostics.push(diagnostic('BINS-CAPSULE-004', 'Unsupported validation profile.', '$.validation_profile', 'Use personal_correctness.'));
  if (validation.inputBytes && capsule.source_file_sha256 !== sha256Bytes(validation.inputBytes)) diagnostics.push(diagnostic('BINS-CAPSULE-005', 'Exact source-byte hash mismatch.', '$.source_file_sha256', 'Regenerate from current bytes.'));
  if (validation.pkg) {
    if (capsule.canonical_package_digest !== computePackageDigest(validation.pkg)) diagnostics.push(diagnostic('BINS-CAPSULE-006', 'Canonical package digest mismatch.', '$.canonical_package_digest', 'Regenerate capsule.'));
    if (capsule.selected_candidate_id !== validation.pkg.selected_candidate_id) diagnostics.push(diagnostic('BINS-CAPSULE-007', 'Selected candidate mismatch.', '$.selected_candidate_id', 'Use matching capsule.'));
    if (capsule.builder_context_schema !== validation.pkg.schema) diagnostics.push(diagnostic('BINS-CAPSULE-008', 'Builder Context Schema mismatch.', '$.builder_context_schema', 'Regenerate capsule.'));
  }
  if (!capsule.session_id) diagnostics.push(diagnostic('BINS-CAPSULE-009', 'Accepted capsule requires session_id.', '$.session_id', 'Regenerate capsule.'));
  return { ok: diagnostics.length === 0, diagnostics, validation, capsule, capsule_sha256: exactFileSha(capsulePath) };
}
