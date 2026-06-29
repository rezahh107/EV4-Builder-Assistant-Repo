#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/validate-batch-compaction-check.mjs <batch-compaction-check.json>');
  process.exit(2);
}

const check = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
const errors = [];

function fail(id, message) {
  errors.push({ id, message });
}

if (check.schema !== 'ev4-batch-compaction-check@0.1.0') fail('EV4-BATCH-COMPACT-001', 'schema must be ev4-batch-compaction-check@0.1.0.');
if (!Number.isInteger(check.action_count) || check.action_count < 1 || check.action_count > 5) fail('EV4-BATCH-COMPACT-002', 'action_count must be 1..5.');
if (Array.isArray(check.actions) && check.actions.length !== check.action_count) {
  fail('EV4-BATCH-COMPACT-005', `actions array length (${check.actions.length}) must match action_count (${check.action_count}).`);
}

if (check.compact_batch_allowed === true) {
  const requiredTrue = [
    'same_element',
    'same_control_family',
    'controls_visible_or_confirmed',
    'unit_strategy_resolved',
    'value_sources_resolved',
    'actions_reversible',
    'geometry_strategy_resolved',
    'architecture_boundary_preserved'
  ];
  for (const field of requiredTrue) {
    if (check[field] !== true) fail('EV4-BATCH-COMPACT-003', `compact_batch_allowed true requires ${field} true.`);
  }
  if (check.responsive_claim_introduced !== false) fail('EV4-BATCH-COMPACT-004', 'compact_batch_allowed true requires responsive_claim_introduced false.');
}

if (errors.length > 0) {
  console.error(`Batch compaction validation failed for ${filePath}:`);
  for (const error of errors) console.error(`- ${error.id}: ${error.message}`);
  process.exit(1);
}

console.log(`Batch compaction validation passed: ${filePath}`);
