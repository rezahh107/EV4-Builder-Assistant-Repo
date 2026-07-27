#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  LEGACY_FIXTURE_AUTHORITY_SCOPE,
  reproduceHistoricalBypasses
} from './fixtures/legacy/legacy-bypass-reproduction.mjs';

const ROOT = process.cwd();
const fixtureFile = path.join(ROOT, 'scripts', 'fixtures', 'legacy', 'legacy-bypass-reproduction.mjs');
const source = fs.readFileSync(fixtureFile, 'utf8');
const records = reproduceHistoricalBypasses();

assert.equal(LEGACY_FIXTURE_AUTHORITY_SCOPE, 'historical_reproduction_only');
assert.equal(records.length, 7);
assert.deepEqual(records.map((entry) => entry.test_id), ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7']);
assert.equal(new Set(records.map((entry) => entry.test_id)).size, 7);
assert.equal(/^\s*import\s/m.test(source), false, 'Historical fixture must import no active Runtime implementation.');
for (const forbidden of [
  'initializeAtomicRun',
  'emitRunBatch',
  'confirmRunBatch',
  'attachRunEvidence',
  'completeRun',
  'publishSuccessor',
  'writeFileSync',
  'renameSync',
  'rmSync',
  'mkdirSync'
]) assert.equal(source.includes(forbidden), false, `Historical fixture contains forbidden executable surface: ${forbidden}`);

for (const record of records) {
  assert.equal(record.classification, 'HISTORICAL_AUTHORITY_BYPASS_REPRODUCTION');
  assert.equal(record.input_mode, 'inert_historical_reproduction_fixture');
  assert.equal(record.validation_result, 'historically_reproduced');
  assert.equal(record.active_runtime_importable, false);
  assert.equal(record.real_run_authority, false);
  assert.equal(record.builder_build_complete, false);
  assert.equal(record.responsive_complete, false);
  assert.equal(record.production_ready, false);
  assert.equal(typeof record.authority_effect_reached, 'string');
  assert.equal(record.authority_effect_reached.length > 0, true);
  assert.equal(typeof record.post_repair_regression_test, 'string');
  assert.equal(record.post_repair_regression_test.length > 0, true);
}

console.log(`Historical bypass record integrity passed: ${records.length}/${records.length}.`);
