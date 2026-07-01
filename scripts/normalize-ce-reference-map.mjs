#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  if (!isCeStructuredParadigmToStructureMap(map)) {
    throw new Error('Expected CE structured paradigm_to_structure_map shape.');
  }

  const primaryAnchor = requireObject(map.primary_anchor, 'paradigm_to_structure_map.primary_anchor');
  const regions = requireArray(map.regions, 'paradigm_to_structure_map.regions').map((region, index) => {
    requireObject(region, `paradigm_to_structure_map.regions[${index}]`);
    requireArray(region.nodes, `paradigm_to_structure_map.regions[${index}].nodes`).forEach((node, nodeIndex) => {
      requireString(node, `paradigm_to_structure_map.regions[${index}].nodes[${nodeIndex}]`);
    });
    return region;
  });
  const repeatedUnits = requireObject(map.repeated_units, 'paradigm_to_structure_map.repeated_units');
  const connectorLayer = requireObject(map.connector_layer, 'paradigm_to_structure_map.connector_layer');
  const sourceRequirements = requireArray(map.first_batch_requirements, 'paradigm_to_structure_map.first_batch_requirements');

  sourceRequirements.forEach((requirement, index) => {
    requireString(requirement, `paradigm_to_structure_map.first_batch_requirements[${index}]`);
  });

  const primaryAnchorNode = requireString(primaryAnchor.node, 'paradigm_to_structure_map.primary_anchor.node');
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

  return {
    primaryAnchorNode,
    repeatedUnitForm,
    connectorModel,
    connectorNode,
    distributionModel,
    leftRightProven,
    regions,
    requiredChildren
  };
}

export function normalizeCeParadigmToStructureMap(map, referenceParadigmLock = {}) {
  const carrier = readCeCarrier(map, referenceParadigmLock);
  const regionLabels = carrier.regions.map(regionLabel);
  const repeatedUnitLabels = unique([
    carrier.repeatedUnitForm,
    `${carrier.repeatedUnitForm} with ${carrier.requiredChildren.join(', ')}`
  ]);

  return {
    primary_anchor: carrier.primaryAnchorNode,
    regions: unique([
      ...regionLabels,
      `${carrier.primaryAnchorNode} (center primary anchor)`
    ]),
    repeated_units: repeatedUnitLabels,
    connector_layer: `${carrier.connectorNode}: ${carrier.connectorModel}`,
    first_batch_requirements: {
      must_establish_primary_anchor: true,
      must_create_or_stage_left_right_regions: carrier.leftRightProven,
      must_use_repeated_unit_form: carrier.repeatedUnitForm,
      forbidden_composition_starts: [],
      connector_strategy: carrier.connectorModel
    }
  };
}

export function normalizeCeFirstBatchStructureIntent(map, referenceParadigmLock = {}) {
  const carrier = readCeCarrier(map, referenceParadigmLock);
  const expectedLeft = expectedCountFromDistribution(carrier.distributionModel, 'left');
  const expectedRight = expectedCountFromDistribution(carrier.distributionModel, 'right');

  return {
    primary_anchor_staged: true,
    primary_anchor: carrier.primaryAnchorNode,
    distribution_model: carrier.distributionModel,
    repeated_unit_form: carrier.repeatedUnitForm,
    region_model: 'left-center-right',
    left_region_count: expectedLeft ?? findRegionCount(carrier.regions, 'left'),
    right_region_count: expectedRight ?? findRegionCount(carrier.regions, 'right'),
    connector_strategy: carrier.connectorModel,
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
