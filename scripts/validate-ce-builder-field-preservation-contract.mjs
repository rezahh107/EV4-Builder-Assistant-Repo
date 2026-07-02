#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { normalizeCeBuilderExecutablePackage } from './normalize-ce-builder-executable-package.mjs';
import {
  FIELD_PRESERVATION_CONTRACT_NAME,
  PROTECTED_FIELD_DEFINITIONS,
  canonicalSha256,
  validateBuilderFieldPreservationManifest,
  validateTransformationExceptionEntry,
  validateTransformationExceptionsRegistry,
  verifyCeToBuilderFieldPreservation
} from './ce-builder-field-preservation-contract.mjs';

const ROOT = process.cwd();
const VALID_FIXTURE = path.join(ROOT, 'tests', 'valid', 'ce_builder_package_adapter_valid.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function minimalBuilderWithProtectedFields(cePackage) {
  return Object.fromEntries(PROTECTED_FIELD_DEFINITIONS.map((fieldDef) => [fieldDef.field, clone(cePackage[fieldDef.field])]));
}

function emptyExceptionRegistry(exceptions = []) {
  return {
    schema: 'ev4-ce-builder-field-preservation-exceptions@1.0.0',
    contract: FIELD_PRESERVATION_CONTRACT_NAME,
    version: '1.0.0',
    status: 'active',
    scope: 'synthetic test registry',
    exceptions
  };
}

function assertFailsWith(report, code, field = undefined) {
  assert.equal(report.result, 'fail');
  assert.ok(report.blocking, 'violation report must be blocking');
  assert.ok(
    report.violations.some((violation) => violation.code === code && (field === undefined || violation.field === field)),
    `Expected ${code}${field ? ` for ${field}` : ''}. Actual: ${JSON.stringify(report.violations, null, 2)}`
  );
}

const fixture = readJson(VALID_FIXTURE);
const cePackage = fixture.ce_builder_executable_package;
const ceBefore = JSON.stringify(cePackage);
const normalized = normalizeCeBuilderExecutablePackage(cePackage);

assert.equal(JSON.stringify(cePackage), ceBefore, 'preservation checker must not mutate CE payload.');
assert.equal(normalized.golden_reference_contract.reference_id, cePackage.golden_reference_contract.reference_id);
assert.deepEqual(normalized.build_intent_brief, cePackage.build_intent_brief);
assert.equal(normalized.spatial_lexicon_version_used, cePackage.spatial_lexicon_version_used);
assert.deepEqual(normalized.visual_tolerance_policy, cePackage.visual_tolerance_policy);
assert.equal(normalized.ce_to_builder_field_preservation_manifest.result, 'pass');
assert.equal(normalized.ce_to_builder_field_preservation_manifest.fields.length, 4);
assert.deepEqual(validateBuilderFieldPreservationManifest(normalized), []);

for (const fieldDef of PROTECTED_FIELD_DEFINITIONS) {
  const sourceHash = canonicalSha256(cePackage[fieldDef.field]);
  const manifestField = normalized.ce_to_builder_field_preservation_manifest.fields.find((entry) => entry.field === fieldDef.field);
  assert.equal(manifestField.source_sha256, sourceHash, `${fieldDef.field} source digest must match canonical source value.`);
  assert.equal(manifestField.target_sha256, sourceHash, `${fieldDef.field} target digest must match canonical source value.`);
}

for (const fieldDef of PROTECTED_FIELD_DEFINITIONS) {
  const builder = minimalBuilderWithProtectedFields(cePackage);
  delete builder[fieldDef.field];
  assertFailsWith(
    verifyCeToBuilderFieldPreservation(cePackage, builder, { exceptionsRegistry: emptyExceptionRegistry() }),
    'PROTECTED_FIELD_SILENTLY_OMITTED',
    fieldDef.field
  );
}

{
  const builder = minimalBuilderWithProtectedFields(cePackage);
  builder.golden_reference = builder.golden_reference_contract;
  delete builder.golden_reference_contract;
  assertFailsWith(
    verifyCeToBuilderFieldPreservation(cePackage, builder, { exceptionsRegistry: emptyExceptionRegistry() }),
    'PROTECTED_FIELD_SILENTLY_OMITTED',
    'golden_reference_contract'
  );
}

{
  const builder = minimalBuilderWithProtectedFields(cePackage);
  builder.build_intent_brief = { ...builder.build_intent_brief, injected_default: true };
  assertFailsWith(
    verifyCeToBuilderFieldPreservation(cePackage, builder, { exceptionsRegistry: emptyExceptionRegistry() }),
    'PROTECTED_FIELD_HASH_MISMATCH',
    'build_intent_brief'
  );
}

{
  const builder = minimalBuilderWithProtectedFields(cePackage);
  builder.spatial_lexicon_version_used = { version: builder.spatial_lexicon_version_used };
  assertFailsWith(
    verifyCeToBuilderFieldPreservation(cePackage, builder, { exceptionsRegistry: emptyExceptionRegistry() }),
    'PROTECTED_FIELD_TYPE_CHANGED',
    'spatial_lexicon_version_used'
  );
}

{
  const builder = minimalBuilderWithProtectedFields(cePackage);
  delete builder.visual_tolerance_policy;
  const declaredOmission = {
    exception_id: 'TEST_DECLARE_VISUAL_TOLERANCE_OMISSION',
    status: 'active',
    contract: FIELD_PRESERVATION_CONTRACT_NAME,
    source_path: '$.visual_tolerance_policy',
    target_path: null,
    field: 'visual_tolerance_policy',
    exception_type: 'declared_omission',
    justification: 'Synthetic test: prove declared omission registry behavior only.',
    owner: 'EV4-Builder-Assistant-Repo',
    introduced_in: 'test',
    expires_at: null,
    blocking: false,
    verification_rule: 'source digest recorded and omission explicitly declared',
    migration_note: 'Synthetic test entry; not stored in production registry.'
  };
  const report = verifyCeToBuilderFieldPreservation(cePackage, builder, { exceptionsRegistry: emptyExceptionRegistry([declaredOmission]) });
  assert.equal(report.result, 'pass');
  assert.equal(report.manifest.exceptions_applied[0], declaredOmission.exception_id);
}

{
  const builder = minimalBuilderWithProtectedFields(cePackage);
  builder.golden_reference_contract_v2 = builder.golden_reference_contract;
  delete builder.golden_reference_contract;
  const declaredRename = {
    exception_id: 'TEST_RENAME_GOLDEN_REFERENCE_CONTRACT',
    status: 'active',
    contract: FIELD_PRESERVATION_CONTRACT_NAME,
    source_path: '$.golden_reference_contract',
    target_path: '$.golden_reference_contract_v2',
    field: 'golden_reference_contract',
    exception_type: 'rename',
    justification: 'Synthetic test: prove rename exception requires exact digest preservation.',
    owner: 'EV4-Builder-Assistant-Repo',
    introduced_in: 'test',
    expires_at: null,
    blocking: false,
    verification_rule: 'renamed target digest must equal source digest',
    migration_note: 'Synthetic test entry; not stored in production registry.'
  };
  const report = verifyCeToBuilderFieldPreservation(cePackage, builder, { exceptionsRegistry: emptyExceptionRegistry([declaredRename]) });
  assert.equal(report.result, 'pass');
  assert.equal(report.manifest.exceptions_applied[0], declaredRename.exception_id);
}

{
  const invalidException = {
    exception_id: 'TEST_INVALID_NO_JUSTIFICATION',
    status: 'active',
    contract: FIELD_PRESERVATION_CONTRACT_NAME,
    source_path: '$.golden_reference_contract',
    target_path: null,
    field: 'golden_reference_contract',
    exception_type: 'declared_omission',
    justification: '',
    owner: 'EV4-Builder-Assistant-Repo',
    introduced_in: 'test',
    expires_at: null,
    blocking: false,
    verification_rule: 'source digest recorded',
    migration_note: 'Synthetic test entry.'
  };
  assert.ok(validateTransformationExceptionEntry(invalidException, 0).some((error) => error.includes('justification')));
  assert.ok(validateTransformationExceptionsRegistry(emptyExceptionRegistry([invalidException])).some((error) => error.includes('justification')));
}

{
  const expiredException = {
    exception_id: 'TEST_EXPIRED_OMISSION',
    status: 'active',
    contract: FIELD_PRESERVATION_CONTRACT_NAME,
    source_path: '$.golden_reference_contract',
    target_path: null,
    field: 'golden_reference_contract',
    exception_type: 'declared_omission',
    justification: 'Synthetic expired exception test.',
    owner: 'EV4-Builder-Assistant-Repo',
    introduced_in: 'test',
    expires_at: '2020-01-01',
    blocking: false,
    verification_rule: 'source digest recorded',
    migration_note: 'Synthetic test entry.'
  };
  const builder = minimalBuilderWithProtectedFields(cePackage);
  delete builder.golden_reference_contract;
  assertFailsWith(
    verifyCeToBuilderFieldPreservation(cePackage, builder, { exceptionsRegistry: emptyExceptionRegistry([expiredException]) }),
    'PROTECTED_FIELD_SILENTLY_OMITTED',
    'golden_reference_contract'
  );
}

{
  const nonMatchingException = {
    exception_id: 'TEST_NON_MATCHING_OMISSION',
    status: 'active',
    contract: FIELD_PRESERVATION_CONTRACT_NAME,
    source_path: '$.wrong_path',
    target_path: null,
    field: 'golden_reference_contract',
    exception_type: 'declared_omission',
    justification: 'Synthetic non-matching exception test.',
    owner: 'EV4-Builder-Assistant-Repo',
    introduced_in: 'test',
    expires_at: null,
    blocking: false,
    verification_rule: 'source digest recorded',
    migration_note: 'Synthetic test entry.'
  };
  const builder = minimalBuilderWithProtectedFields(cePackage);
  delete builder.golden_reference_contract;
  assertFailsWith(
    verifyCeToBuilderFieldPreservation(cePackage, builder, { exceptionsRegistry: emptyExceptionRegistry([nonMatchingException]) }),
    'PROTECTED_FIELD_SILENTLY_OMITTED',
    'golden_reference_contract'
  );
}

{
  for (const fieldDef of PROTECTED_FIELD_DEFINITIONS) {
    assert.ok(fieldDef.source_path.startsWith('$.'), `${fieldDef.field} must declare source path.`);
    assert.ok(fieldDef.target_path.startsWith('$.'), `${fieldDef.field} must declare target path.`);
    assert.equal(fieldDef.preservation_mode, 'preserve_exact');
    assert.equal(fieldDef.required_hash_check, true);
  }
}

console.log('CE→Builder field preservation contract validation passed.');
