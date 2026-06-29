#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/validate-cognitive-mode-hint.mjs <cognitive-mode-hint.json>');
  process.exit(2);
}

const check = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
const errors = [];

function fail(id, message) {
  errors.push({ id, message });
}

if (check.schema !== 'ev4-cognitive-mode-hint@0.1.0') fail('EV4-COGNITIVE-001', 'schema must be ev4-cognitive-mode-hint@0.1.0.');
if (check.allowed_context === 'active_builder_batch' && check.footer_allowed === true) {
  fail('EV4-COGNITIVE-002', 'cognitive mode footer must not be allowed after active Builder batches.');
}

if (errors.length > 0) {
  console.error(`Cognitive mode hint validation failed for ${filePath}:`);
  for (const error of errors) console.error(`- ${error.id}: ${error.message}`);
  process.exit(1);
}

console.log(`Cognitive mode hint validation passed: ${filePath}`);
