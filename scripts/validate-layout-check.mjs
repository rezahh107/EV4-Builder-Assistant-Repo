#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/validate-layout-check.mjs <layout-check.json>');
  process.exit(2);
}

const check = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
const errors = [];

function fail(id, message) {
  errors.push({ id, message });
}

const SAFE_CONTROL_STATUSES = new Set(['confirmed', 'visible', 'user_confirmed']);
const BLOCKING_UNRESOLVED_STATUSES = new Set(['not_visible', 'missing', 'unknown', 'unresolved']);

if (check.schema !== 'ev4-layout-check@0.1.0') fail('EV4-LAYOUT-001', 'schema must be ev4-layout-check@0.1.0.');

const requiredControls = Array.isArray(check.required_controls) ? check.required_controls : [];
const blockingUnresolvedControls = requiredControls.filter(
  (control) => control.blocks_content_or_style === true && BLOCKING_UNRESOLVED_STATUSES.has(control.status)
);

for (const control of requiredControls) {
  if (SAFE_CONTROL_STATUSES.has(control.status) && (!Array.isArray(control.evidence_refs) || control.evidence_refs.length === 0)) {
    fail('EV4-LAYOUT-002', `Control ${control.control_name} is ${control.status} but has no evidence_refs.`);
  }
}

if (check.layout_check_complete === true) {
  if (check.unit_strategy_resolved !== true) fail('EV4-LAYOUT-003', 'layout_check_complete true requires unit_strategy_resolved true.');
  if (check.geometry_strategy_resolved !== true) fail('EV4-LAYOUT-004', 'layout_check_complete true requires geometry_strategy_resolved true.');
  if (check.responsive_scope_resolved !== true) fail('EV4-LAYOUT-005', 'layout_check_complete true requires responsive_scope_resolved true.');
  if (blockingUnresolvedControls.length > 0) fail('EV4-LAYOUT-006', `layout_check_complete true cannot have blocking unresolved controls: ${blockingUnresolvedControls.map((control) => control.control_name).join(', ')}.`);
}

if (check.content_or_style_batch_allowed === true) {
  if (check.layout_check_complete !== true) fail('EV4-LAYOUT-007', 'content_or_style_batch_allowed true requires layout_check_complete true.');
  if (check.normal_builder_batch_allowed !== true) fail('EV4-LAYOUT-008', 'content_or_style_batch_allowed true requires normal_builder_batch_allowed true.');
  if (check.required_next_action !== 'continue_builder_batch') fail('EV4-LAYOUT-009', 'content_or_style_batch_allowed true requires required_next_action continue_builder_batch.');
}

if (blockingUnresolvedControls.length > 0) {
  if (check.layout_check_complete !== false) fail('EV4-LAYOUT-010', 'Blocking unresolved controls require layout_check_complete false.');
  if (check.content_or_style_batch_allowed !== false) fail('EV4-LAYOUT-011', 'Blocking unresolved controls require content_or_style_batch_allowed false.');
  if (check.normal_builder_batch_allowed !== false) fail('EV4-LAYOUT-012', 'Blocking unresolved controls require normal_builder_batch_allowed false.');
  if (!['ask_targeted_evidence', 'create_repair_packet'].includes(check.required_next_action)) fail('EV4-LAYOUT-013', 'Blocking unresolved controls require ask_targeted_evidence or create_repair_packet.');
}

if (check.layout_check_complete === false && check.required_next_action === 'continue_builder_batch') fail('EV4-LAYOUT-014', 'layout_check_complete false must not continue builder batch.');

if (errors.length > 0) {
  console.error(`Layout check validation failed for ${filePath}:`);
  for (const error of errors) console.error(`- ${error.id}: ${error.message}`);
  process.exit(1);
}

console.log(`Layout check validation passed: ${filePath}`);
