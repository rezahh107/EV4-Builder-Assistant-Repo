#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VALID_FIXTURE = 'tests/valid/builder_responsive_handoff_provenance_valid.json';
const INVALID_FIXTURE = 'tests/invalid/builder_responsive_handoff_provenance_missing_visual_governance.invalid.json';
const HASH_RE = /^sha256:[a-fA-F0-9]{64}$/;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, location) {
  assert.ok(isObject(value), `${location} must be an object.`);
  return value;
}

function requireString(value, location) {
  assert.ok(typeof value === 'string' && value.trim().length > 0, `${location} must be a non-empty string.`);
}

function requireHash(value, location) {
  assert.ok(typeof value === 'string' && HASH_RE.test(value), `${location} must be a sha256:<64-hex> content hash.`);
}

function requireNonEmptyArray(value, location) {
  assert.ok(Array.isArray(value) && value.length > 0, `${location} must be a non-empty array.`);
  value.forEach((item, index) => requireString(item, `${location}[${index}]`));
}

function validateCarrier(doc) {
  requireObject(doc, 'payload');
  assert.equal(doc.schema, 'ev4-builder-responsive-handoff-provenance@1.0.0');
  assert.equal(doc.handoff_source, 'builder_output_and_build_evidence');
  requireString(doc.selected_candidate_id, 'selected_candidate_id');

  const builder = requireObject(doc.builder_provenance, 'builder_provenance');
  assert.equal(builder.builder_package_schema, 'ev4-builder-context-package@1.0.0');
  requireString(builder.builder_output_ref, 'builder_provenance.builder_output_ref');
  requireHash(builder.builder_input_authorization_digest, 'builder_provenance.builder_input_authorization_digest');
  requireNonEmptyArray(builder.build_evidence_refs, 'builder_provenance.build_evidence_refs');

  const ce = requireObject(doc.ce_provenance, 'ce_provenance');
  assert.equal(ce.ce_package_schema, 'ev4-builder-executable-package@1.0.0');
  requireString(ce.ce_package_ref, 'ce_provenance.ce_package_ref');
  assert.equal(ce.constructability_status, 'executable_ready');
  assert.equal(ce.builder_decisions_required, 0);
  assert.equal(ce.blocking_dependencies_count, 0);

  const visual = requireObject(doc.visual_governance_provenance, 'visual_governance_provenance');
  requireString(visual.golden_reference_contract_id, 'visual_governance_provenance.golden_reference_contract_id');
  requireHash(visual.golden_reference_contract_hash, 'visual_governance_provenance.golden_reference_contract_hash');
  requireString(visual.spatial_lexicon_version_used, 'visual_governance_provenance.spatial_lexicon_version_used');
  requireString(visual.visual_tolerance_policy_ref, 'visual_governance_provenance.visual_tolerance_policy_ref');
  requireString(visual.build_intent_brief_ref, 'visual_governance_provenance.build_intent_brief_ref');
  requireString(visual.reference_paradigm_lock_ref, 'visual_governance_provenance.reference_paradigm_lock_ref');
  requireString(visual.paradigm_to_structure_map_ref, 'visual_governance_provenance.paradigm_to_structure_map_ref');

  const claims = requireObject(doc.builder_validation_claims, 'builder_validation_claims');
  assert.equal(claims.builder_runtime_intake_authorized, true);
  assert.equal(claims.visual_reference_prerequisites_present, true);
  assert.equal(typeof claims.build_completed, 'boolean');
  assert.equal(typeof claims.live_render_validated, 'boolean');
  assert.equal(typeof claims.export_validated, 'boolean');
  assert.equal(claims.production_ready_allowed, false);
}

validateCarrier(readJson(VALID_FIXTURE));

let rejected = false;
try {
  validateCarrier(readJson(INVALID_FIXTURE));
} catch {
  rejected = true;
}
assert.ok(rejected, 'Invalid Builder→Responsive provenance fixture unexpectedly passed.');

console.log('Builder→Responsive handoff provenance checks passed.');
