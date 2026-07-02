import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const FIELD_PRESERVATION_CONTRACT_NAME = 'CE_TO_BUILDER_FIELD_PRESERVATION_CONTRACT';
export const FIELD_PRESERVATION_CONTRACT_VERSION = '1.0.0';
export const FIELD_PRESERVATION_GATE = 'ce_to_builder_field_preservation';
export const FIELD_PRESERVATION_GATE_VERSION = '1.0.0';
export const FIELD_PRESERVATION_EXCEPTIONS_PATH = path.resolve(
  __dirname,
  '..',
  'data',
  'ce-builder-field-preservation-exceptions.v1.json'
);

const DETERMINISTIC_EXPIRY_REFERENCE_DATE = '2026-07-02';

export const FIELD_PRESERVATION_VIOLATION_TAXONOMY = {
  PROTECTED_FIELD_MISSING_IN_CE_OUTPUT: {
    severity: 'blocker',
    blocking: true,
    meaning: 'A required protected field is absent from CE output.',
    likely_cause: 'CE emitted an incomplete Builder executable package.',
    remediation_hint: 'Make CE emit the protected field at the declared source path.',
    example_trigger: '$.golden_reference_contract is missing from CE output.'
  },
  PROTECTED_FIELD_MISSING_IN_BUILDER_INPUT: {
    severity: 'blocker',
    blocking: true,
    meaning: 'A protected field is absent from Builder input.',
    likely_cause: 'Adapter did not copy the protected field to the declared target path.',
    remediation_hint: 'Preserve the field in the adapter or declare a valid exception.',
    example_trigger: '$.build_intent_brief is missing from Builder input.'
  },
  PROTECTED_FIELD_SILENTLY_OMITTED: {
    severity: 'blocker',
    blocking: true,
    meaning: 'A protected field exists in CE output but is omitted from Builder input without an applicable exception.',
    likely_cause: 'Adapter dropped the field during projection.',
    remediation_hint: 'Copy the field exactly or add a justified transformation exception.',
    example_trigger: 'CE has $.visual_tolerance_policy and Builder output does not.'
  },
  PROTECTED_FIELD_HASH_MISMATCH: {
    severity: 'blocker',
    blocking: true,
    meaning: 'Source and target canonical SHA-256 digests differ.',
    likely_cause: 'Adapter transformed, truncated, defaulted, or rewrote a protected field.',
    remediation_hint: 'Preserve the exact value or declare and validate a semantic exception.',
    example_trigger: 'Builder $.golden_reference_contract has a different digest than CE $.golden_reference_contract.'
  },
  PROTECTED_FIELD_TYPE_CHANGED: {
    severity: 'blocker',
    blocking: true,
    meaning: 'Protected field JSON type changed across the boundary.',
    likely_cause: 'Adapter coerced a string/object/array/null value.',
    remediation_hint: 'Remove type coercion or declare an explicit exception with validation.',
    example_trigger: '$.spatial_lexicon_version_used changed from string to object.'
  },
  PROTECTED_FIELD_PATH_UNDECLARED: {
    severity: 'blocker',
    blocking: true,
    meaning: 'A protected field has no declared source or target path.',
    likely_cause: 'Contract definition is incomplete.',
    remediation_hint: 'Declare exact JSONPath-like source and target paths.',
    example_trigger: 'A protected field definition has an empty source_path.'
  },
  PROTECTED_FIELD_RENAMED_WITHOUT_EXCEPTION: {
    severity: 'blocker',
    blocking: true,
    meaning: 'A protected field appears under another target path without a valid rename exception.',
    likely_cause: 'Adapter renamed a protected field implicitly.',
    remediation_hint: 'Use the declared target path or add a valid rename exception.',
    example_trigger: '$.golden_reference_contract moved to $.golden_reference without exception.'
  },
  PROTECTED_FIELD_TRANSFORMED_WITHOUT_EXCEPTION: {
    severity: 'blocker',
    blocking: true,
    meaning: 'A protected field was structurally or semantically transformed without an applicable exception.',
    likely_cause: 'Adapter projected only part of the field or rewrote its value.',
    remediation_hint: 'Preserve exact value or add a versioned exception with a verification rule.',
    example_trigger: 'Builder receives a summarized build_intent_brief.'
  },
  TRANSFORMATION_EXCEPTION_MISSING: {
    severity: 'blocker',
    blocking: true,
    meaning: 'Non-exact preservation occurred but no exception applies.',
    likely_cause: 'Exception registry has no entry for the field/source/target behavior.',
    remediation_hint: 'Add a justified, versioned exception or preserve the field exactly.',
    example_trigger: 'Declared omission is attempted but no registry entry matches the source path.'
  },
  TRANSFORMATION_EXCEPTION_INVALID: {
    severity: 'blocker',
    blocking: true,
    meaning: 'An exception entry is malformed or unjustified.',
    likely_cause: 'Missing justification, owner, status, type, or verification rule.',
    remediation_hint: 'Fix the exception entry shape before relying on it.',
    example_trigger: 'Exception entry has an empty justification.'
  },
  TRANSFORMATION_EXCEPTION_EXPIRED: {
    severity: 'blocker',
    blocking: true,
    meaning: 'An otherwise matching exception has expired.',
    likely_cause: 'Temporary exception was not migrated before its expiry marker.',
    remediation_hint: 'Remove the exception, extend it with review, or preserve the field exactly.',
    example_trigger: 'expires_at is earlier than the deterministic gate reference date.'
  },
  CANONICALIZATION_FAILED: {
    severity: 'blocker',
    blocking: true,
    meaning: 'A protected value could not be deterministically serialized.',
    likely_cause: 'Unsupported value shape or undefined value reached hashing.',
    remediation_hint: 'Provide valid JSON data only.',
    example_trigger: 'A field resolves to undefined.'
  },
  PRESERVATION_MANIFEST_INVALID: {
    severity: 'blocker',
    blocking: true,
    meaning: 'The preservation manifest is missing, malformed, or inconsistent.',
    likely_cause: 'Adapter output was edited or generated without the gate.',
    remediation_hint: 'Run the CE→Builder adapter and keep the generated manifest intact.',
    example_trigger: 'Manifest field digest does not match the target field.'
  },
  ADAPTER_DROPPED_PROTECTED_FIELD: {
    severity: 'blocker',
    blocking: true,
    meaning: 'The adapter omitted a protected field from the Builder package.',
    likely_cause: 'Adapter projection list does not include the protected field.',
    remediation_hint: 'Copy protected fields before Builder execution is authorized.',
    example_trigger: 'normalizeCeBuilderExecutablePackage returns a package without $.build_intent_brief.'
  },
  INTERNAL_CONTRACT_DRIFT: {
    severity: 'blocker',
    blocking: true,
    meaning: 'Contract, manifest, registry, or adapter declarations disagree.',
    likely_cause: 'Field list or version-bearing metadata was updated in only one place.',
    remediation_hint: 'Update the contract, registry, code, docs, and tests together.',
    example_trigger: 'Manifest declares a contract version not matching the checker.'
  }
};

export const PROTECTED_FIELD_DEFINITIONS = [
  {
    field: 'golden_reference_contract',
    source_path: '$.golden_reference_contract',
    target_path: '$.golden_reference_contract',
    expected_type: 'object',
    required: true,
    preservation_mode: 'preserve_exact',
    required_hash_check: true,
    allowed_exception_reference: null,
    validation_rule: 'source and target canonical SHA-256 digests must match',
    failure_code: 'PROTECTED_FIELD_HASH_MISMATCH'
  },
  {
    field: 'build_intent_brief',
    source_path: '$.build_intent_brief',
    target_path: '$.build_intent_brief',
    expected_type: 'object',
    required: true,
    preservation_mode: 'preserve_exact',
    required_hash_check: true,
    allowed_exception_reference: null,
    validation_rule: 'source and target canonical SHA-256 digests must match',
    failure_code: 'PROTECTED_FIELD_HASH_MISMATCH'
  },
  {
    field: 'spatial_lexicon_version_used',
    source_path: '$.spatial_lexicon_version_used',
    target_path: '$.spatial_lexicon_version_used',
    expected_type: 'string',
    required: true,
    preservation_mode: 'preserve_exact',
    required_hash_check: true,
    allowed_exception_reference: null,
    validation_rule: 'source and target canonical SHA-256 digests must match',
    failure_code: 'PROTECTED_FIELD_HASH_MISMATCH'
  },
  {
    field: 'visual_tolerance_policy',
    source_path: '$.visual_tolerance_policy',
    target_path: '$.visual_tolerance_policy',
    expected_type: 'object',
    required: true,
    preservation_mode: 'preserve_exact',
    required_hash_check: true,
    allowed_exception_reference: null,
    validation_rule: 'source and target canonical SHA-256 digests must match',
    failure_code: 'PROTECTED_FIELD_HASH_MISMATCH'
  }
];

function jsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function canonicalJson(value) {
  if (value === undefined) throw new Error('Cannot canonicalize undefined.');
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function canonicalSha256(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

function resolveJsonPath(root, jsonPath) {
  if (typeof jsonPath !== 'string' || !jsonPath.startsWith('$.')) return { found: false, value: undefined };
  const parts = jsonPath.slice(2).split('.');
  let current = root;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || Array.isArray(current) || !(part in current)) {
      return { found: false, value: undefined };
    }
    current = current[part];
  }
  return { found: true, value: current };
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isExpired(expiresAt) {
  if (expiresAt === null || expiresAt === undefined) return false;
  if (!isNonEmptyString(expiresAt)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) return expiresAt <= DETERMINISTIC_EXPIRY_REFERENCE_DATE;
  return expiresAt <= FIELD_PRESERVATION_CONTRACT_VERSION;
}

export function readFieldPreservationExceptionsRegistry(registryPath = FIELD_PRESERVATION_EXCEPTIONS_PATH) {
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

export function validateTransformationExceptionEntry(entry, index = 0) {
  const errors = [];
  const allowedStatuses = new Set(['active', 'deprecated', 'rejected']);
  const allowedTypes = new Set(['rename', 'structural_transform', 'semantic_transform', 'declared_omission']);

  if (!isNonEmptyString(entry?.exception_id)) errors.push(`exceptions[${index}].exception_id must be a non-empty string.`);
  if (!allowedStatuses.has(entry?.status)) errors.push(`${entry?.exception_id || `exceptions[${index}]`} has invalid status.`);
  if (entry?.contract !== FIELD_PRESERVATION_CONTRACT_NAME) errors.push(`${entry?.exception_id || `exceptions[${index}]`} must reference ${FIELD_PRESERVATION_CONTRACT_NAME}.`);
  if (!isNonEmptyString(entry?.source_path)) errors.push(`${entry?.exception_id || `exceptions[${index}]`}.source_path must be present.`);
  if (!(entry?.target_path === null || isNonEmptyString(entry?.target_path))) errors.push(`${entry?.exception_id || `exceptions[${index}]`}.target_path must be a string or null.`);
  if (!isNonEmptyString(entry?.field)) errors.push(`${entry?.exception_id || `exceptions[${index}]`}.field must be present.`);
  if (!allowedTypes.has(entry?.exception_type)) errors.push(`${entry?.exception_id || `exceptions[${index}]`} has invalid exception_type.`);
  if (!isNonEmptyString(entry?.justification)) errors.push(`${entry?.exception_id || `exceptions[${index}]`}.justification must be present.`);
  if (!isNonEmptyString(entry?.owner)) errors.push(`${entry?.exception_id || `exceptions[${index}]`}.owner must be present.`);
  if (!isNonEmptyString(entry?.introduced_in)) errors.push(`${entry?.exception_id || `exceptions[${index}]`}.introduced_in must be present.`);
  if (typeof entry?.blocking !== 'boolean') errors.push(`${entry?.exception_id || `exceptions[${index}]`}.blocking must be boolean.`);
  if (!isNonEmptyString(entry?.verification_rule)) errors.push(`${entry?.exception_id || `exceptions[${index}]`}.verification_rule must be present.`);
  if (!isNonEmptyString(entry?.migration_note)) errors.push(`${entry?.exception_id || `exceptions[${index}]`}.migration_note must be present.`);
  if (isExpired(entry?.expires_at)) errors.push(`${entry?.exception_id || `exceptions[${index}]`} is expired.`);
  if (entry?.status !== 'active') errors.push(`${entry?.exception_id || `exceptions[${index}]`} must be active to apply.`);

  return errors;
}

export function validateTransformationExceptionsRegistry(registry) {
  const errors = [];
  if (registry?.schema !== 'ev4-ce-builder-field-preservation-exceptions@1.0.0') errors.push('Exception registry schema must be ev4-ce-builder-field-preservation-exceptions@1.0.0.');
  if (registry?.contract !== FIELD_PRESERVATION_CONTRACT_NAME) errors.push(`Exception registry must reference ${FIELD_PRESERVATION_CONTRACT_NAME}.`);
  if (registry?.version !== FIELD_PRESERVATION_CONTRACT_VERSION) errors.push(`Exception registry version must be ${FIELD_PRESERVATION_CONTRACT_VERSION}.`);
  if (registry?.status !== 'active') errors.push('Exception registry status must be active.');
  if (!Array.isArray(registry?.exceptions)) errors.push('Exception registry exceptions must be an array.');
  (registry?.exceptions || []).forEach((entry, index) => errors.push(...validateTransformationExceptionEntry(entry, index)));
  return errors;
}

function violation(code, fieldDef, overrides = {}) {
  const taxonomy = FIELD_PRESERVATION_VIOLATION_TAXONOMY[code] || FIELD_PRESERVATION_VIOLATION_TAXONOMY.INTERNAL_CONTRACT_DRIFT;
  return {
    code,
    severity: taxonomy.severity,
    blocking: taxonomy.blocking,
    field: fieldDef?.field || null,
    source_path: fieldDef?.source_path || null,
    target_path: fieldDef?.target_path || null,
    message: taxonomy.meaning,
    expected: overrides.expected || 'field present with matching SHA-256 digest',
    actual: overrides.actual || null,
    source_sha256: overrides.source_sha256 ?? null,
    target_sha256: overrides.target_sha256 ?? null,
    exception_id: overrides.exception_id ?? null,
    remediation_hint: overrides.remediation_hint || taxonomy.remediation_hint
  };
}

function matchingExceptions(fieldDef, registry, type) {
  return (registry?.exceptions || []).filter((entry) => (
    entry.field === fieldDef.field &&
    entry.contract === FIELD_PRESERVATION_CONTRACT_NAME &&
    entry.source_path === fieldDef.source_path &&
    entry.exception_type === type
  ));
}

function validExceptionOrViolation(fieldDef, registry, type, targetPath = undefined) {
  const candidates = matchingExceptions(fieldDef, registry, type)
    .filter((entry) => targetPath === undefined || entry.target_path === targetPath);
  if (candidates.length === 0) return { exception: null, violationCode: 'TRANSFORMATION_EXCEPTION_MISSING' };
  const entry = candidates[0];
  const errors = validateTransformationExceptionEntry(entry, 0);
  if (errors.some((message) => message.includes('expired'))) return { exception: entry, violationCode: 'TRANSFORMATION_EXCEPTION_EXPIRED', errors };
  if (errors.length > 0) return { exception: entry, violationCode: 'TRANSFORMATION_EXCEPTION_INVALID', errors };
  if (entry.blocking) return { exception: entry, violationCode: 'TRANSFORMATION_EXCEPTION_INVALID', errors: ['Blocking exception cannot allow Builder execution.'] };
  return { exception: entry, violationCode: null, errors: [] };
}

function assertContractShape() {
  const seen = new Set();
  for (const fieldDef of PROTECTED_FIELD_DEFINITIONS) {
    if (seen.has(fieldDef.field)) throw new Error(`Duplicate protected field definition: ${fieldDef.field}`);
    seen.add(fieldDef.field);
    if (!isNonEmptyString(fieldDef.source_path) || !isNonEmptyString(fieldDef.target_path)) {
      throw new Error(`Protected field ${fieldDef.field} must declare source and target paths.`);
    }
    if (fieldDef.preservation_mode !== 'preserve_exact') throw new Error(`Protected field ${fieldDef.field} must default to preserve_exact.`);
    if (fieldDef.required_hash_check !== true) throw new Error(`Protected field ${fieldDef.field} must require hash checking.`);
  }
}

export function verifyCeToBuilderFieldPreservation(cePackage, builderPackage, options = {}) {
  assertContractShape();
  const registry = options.exceptionsRegistry || readFieldPreservationExceptionsRegistry();
  const registryErrors = validateTransformationExceptionsRegistry(registry);
  const violations = [];
  for (const error of registryErrors) {
    violations.push(violation('TRANSFORMATION_EXCEPTION_INVALID', { field: null, source_path: null, target_path: null }, { actual: error, expected: 'valid transformation exception registry' }));
  }

  const fields = [];
  const exceptionsApplied = [];

  for (const fieldDef of PROTECTED_FIELD_DEFINITIONS) {
    const source = resolveJsonPath(cePackage, fieldDef.source_path);
    if (!source.found) {
      violations.push(violation('PROTECTED_FIELD_MISSING_IN_CE_OUTPUT', fieldDef, { actual: 'source field missing' }));
      continue;
    }

    let sourceSha;
    try {
      sourceSha = canonicalSha256(source.value);
    } catch (error) {
      violations.push(violation('CANONICALIZATION_FAILED', fieldDef, { actual: error.message }));
      continue;
    }

    if (jsonType(source.value) !== fieldDef.expected_type) {
      violations.push(violation('PROTECTED_FIELD_TYPE_CHANGED', fieldDef, { actual: `source type ${jsonType(source.value)}`, expected: `source type ${fieldDef.expected_type}`, source_sha256: sourceSha }));
      continue;
    }

    const target = resolveJsonPath(builderPackage, fieldDef.target_path);
    if (!target.found) {
      const renameCandidate = (registry?.exceptions || []).find((entry) => entry.field === fieldDef.field && entry.source_path === fieldDef.source_path && entry.exception_type === 'rename');
      if (renameCandidate) {
        const { exception, violationCode, errors } = validExceptionOrViolation(fieldDef, registry, 'rename', renameCandidate.target_path);
        if (violationCode) {
          violations.push(violation(violationCode, fieldDef, { actual: errors?.join('; ') || 'invalid rename exception', source_sha256: sourceSha, exception_id: exception?.exception_id || null }));
          continue;
        }
        const renamedTarget = resolveJsonPath(builderPackage, exception.target_path);
        if (!renamedTarget.found) {
          violations.push(violation('PROTECTED_FIELD_MISSING_IN_BUILDER_INPUT', fieldDef, { actual: `rename target ${exception.target_path} missing`, source_sha256: sourceSha, exception_id: exception.exception_id }));
          continue;
        }
        const renamedTargetSha = canonicalSha256(renamedTarget.value);
        if (renamedTargetSha !== sourceSha) {
          violations.push(violation('PROTECTED_FIELD_HASH_MISMATCH', fieldDef, { actual: 'renamed target digest mismatch', source_sha256: sourceSha, target_sha256: renamedTargetSha, exception_id: exception.exception_id }));
          continue;
        }
        fields.push({ field: fieldDef.field, source_path: fieldDef.source_path, target_path: exception.target_path, preservation_mode: 'preserve_semantic', source_sha256: sourceSha, target_sha256: renamedTargetSha, result: 'pass', exception_id: exception.exception_id });
        exceptionsApplied.push(exception.exception_id);
        continue;
      }

      const { exception, violationCode, errors } = validExceptionOrViolation(fieldDef, registry, 'declared_omission', null);
      if (!violationCode && exception) {
        fields.push({ field: fieldDef.field, source_path: fieldDef.source_path, target_path: null, preservation_mode: 'declared_omission', source_sha256: sourceSha, target_sha256: null, result: 'pass', exception_id: exception.exception_id });
        exceptionsApplied.push(exception.exception_id);
        continue;
      }

      violations.push(violation('PROTECTED_FIELD_SILENTLY_OMITTED', fieldDef, { actual: errors?.join('; ') || 'field missing from Builder input', source_sha256: sourceSha, exception_id: exception?.exception_id || null }));
      continue;
    }

    let targetSha;
    try {
      targetSha = canonicalSha256(target.value);
    } catch (error) {
      violations.push(violation('CANONICALIZATION_FAILED', fieldDef, { actual: error.message, source_sha256: sourceSha }));
      continue;
    }

    if (jsonType(target.value) !== fieldDef.expected_type) {
      violations.push(violation('PROTECTED_FIELD_TYPE_CHANGED', fieldDef, { actual: `target type ${jsonType(target.value)}`, expected: `target type ${fieldDef.expected_type}`, source_sha256: sourceSha, target_sha256: targetSha }));
      continue;
    }

    if (sourceSha !== targetSha) {
      violations.push(violation('PROTECTED_FIELD_HASH_MISMATCH', fieldDef, { actual: 'source and target digests differ', source_sha256: sourceSha, target_sha256: targetSha }));
      continue;
    }

    fields.push({ field: fieldDef.field, source_path: fieldDef.source_path, target_path: fieldDef.target_path, preservation_mode: fieldDef.preservation_mode, source_sha256: sourceSha, target_sha256: targetSha, result: 'pass', exception_id: null });
  }

  const result = violations.length === 0 ? 'pass' : 'fail';
  const manifest = {
    schema: 'ev4-ce-builder-field-preservation-manifest@1.0.0',
    contract: FIELD_PRESERVATION_CONTRACT_NAME,
    contract_version: FIELD_PRESERVATION_CONTRACT_VERSION,
    gate: FIELD_PRESERVATION_GATE,
    gate_version: FIELD_PRESERVATION_GATE_VERSION,
    result,
    algorithm: 'sha256',
    canonicalization: 'stable-json-object-keys-arrays-ordered-no-type-coercion',
    fields,
    exceptions_applied: [...new Set(exceptionsApplied)]
  };

  return {
    gate: FIELD_PRESERVATION_GATE,
    gate_version: FIELD_PRESERVATION_GATE_VERSION,
    result,
    blocking: violations.some((entry) => entry.blocking),
    contract: FIELD_PRESERVATION_CONTRACT_NAME,
    manifest,
    violations
  };
}

export function assertCeToBuilderFieldPreservation(cePackage, builderPackage, options = {}) {
  const report = verifyCeToBuilderFieldPreservation(cePackage, builderPackage, options);
  if (report.result !== 'pass') {
    const error = new Error(JSON.stringify({
      gate: report.gate,
      gate_version: report.gate_version,
      result: report.result,
      blocking: report.blocking,
      contract: report.contract,
      violations: report.violations
    }, null, 2));
    error.report = report;
    throw error;
  }
  return report;
}

export function attachAndAssertCeToBuilderFieldPreservation(cePackage, builderPackage, options = {}) {
  for (const fieldDef of PROTECTED_FIELD_DEFINITIONS) {
    const source = resolveJsonPath(cePackage, fieldDef.source_path);
    if (source.found) builderPackage[fieldDef.field] = deepClone(source.value);
  }
  const report = assertCeToBuilderFieldPreservation(cePackage, builderPackage, options);
  builderPackage.ce_to_builder_field_preservation_manifest = report.manifest;
  return builderPackage;
}

export function validateBuilderFieldPreservationManifest(builderPackage) {
  const manifest = builderPackage?.ce_to_builder_field_preservation_manifest;
  if (!manifest) return [violation('PRESERVATION_MANIFEST_INVALID', { field: null, source_path: null, target_path: null }, { actual: 'manifest missing', expected: 'manifest present' })];
  const violations = [];
  if (manifest.contract !== FIELD_PRESERVATION_CONTRACT_NAME || manifest.contract_version !== FIELD_PRESERVATION_CONTRACT_VERSION) {
    violations.push(violation('INTERNAL_CONTRACT_DRIFT', { field: null, source_path: null, target_path: null }, { actual: 'manifest contract/version mismatch' }));
  }
  if (manifest.result !== 'pass') {
    violations.push(violation('PRESERVATION_MANIFEST_INVALID', { field: null, source_path: null, target_path: null }, { actual: `manifest result ${manifest.result}` }));
  }
  const fields = new Map((manifest.fields || []).map((entry) => [entry.field, entry]));
  for (const fieldDef of PROTECTED_FIELD_DEFINITIONS) {
    const entry = fields.get(fieldDef.field);
    if (!entry) {
      violations.push(violation('PRESERVATION_MANIFEST_INVALID', fieldDef, { actual: 'field missing from manifest' }));
      continue;
    }
    const target = resolveJsonPath(builderPackage, entry.target_path || fieldDef.target_path);
    if (entry.preservation_mode !== 'declared_omission') {
      if (!target.found) {
        violations.push(violation('PROTECTED_FIELD_MISSING_IN_BUILDER_INPUT', fieldDef, { actual: 'manifest target path missing' }));
        continue;
      }
      const targetSha = canonicalSha256(target.value);
      if (targetSha !== entry.target_sha256 || entry.source_sha256 !== entry.target_sha256) {
        violations.push(violation('PRESERVATION_MANIFEST_INVALID', fieldDef, { actual: 'manifest digest does not match target field', source_sha256: entry.source_sha256, target_sha256: targetSha }));
      }
    }
  }
  return violations;
}
