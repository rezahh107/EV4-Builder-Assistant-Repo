#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertAllTransformsDeclared } from './ce-builder-transformation-registry.mjs';

const IMPLEMENTED_BY = 'scripts/normalize-ce-reference-map.mjs';

export const CE_REFERENCE_MAP_TRANSFORM_IDS = [
  'CE_REF_PRIMARY_ANCHOR_NODE_COPY',
  'CE_REF_PRIMARY_ANCHOR_ROLE_IR_ONLY',
  'CE_REF_REGION_LABELS_DERIVE',
  'CE_REF_REGION_NODES_IR_ONLY',
  'CE_REF_CENTER_ANCHOR_REGION_DERIVE',
  'CE_REF_REPEATED_UNIT_FORM_COPY',
  'CE_REF_REPEATED_UNIT_CHILDREN_DERIVE',
  'CE_REF_CONNECTOR_LAYER_COMPACT',
  'CE_REF_CONNECTOR_NODE_IR_ONLY',
  'CE_REF_CONNECTOR_MODEL_TO_REQUIREMENTS',
  'CE_REF_REQUIREMENTS_ARRAY_TO_OBJECT',
  'CE_REF_LEFT_RIGHT_COUNTS_DERIVE',
  'CE_REF_FIRST_BATCH_INTENT_DERIVE'
];

function assertDeclaredReferenceMapTransforms() {
  assertAllTransformsDeclared(CE_REFERENCE_MAP_TRANSFORM_IDS, IMPLEMENTED_BY);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireObject(value, location) {
  if (!isObject(value)) throw new Error(`${location} must be an object.`);
  return value;
}

function requireString(value, location) {
  if (!isNonEmptyString(value)) throw new Error(`${location} must be a non-empty string.`);
  return value.trim();
}

function requireArray(value, location) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${location} must be a non-empty array.`);
  return value;
}

function unique(values) {
  return [...new Set(values)];
}

function hasDirectionTerm(text, direction) {
  const normalized = String(text || '').toLowerCase();
  const pattern = direction === 'left' ? /(^|[^a-z])left([^a-z]|$)/ : /(^|[^a-z])right([^a-z]|$)/;
  return pattern.test(normalized);
}

function regionLabel(region) {
  const id = requireString(region.id, 'paradigm_to_structure_map.regions[].id');
  const distribution = isNonEmptyString(region.distribution) ? region.distribution.trim() : null;
  const count = Number.isInteger(region.expected_count) ? region.expected_count : null;
  if (distribution && count) return `${id} (${distribution}, ${count})`;
  if (distribution) return `${id} (${distribution})`;
  return id;
}

function derivesLeftRightRegions(regions) {
  const text = regions.map((region) => `${region.id || ''} ${region.distribution || ''}`).join(' ');
  return hasDirectionTerm(text, 'left') && hasDirectionTerm(text, 'right');
}

function findRegionCount(regions, side) {
  const region = regions.find((entry) => {
    const text = `${entry.id || ''} ${entry.distribution || ''}`;
    return hasDirectionTerm(text, side);
  });
  return Number.isInteger(region?.expected_count) ? region.expected_count : 0;
}

function expectedCountFromDistribution(distributionModel, side) {
  if (side === 'left') {
    const left = typeof distributionModel === 'string' ? distributionModel.match(/^(\d+)-left/) : null;
    return left ? Number(left[1]) : null;
  }
  const right = typeof distributionModel === 'string' ? distributionModel.match(/-(\d+)-right$/) : null;
  return right ? Number(right[1]) : null;
}

function compactNodeModel(node, model) {
  return `${node}:${model}`;
}

export function isCeStructuredParadigmToStructureMap(map) {
  return (
    isObject(map) &&
    isObject(map.primary_anchor) &&
    Array.isArray(map.regions) &&
    isObject(map.repeated_units) &&
    isObject(map.connector_layer) &&
    Array.isArray(map.first_batch_requirements)
  );
}

function readCeCarrier(map, referenceParadigmLock = {}) {
  assertDeclaredReferenceMapTransforms();

  if (!isCeStructuredParadigmToStructureMap(map)) {
    throw new Error('Expected CE structured paradigm_to_structure_map shape.');
  }

  const primaryAnchor = requireObject(map.primary_anchor, 'paradigm_to_structure_map.primary_anchor');
  const regions = requireArray(map.regions, 'paradigm_to_structure_map.regions').map((region, index) => {
    requireObject(region, `paradigm_to_structure_map.regions[${index}]`);
    if (!Number.isInteger(region.expected_count)) {
      throw new Error(`paradigm_to_structure_map.regions[${index}].expected_count must be an integer.`);
    }
    const validatedNodes = requireArray(region.nodes, `paradigm_to_structure_map.regions[${index}].nodes`)
      .map((node, nodeIndex) => requireString(node, `paradigm_to_structure_map.regions[${index}].nodes[${nodeIndex}]`));
    return {
      id: requireString(region.id, `paradigm_to_structure_map.regions[${index}].id`),
      distribution: requireString(region.distribution, `paradigm_to_structure_map.regions[${index}].distribution`),
      expected_count: region.expected_count,
      nodes: validatedNodes
    };
  });
  const repeatedUnits = requireObject(map.repeated_units, 'paradigm_to_structure_map.repeated_units');
  const connectorLayer = requireObject(map.connector_layer, 'paradigm_to_structure_map.connector_layer');
  const sourceRequirements = requireArray(map.first_batch_requirements, 'paradigm_to_structure_map.first_batch_requirements')
    .map((requirement, index) => requireString(requirement, `paradigm_to_structure_map.first_batch_requirements[${index}]`));

  const primaryAnchorNode = requireString(primaryAnchor.node, 'paradigm_to_structure_map.primary_anchor.node');
  const primaryAnchorRole = requireString(primaryAnchor.role, 'paradigm_to_structure_map.primary_anchor.role');
  const repeatedUnitForm = requireString(repeatedUnits.form, 'paradigm_to_structure_map.repeated_units.form');
  const connectorModel = requireString(connectorLayer.model, 'paradigm_to_structure_map.connector_layer.model');
  const connectorNode = requireString(connectorLayer.node, 'paradigm_to_structure_map.connector_layer.node');
  const distributionModel = requireString(referenceParadigmLock.distribution_model, 'reference_paradigm_lock.distribution_model');

  const requiredChildren = requireArray(repeatedUnits.required_children, 'paradigm_to_structure_map.repeated_units.required_children')
    .map((child, index) => requireString(child, `paradigm_to_structure_map.repeated_units.required_children[${index}]`));

  const leftRightProven = derivesLeftRightRegions(regions) || hasDirectionTerm(distributionModel, 'left') || hasDirectionTerm(distributionModel, 'right');
  if (!leftRightProven) {
    throw new Error('CE reference map adapter requires explicit left/right region evidence.');
  }

  const compactConnectorId = compactNodeModel(connectorNode, connectorModel);

  return {
    primaryAnchorNode,
    primaryAnchorRole,
    repeatedUnitForm,
    connectorModel,
    connectorNode,
    compactConnectorId,
    distributionModel,
    leftRightProven,
    regions,
    requiredChildren,
    sourceRequirements
  };
}

export function buildCeReferenceCarrierIr(map, referenceParadigmLock = {}) {
  const carrier = readCeCarrier(map, referenceParadigmLock);
  const expectedLeft = expectedCountFromDistribution(carrier.distributionModel, 'left');
  const expectedRight = expectedCountFromDistribution(carrier.distributionModel, 'right');

  return {
    schema: 'ev4-ce-builder-reference-ir@1.0.0',
    primary_anchor: {
      node: carrier.primaryAnchorNode,
      role: carrier.primaryAnchorRole
    },
    regions: carrier.regions.map((region) => ({ ...region })),
    repeated_units: {
      form: carrier.repeatedUnitForm,
      required_children: [...carrier.requiredChildren]
    },
    connector_layer: {
      node: carrier.connectorNode,
      model: carrier.connectorModel,
      compact_id: carrier.compactConnectorId
    },
    first_batch_requirements: [...carrier.sourceRequirements],
    derived: {
      distribution_model: carrier.distributionModel,
      left_right_regions_proven: carrier.leftRightProven,
      left_region_count: expectedLeft ?? findRegionCount(carrier.regions, 'left'),
      right_region_count: expectedRight ?? findRegionCount(carrier.regions, 'right')
    }
  };
}

export function normalizeCeParadigmToStructureMap(map, referenceParadigmLock = {}) {
  const ir = buildCeReferenceCarrierIr(map, referenceParadigmLock);
  const regionLabels = ir.regions.map(regionLabel);
  const repeatedUnitLabels = unique([
    ir.repeated_units.form,
    `${ir.repeated_units.form} with ${ir.repeated_units.required_children.join(', ')}`
  ]);

  return {
    primary_anchor: ir.primary_anchor.node,
    regions: unique([
      ...regionLabels,
      `${ir.primary_anchor.node} (center primary anchor)`
    ]),
    repeated_units: repeatedUnitLabels,
    connector_layer: ir.connector_layer.compact_id,
    first_batch_requirements: {
      must_establish_primary_anchor: true,
      must_create_or_stage_left_right_regions: ir.derived.left_right_regions_proven,
      must_use_repeated_unit_form: ir.repeated_units.form,
      forbidden_composition_starts: [],
      connector_strategy: ir.connector_layer.model
    }
  };
}

export function normalizeCeFirstBatchStructureIntent(map, referenceParadigmLock = {}) {
  const ir = buildCeReferenceCarrierIr(map, referenceParadigmLock);

  return {
    primary_anchor_staged: true,
    primary_anchor: ir.primary_anchor.node,
    distribution_model: ir.derived.distribution_model,
    repeated_unit_form: ir.repeated_units.form,
    region_model: 'left-center-right',
    left_region_count: ir.derived.left_region_count,
    right_region_count: ir.derived.right_region_count,
    connector_strategy: ir.connector_layer.model,
    connector_layer_staged: true,
    forbidden_composition_start: false
  };
}

export function normalizeCeReferenceCarrier(map, referenceParadigmLock = {}) {
  return {
    paradigm_to_structure_map: normalizeCeParadigmToStructureMap(map, referenceParadigmLock),
    first_batch_structure_intent: normalizeCeFirstBatchStructureIntent(map, referenceParadigmLock)
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/normalize-ce-reference-map.mjs <fixture.json>');
    process.exit(2);
  }

  const fixture = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  const map = fixture.ce_paradigm_to_structure_map || fixture.paradigm_to_structure_map;
  const lock = fixture.reference_paradigm_lock || {};
  const normalized = normalizeCeReferenceCarrier(map, lock);
  console.log(JSON.stringify(normalized, null, 2));
}
