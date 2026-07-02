#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  CE_BUILDER_TRANSFORMATION_REGISTRY_PATH,
  readCeBuilderTransformationRegistry
} from './ce-builder-transformation-registry.mjs';
import {
  buildCeReferenceCarrierIr,
  CE_REFERENCE_MAP_TRANSFORM_IDS,
  normalizeCeReferenceCarrier
} from './normalize-ce-reference-map.mjs';
import { CE_BUILDER_PACKAGE_TRANSFORM_IDS } from './normalize-ce-builder-executable-package.mjs';

const ROOT = process.cwd();
const VALID_REFERENCE_FIXTURE = path.join(ROOT, 'tests', 'valid', 'ce_reference_map_adapter_valid.json');
const ALLOWED_OPERATIONS = new Set([
  'copy_trimmed_string',
  'preserve_in_ir_only',
  'derive_region_label_strings',
  'derive_center_primary_anchor_region_label',
  'derive_repeated_unit_children_summary',
  'compact_node_model_string',
  'derive_builder_requirement_flags',
  'derive_left_right_counts',
  'derive_structured_first_batch_intent',
  'constant',
  'gated_status_projection',
  'copy_after_identity_preservation_checks',
  'derive_source_payload_ledger',
  'copy_required_builder_payload_carriers',
  'normalize_first_safe_builder_batch',
  'flatten_declared_action_parameters',
  'copy_confirmation_ids_attach_trusted_template',
  'attach_visual_reference_carriers_after_reference_map_normalization',
  'preserve_exact_with_sha256_manifest',
  'compute_sha256_authorization_digest'
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireStringArray(value, location) {
  assert.ok(Array.isArray(value), `${location} must be an array.`);
  for (const item of value) assert.ok(isNonEmptyString(item), `${location} entries must be non-empty strings.`);
}

function sameMembers(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

function requireMappingShape(mapping, index) {
  assert.ok(isNonEmptyString(mapping.id), `mappings[${index}].id must be present.`);
  assert.ok(['reference_map', 'builder_package'].includes(mapping.category), `${mapping.id} has invalid category.`);
  requireStringArray(mapping.source_paths, `${mapping.id}.source_paths`);
  requireStringArray(mapping.ir_paths, `${mapping.id}.ir_paths`);
  requireStringArray(mapping.builder_paths, `${mapping.id}.builder_paths`);
  assert.ok(isNonEmptyString(mapping.operation), `${mapping.id}.operation must be present.`);
  assert.ok(ALLOWED_OPERATIONS.has(mapping.operation), `${mapping.id}.operation is not allowed: ${mapping.operation}`);
  assert.ok(isNonEmptyString(mapping.loss_policy), `${mapping.id}.loss_policy must be present.`);
  assert.notEqual(mapping.loss_policy, 'implicit', `${mapping.id}.loss_policy must not be implicit.`);
  assert.ok(isNonEmptyString(mapping.data_loss), `${mapping.id}.data_loss must explicitly describe behavior.`);
  assert.ok(isNonEmptyString(mapping.implemented_by), `${mapping.id}.implemented_by must be present.`);
  requireStringArray(mapping.validation, `${mapping.id}.validation`);

  if (mapping.operation === 'compact_node_model_string') {
    assert.equal(mapping.delimiter, ':', `${mapping.id} must use ':' delimiter.`);
    assert.equal(mapping.format, 'node:model', `${mapping.id} must declare node:model format.`);
    assert.deepEqual(
      mapping.source_paths,
      [
        'ce.paradigm_to_structure_map.connector_layer.node',
        'ce.paradigm_to_structure_map.connector_layer.model'
      ],
      `${mapping.id} must declare node and model source paths.`
    );
    assert.deepEqual(mapping.builder_paths, ['builder.paradigm_to_structure_map.connector_layer']);
  }

  if (mapping.operation === 'preserve_exact_with_sha256_manifest') {
    assert.deepEqual(
      mapping.source_paths,
      [
        'ce.golden_reference_contract',
        'ce.build_intent_brief',
        'ce.spatial_lexicon_version_used',
        'ce.visual_tolerance_policy'
      ],
      `${mapping.id} must declare all protected CE source paths.`
    );
    assert.deepEqual(
      mapping.builder_paths,
      [
        'builder.golden_reference_contract',
        'builder.build_intent_brief',
        'builder.spatial_lexicon_version_used',
        'builder.visual_tolerance_policy',
        'builder.ce_to_builder_field_preservation_manifest'
      ],
      `${mapping.id} must declare all protected Builder target paths and manifest.`
    );
    assert.ok(mapping.validation.includes('canonical_sha256_match'), `${mapping.id} must validate canonical_sha256_match.`);
    assert.ok(mapping.validation.includes('no_silent_omission'), `${mapping.id} must validate no_silent_omission.`);
  }

  if (mapping.builder_paths.length === 0) {
    assert.ok(
      mapping.loss_policy === 'declared_ir_retention' || mapping.data_loss.includes('retained in IR') || mapping.data_loss.includes('retained in canonical IR'),
      `${mapping.id} has no Builder output path and must explicitly declare IR retention.`
    );
  }
}

function validateRegistryShape(registry) {
  assert.equal(registry.schema, 'ev4-ce-builder-transformation-registry@1.0.0');
  assert.equal(registry.status, 'active');
  assert.ok(registry.ir?.schema === 'ev4-ce-builder-reference-ir@1.0.0', 'registry must declare CE→Builder reference IR schema.');
  requireStringArray(registry.ir.required_paths, 'registry.ir.required_paths');
  assert.ok(Array.isArray(registry.rules) && registry.rules.length > 0, 'registry.rules must be non-empty.');
  assert.ok(Array.isArray(registry.mappings) && registry.mappings.length > 0, 'registry.mappings must be non-empty.');

  const ids = registry.mappings.map((mapping) => mapping.id);
  assert.equal(new Set(ids).size, ids.length, 'mapping ids must be unique.');
  registry.mappings.forEach(requireMappingShape);

  const requiredRules = ['NO_SILENT_TRANSFORMS', 'NO_UNDECLARED_DATA_LOSS', 'NODE_MODEL_COMPACT_ID', 'NO_SILENT_PROTECTED_FIELD_LOSS'];
  const declaredRules = registry.rules.map((rule) => rule.id);
  for (const ruleId of requiredRules) assert.ok(declaredRules.includes(ruleId), `Missing rule ${ruleId}.`);
}

function validateCodeRegistryAlignment(registry) {
  const mappings = registry.mappings;
  const referenceMappings = mappings
    .filter((mapping) => mapping.implemented_by === 'scripts/normalize-ce-reference-map.mjs')
    .map((mapping) => mapping.id);
  const packageMappings = mappings
    .filter((mapping) => mapping.implemented_by === 'scripts/normalize-ce-builder-executable-package.mjs')
    .map((mapping) => mapping.id);

  assert.ok(sameMembers(CE_REFERENCE_MAP_TRANSFORM_IDS, referenceMappings), 'Reference map transform IDs must exactly match the registry.');
  assert.ok(sameMembers(CE_BUILDER_PACKAGE_TRANSFORM_IDS, packageMappings), 'Builder package transform IDs must exactly match the registry.');
}

function validateReferenceIrAndConnectorProjection() {
  const fixture = JSON.parse(fs.readFileSync(VALID_REFERENCE_FIXTURE, 'utf8'));
  const ir = buildCeReferenceCarrierIr(fixture.ce_paradigm_to_structure_map, fixture.reference_paradigm_lock);
  const normalized = normalizeCeReferenceCarrier(fixture.ce_paradigm_to_structure_map, fixture.reference_paradigm_lock);

  assert.equal(ir.schema, 'ev4-ce-builder-reference-ir@1.0.0');
  assert.equal(ir.primary_anchor.role, fixture.ce_paradigm_to_structure_map.primary_anchor.role, 'IR must preserve primary_anchor.role.');
  assert.deepEqual(ir.regions[0].nodes, fixture.ce_paradigm_to_structure_map.regions[0].nodes, 'IR must preserve region nodes.');
  assert.equal(ir.connector_layer.node, fixture.ce_paradigm_to_structure_map.connector_layer.node, 'IR must preserve connector node.');
  assert.equal(ir.connector_layer.model, fixture.ce_paradigm_to_structure_map.connector_layer.model, 'IR must preserve connector model.');
  assert.equal(ir.connector_layer.compact_id, 'connector-layer:card-edge-to-house-edge');
  assert.equal(normalized.paradigm_to_structure_map.connector_layer, 'connector-layer:card-edge-to-house-edge');
  assert.ok(!normalized.paradigm_to_structure_map.connector_layer.includes(': '), 'Builder connector_layer must be node:model without inserted whitespace.');
  assert.deepEqual(normalized, fixture.expected.normalized, 'Fixture expected normalization must match adapter output.');
}

if (!fs.existsSync(CE_BUILDER_TRANSFORMATION_REGISTRY_PATH)) {
  throw new Error(`Missing transformation registry: ${CE_BUILDER_TRANSFORMATION_REGISTRY_PATH}`);
}

const registry = readCeBuilderTransformationRegistry();
validateRegistryShape(registry);
validateCodeRegistryAlignment(registry);
validateReferenceIrAndConnectorProjection();
console.log(`CE→Builder transformation registry validation passed: ${path.relative(ROOT, CE_BUILDER_TRANSFORMATION_REGISTRY_PATH)}`);
