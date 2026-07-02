#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  PROTECTED_FIELD_DEFINITIONS,
  attachAndAssertCeToBuilderFieldPreservation,
  canonicalSha256,
  validateBuilderFieldPreservationManifest
} from './ce-builder-field-preservation-contract.mjs';

function sampleCePackage() {
  return {
    golden_reference_contract: { schema: 'sample-golden-reference@1.0.0', reference_id: 'ref-001', locked: true },
    build_intent_brief: { schema: 'sample-build-intent@1.0.0', intent: 'center anchored visual build' },
    spatial_lexicon_version_used: 'ev4-spatial-lexicon@1.0.0',
    visual_tolerance_policy: { schema: 'sample-visual-tolerance@1.0.0', allowed: ['minor_spacing_delta'] }
  };
}

const cePackage = sampleCePackage();
const builderPackage = {};
attachAndAssertCeToBuilderFieldPreservation(cePackage, builderPackage);

for (const fieldDef of PROTECTED_FIELD_DEFINITIONS) {
  assert.deepEqual(builderPackage[fieldDef.field], cePackage[fieldDef.field], `${fieldDef.field} must be copied exactly.`);
  const manifestField = builderPackage.ce_to_builder_field_preservation_manifest.fields.find((entry) => entry.field === fieldDef.field);
  assert.ok(manifestField, `${fieldDef.field} must appear in manifest.`);
  assert.equal(manifestField.source_sha256, canonicalSha256(cePackage[fieldDef.field]));
  assert.equal(manifestField.target_sha256, canonicalSha256(builderPackage[fieldDef.field]));
  assert.equal(manifestField.source_sha256, manifestField.target_sha256);
}

assert.deepEqual(validateBuilderFieldPreservationManifest(builderPackage), []);

const missing = sampleCePackage();
delete missing.golden_reference_contract;
assert.throws(() => attachAndAssertCeToBuilderFieldPreservation(missing, {}), /field preservation failed/);

const tampered = JSON.parse(JSON.stringify(builderPackage));
tampered.golden_reference_contract.locked = false;
assert.ok(validateBuilderFieldPreservationManifest(tampered).some((violation) => violation.code === 'PROTECTED_FIELD_HASH_MISMATCH'));

console.log('CE Builder field preservation validation passed.');
