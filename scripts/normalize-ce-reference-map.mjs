#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

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

function regionLabel(region) {
  const id = requireString(region.id, 'paradigm_to_structure_map.regions[].id');
  const distribution = isNonEmptyString(region.distribution) ? region.distribution.trim() : null;
  const count = Number.isInteger(region.expected_count) ? region.expected_count : null;
  if (distribution && count) return `${id} (${distribution}, ${count})`;
  if (distribution) return `${id} (${distribution})`;
  return id;
}

function derivesLeftRightRegions(regions) {
  const text = regions.map((region) => `${region.id || ''} ${region.distribution || ''}`).join(' ').toLowerCase();
  return text.includes('left') && text.includes('right');
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

export function normalizeCeParadigmToStructureMap(map, referenceParadigmLock = {}) {
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
  requireString(connectorLayer.node, 'paradigm_to_structure_map.connector_layer.node');

  const requiredChildren = requireArray(repeatedUnits.required_children, 'paradigm_to_structure_map.repeated_units.required_children')
    .map((child, index) => requireString(child, `paradigm_to_structure_map.repeated_units.required_children[${index}]`));

  const regionLabels = regions.map(regionLabel);
  const repeatedUnitLabels = unique([
    repeatedUnitForm,
    `${repeatedUnitForm} with ${requiredChildren.join(', ')}`
  ]);

  const sourceRequirementText = sourceRequirements.join(' ').toLowerCase();
  const distributionModel = isNonEmptyString(referenceParadigmLock.distribution_model)
    ? referenceParadigmLock.distribution_model.toLowerCase()
    : '';

  return {
    primary_anchor: primaryAnchorNode,
    regions: regionLabels,
    repeated_units: repeatedUnitLabels,
    connector_layer: `${connectorLayer.node}: ${connectorModel}`,
    first_batch_requirements: {
      must_establish_primary_anchor: true,
      must_create_or_stage_left_right_regions:
        derivesLeftRightRegions(regions) || distributionModel.includes('left') || distributionModel.includes('right'),
      must_use_repeated_unit_form: repeatedUnitForm,
      forbidden_composition_starts: [],
      connector_strategy: connectorModel,
      source_requirements_summary: sourceRequirements.join('; ')
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/normalize-ce-reference-map.mjs <fixture.json>');
    process.exit(2);
  }

  const fixture = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  const map = fixture.ce_paradigm_to_structure_map || fixture.paradigm_to_structure_map;
  const lock = fixture.reference_paradigm_lock || {};
  const normalized = normalizeCeParadigmToStructureMap(map, lock);
  console.log(JSON.stringify(normalized, null, 2));
}
