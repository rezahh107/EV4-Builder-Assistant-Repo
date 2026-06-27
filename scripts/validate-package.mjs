#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node scripts/validate-package.mjs <builder_context_package.json>');
  process.exit(2);
}

const resolved = path.resolve(filePath);
const pkg = JSON.parse(fs.readFileSync(resolved, 'utf8'));
const errors = [];

function fail(message) {
  errors.push(message);
}

function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

if (pkg.selected_candidate_locked !== true) {
  fail('selected_candidate_locked must be true.');
}

if (pkg.production_ready_allowed !== false) {
  fail('production_ready_allowed must be false.');
}

const nodes = Array.isArray(pkg.approved_structure_tree) ? pkg.approved_structure_tree : [];
const nodeIds = nodes.map((node) => node.node_id).filter(Boolean);
const nodeLabels = nodes.map((node) => node.structure_label).filter(Boolean);
const nodeIdSet = new Set(nodeIds);
const nodeLabelSet = new Set(nodeLabels);

for (const duplicate of duplicates(nodeIds)) {
  fail(`Duplicate node_id: ${duplicate}`);
}

for (const node of nodes) {
  for (const child of node.children || []) {
    if (!nodeIdSet.has(child)) {
      fail(`Node ${node.node_id} references unknown child node_id: ${child}`);
    }
  }

  if (node.element_generation === 'Unverified element type' && node.element_generation_source !== 'unverified') {
    fail(`Node ${node.node_id} uses Unverified element type but source is not unverified.`);
  }

  if (node.element_generation !== 'Unverified element type' && node.element_generation_source === 'unverified') {
    fail(`Node ${node.node_id} has verified generation label but unverified source.`);
  }
}

const classMap = Array.isArray(pkg.class_creation_application_map) ? pkg.class_creation_application_map : [];
const classNames = new Set(classMap.map((entry) => entry.class_name).filter(Boolean));

for (const entry of classMap) {
  const target = entry.elementor_node_or_element;
  if (typeof target === 'string' && target.startsWith('n-') && !nodeIdSet.has(target)) {
    fail(`Class ${entry.class_name} maps to unknown node_id: ${target}`);
  }
}

for (const widget of pkg.widget_mapping_table || []) {
  if (widget.class_name && !classNames.has(widget.class_name)) {
    fail(`Widget mapping references class not present in class map: ${widget.class_name}`);
  }
}

const actions = pkg.first_builder_batch?.actions || [];
const actionIds = actions.map((action) => action.action_id).filter(Boolean);

for (const duplicate of duplicates(actionIds)) {
  fail(`Duplicate action_id: ${duplicate}`);
}

for (const action of actions) {
  const target = action.target_element;
  const targetKnown = nodeIdSet.has(target) || nodeLabelSet.has(target);
  if (!targetKnown) {
    fail(`Action ${action.action_id} targets unknown element: ${target}`);
  }

  if (action.active_class && !classNames.has(action.active_class)) {
    fail(`Action ${action.action_id} references class not present in class map: ${action.active_class}`);
  }

  if (action.element_generation === 'Unverified element type' && action.element_generation_source !== 'unverified') {
    fail(`Action ${action.action_id} uses Unverified element type but source is not unverified.`);
  }

  if (action.element_generation !== 'Unverified element type' && action.element_generation_source === 'unverified') {
    fail(`Action ${action.action_id} has verified generation label but unverified source.`);
  }
}

if (errors.length > 0) {
  console.error(`Cross-field validation failed for ${filePath}:`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Cross-field validation passed: ${filePath}`);
