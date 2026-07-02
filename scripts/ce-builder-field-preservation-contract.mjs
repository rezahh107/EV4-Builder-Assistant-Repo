import crypto from 'node:crypto';

export const FIELD_PRESERVATION_CONTRACT_NAME = 'CE_TO_BUILDER_FIELD_PRESERVATION_CONTRACT';
export const FIELD_PRESERVATION_CONTRACT_VERSION = '1.0.0';
export const FIELD_PRESERVATION_GATE = 'ce_to_builder_field_preservation';
export const FIELD_PRESERVATION_GATE_VERSION = '1.0.0';
export const FIELD_PRESERVATION_MANIFEST_SCHEMA = 'ev4-ce-builder-field-preservation-manifest@1.0.0';
export const FIELD_PRESERVATION_CANONICALIZATION = 'stable-json-object-keys-arrays-ordered-no-type-coercion';

export const PROTECTED_FIELD_DEFINITIONS = Object.freeze([
  { field: 'golden_reference_contract', source_path: '$.golden_reference_contract', target_path: '$.golden_reference_contract', type: 'object' },
  { field: 'build_intent_brief', source_path: '$.build_intent_brief', target_path: '$.build_intent_brief', type: 'object' },
  { field: 'spatial_lexicon_version_used', source_path: '$.spatial_lexicon_version_used', target_path: '$.spatial_lexicon_version_used', type: 'string' },
  { field: 'visual_tolerance_policy', source_path: '$.visual_tolerance_policy', target_path: '$.visual_tolerance_policy', type: 'object' }
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isPlainObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function canonicalSha256(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')}`;
}

function typeOf(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function validateProtectedValue(value, fieldDef, side) {
  if (value === undefined) return `${side} protected field missing: ${fieldDef.field}`;
  if (fieldDef.type === 'object' && !isPlainObject(value)) return `${side} protected field ${fieldDef.field} must be object, got ${typeOf(value)}`;
  if (fieldDef.type === 'string' && (typeof value !== 'string' || value.length === 0)) return `${side} protected field ${fieldDef.field} must be non-empty string`;
  return null;
}

export function buildFieldPreservationManifest(cePackage, builderPackage) {
  const fields = [];
  const violations = [];

  for (const fieldDef of PROTECTED_FIELD_DEFINITIONS) {
    const sourceValue = cePackage?.[fieldDef.field];
    const targetValue = builderPackage?.[fieldDef.field];
    const sourceViolation = validateProtectedValue(sourceValue, fieldDef, 'CE source');
    const targetViolation = validateProtectedValue(targetValue, fieldDef, 'Builder target');
    if (sourceViolation) violations.push({ code: 'PROTECTED_FIELD_MISSING_IN_CE_OUTPUT', field: fieldDef.field, message: sourceViolation });
    if (targetViolation) violations.push({ code: 'PROTECTED_FIELD_MISSING_IN_BUILDER_INPUT', field: fieldDef.field, message: targetViolation });
    if (sourceViolation || targetViolation) continue;

    const sourceSha256 = canonicalSha256(sourceValue);
    const targetSha256 = canonicalSha256(targetValue);
    if (sourceSha256 !== targetSha256) violations.push({ code: 'PROTECTED_FIELD_HASH_MISMATCH', field: fieldDef.field, message: `${fieldDef.field} changed across CE to Builder boundary.` });

    fields.push({
      field: fieldDef.field,
      source_path: fieldDef.source_path,
      target_path: fieldDef.target_path,
      preservation_mode: 'preserve_exact',
      source_sha256: sourceSha256,
      target_sha256: targetSha256,
      result: sourceSha256 === targetSha256 ? 'pass' : 'fail',
      exception_id: null
    });
  }

  return {
    manifest: {
      schema: FIELD_PRESERVATION_MANIFEST_SCHEMA,
      contract: FIELD_PRESERVATION_CONTRACT_NAME,
      contract_version: FIELD_PRESERVATION_CONTRACT_VERSION,
      gate: FIELD_PRESERVATION_GATE,
      gate_version: FIELD_PRESERVATION_GATE_VERSION,
      result: violations.length === 0 ? 'pass' : 'fail',
      algorithm: 'sha256',
      canonicalization: FIELD_PRESERVATION_CANONICALIZATION,
      fields,
      exceptions_applied: []
    },
    violations
  };
}

export function validateBuilderFieldPreservationManifest(builderPackage) {
  const manifest = builderPackage?.ce_to_builder_field_preservation_manifest;
  const violations = [];
  if (!isPlainObject(manifest)) return [{ code: 'PRESERVATION_MANIFEST_INVALID', message: 'Missing preservation manifest.' }];
  if (manifest.schema !== FIELD_PRESERVATION_MANIFEST_SCHEMA) violations.push({ code: 'PRESERVATION_MANIFEST_INVALID', message: 'Invalid preservation manifest schema.' });
  if (manifest.contract !== FIELD_PRESERVATION_CONTRACT_NAME) violations.push({ code: 'PRESERVATION_MANIFEST_INVALID', message: 'Invalid preservation contract.' });
  if (manifest.result !== 'pass') violations.push({ code: 'PRESERVATION_MANIFEST_INVALID', message: 'Preservation manifest must pass.' });
  if (!Array.isArray(manifest.fields) || manifest.fields.length !== PROTECTED_FIELD_DEFINITIONS.length) violations.push({ code: 'PRESERVATION_MANIFEST_INVALID', message: 'Preservation manifest must contain all protected fields.' });

  for (const fieldDef of PROTECTED_FIELD_DEFINITIONS) {
    const entry = Array.isArray(manifest.fields) ? manifest.fields.find((item) => item.field === fieldDef.field) : null;
    if (!entry) {
      violations.push({ code: 'PRESERVATION_MANIFEST_INVALID', field: fieldDef.field, message: 'Missing manifest field entry.' });
      continue;
    }
    const digest = canonicalSha256(builderPackage[fieldDef.field]);
    if (entry.source_path !== fieldDef.source_path || entry.target_path !== fieldDef.target_path) violations.push({ code: 'PRESERVATION_MANIFEST_INVALID', field: fieldDef.field, message: 'Manifest path mismatch.' });
    if (entry.preservation_mode !== 'preserve_exact') violations.push({ code: 'PRESERVATION_MANIFEST_INVALID', field: fieldDef.field, message: 'Protected fields must preserve_exact.' });
    if (entry.source_sha256 !== digest || entry.target_sha256 !== digest) violations.push({ code: 'PROTECTED_FIELD_HASH_MISMATCH', field: fieldDef.field, message: 'Manifest digest does not match Builder field.' });
    if (entry.result !== 'pass') violations.push({ code: 'PRESERVATION_MANIFEST_INVALID', field: fieldDef.field, message: 'Manifest entry must pass.' });
  }
  return violations;
}

export class CeToBuilderFieldPreservationError extends Error {
  constructor(violations) {
    super(`CE to Builder field preservation failed: ${violations.map((item) => item.code).join(', ')}`);
    this.name = 'CeToBuilderFieldPreservationError';
    this.violations = violations;
  }
}

export function attachAndAssertCeToBuilderFieldPreservation(cePackage, builderPackage) {
  for (const fieldDef of PROTECTED_FIELD_DEFINITIONS) builderPackage[fieldDef.field] = JSON.parse(JSON.stringify(cePackage[fieldDef.field]));
  const { manifest, violations } = buildFieldPreservationManifest(cePackage, builderPackage);
  if (violations.length > 0) throw new CeToBuilderFieldPreservationError(violations);
  builderPackage.ce_to_builder_field_preservation_manifest = manifest;
  return builderPackage;
}
