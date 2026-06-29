#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/validate-unit-strategy-check.mjs <unit-strategy-check.json>');
  process.exit(2);
}

const check = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
const errors = [];

function fail(id, message) {
  errors.push({ id, message });
}

if (check.schema !== 'ev4-unit-strategy-check@0.1.0') fail('EV4-UNIT-001', 'schema must be ev4-unit-strategy-check@0.1.0.');

if (check.safe_to_emit === true) {
  if (check.value_source === 'unknown') fail('EV4-UNIT-002', 'safe_to_emit true requires known value_source.');
  if (check.responsive_scope === 'unknown') fail('EV4-UNIT-003', 'safe_to_emit true requires known responsive_scope.');
  if (check.reversible !== true) fail('EV4-UNIT-004', 'safe_to_emit true requires reversible true.');
  if (check.required_next_action !== 'emit_value') fail('EV4-UNIT-005', 'safe_to_emit true requires required_next_action emit_value.');
}

if (
  check.value_source === 'asset_intrinsic' &&
  check.safe_to_emit === true &&
  (check.affects_layout === true || check.affects_position === true)
) {
  fail('EV4-UNIT-006', 'asset_intrinsic alone must not be emitted as executable layout or position value.');
}

if (errors.length > 0) {
  console.error(`Unit strategy validation failed for ${filePath}:`);
  for (const error of errors) console.error(`- ${error.id}: ${error.message}`);
  process.exit(1);
}

console.log(`Unit strategy validation passed: ${filePath}`);
