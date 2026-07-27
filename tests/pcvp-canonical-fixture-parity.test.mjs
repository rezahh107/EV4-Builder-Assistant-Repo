#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { inspectCanonicalPcvpCarrierForValidation } from '../scripts/lib/pcvp-carrier.mjs';

const EXPECTED_MANIFEST_BLOB_SHA = '62e1d85023f9966664aa89f0e25022000f6a04d9';
const EXPECTED_FIXTURE_INDEX_BLOB_SHA = '607320a6fef0eb269975039dff6c380deb5ac32c';
const EXPECTED_FIXTURE_INDEX_SHA256 = '760d430c335c8c6467d70946f129347f288c43519ad9856a7c12990d2ab7a31b';
const EXPECTED_COUNTS = Object.freeze({
  valid: 8,
  invalid: 10,
  JSON_SCHEMA: 5,
  CROSS_RECORD: 2,
  SEMANTIC_POLICY: 3
});

function gitBlobSha(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseFixtureIndex(text) {
  const result = { valid: [], invalid: [] };
  let section = null;
  let current = null;

  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.replace(/\s+$/u, '');
    const sectionMatch = /^\s{2}(valid|invalid):$/u.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1];
      current = null;
      continue;
    }
    const fileMatch = /^\s{2}- file:\s*(\S+)$/u.exec(line);
    if (fileMatch) {
      assert.ok(section, `Fixture entry appeared before a valid/invalid section: ${line}`);
      current = { file: fileMatch[1] };
      result[section].push(current);
      continue;
    }
    const fieldMatch = /^\s{4}(expected|layer):\s*(\S+)$/u.exec(line);
    if (fieldMatch && current) current[fieldMatch[1]] = fieldMatch[2];
  }

  return result;
}

function actualFixtureInventory(fixturesRoot) {
  return ['valid', 'invalid'].flatMap((kind) => (
    readdirSync(path.join(fixturesRoot, kind), { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => `${kind}/${entry.name}`)
  )).sort();
}

const bundleRoot = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!bundleRoot) throw new Error('Usage: node tests/pcvp-canonical-fixture-parity.test.mjs <decision-kernel-bundle-root>');

const manifestPath = path.join(bundleRoot, '00-MANIFEST.yaml');
const fixtureIndexPath = path.join(bundleRoot, '05-FIXTURES', 'fixture-index.yaml');
const manifestBytes = readFileSync(manifestPath);
const fixtureIndexBytes = readFileSync(fixtureIndexPath);

assert.equal(gitBlobSha(manifestBytes), EXPECTED_MANIFEST_BLOB_SHA, 'Exact Decision Kernel manifest blob identity drifted.');
assert.equal(gitBlobSha(fixtureIndexBytes), EXPECTED_FIXTURE_INDEX_BLOB_SHA, 'Exact Decision Kernel fixture-index blob identity drifted.');
assert.equal(sha256(fixtureIndexBytes), EXPECTED_FIXTURE_INDEX_SHA256, 'Fixture-index content hash differs from the exact manifest declaration.');
assert.match(
  manifestBytes.toString('utf8'),
  new RegExp(`path: 05-FIXTURES/fixture-index\\.yaml[\\s\\S]*?sha256: ${EXPECTED_FIXTURE_INDEX_SHA256}`),
  'Manifest does not declare the exact fixture-index identity.'
);

const index = parseFixtureIndex(fixtureIndexBytes.toString('utf8'));
assert.equal(index.valid.length, EXPECTED_COUNTS.valid);
assert.equal(index.invalid.length, EXPECTED_COUNTS.invalid);
assert.ok(index.valid.every((entry) => entry.expected === 'ACCEPT' && entry.layer === undefined));
assert.ok(index.invalid.every((entry) => entry.expected === 'REJECT' && entry.layer));

const indexedFiles = [...index.valid, ...index.invalid].map((entry) => entry.file).sort();
assert.equal(new Set(indexedFiles).size, indexedFiles.length, 'Fixture index contains duplicate file entries.');
assert.deepEqual(
  actualFixtureInventory(path.join(bundleRoot, '05-FIXTURES')),
  indexedFiles,
  'Indexed and on-disk fixture inventories differ; skipping or substitution is forbidden.'
);

const observed = {
  valid_accepted: 0,
  invalid_rejected: 0,
  JSON_SCHEMA: 0,
  CROSS_RECORD: 0,
  SEMANTIC_POLICY: 0,
  skipped_fixtures: [],
  substituted_fixtures: []
};

for (const entry of index.valid) {
  const fixture = JSON.parse(readFileSync(path.join(bundleRoot, '05-FIXTURES', entry.file), 'utf8'));
  const result = inspectCanonicalPcvpCarrierForValidation(fixture);
  assert.equal(result.status, 'validated', `${entry.file} was rejected: ${JSON.stringify(result.diagnostics, null, 2)}`);
  observed.valid_accepted += 1;
}

for (const entry of index.invalid) {
  const fixture = JSON.parse(readFileSync(path.join(bundleRoot, '05-FIXTURES', entry.file), 'utf8'));
  const result = inspectCanonicalPcvpCarrierForValidation(fixture);
  assert.equal(result.status, 'invalid', `${entry.file} was unexpectedly accepted.`);
  const layers = [...new Set(result.diagnostics.map((item) => item.layer))];
  assert.deepEqual(layers, [entry.layer], `${entry.file} failed at ${layers.join(', ')} instead of ${entry.layer}.`);
  observed.invalid_rejected += 1;
  observed[entry.layer] += 1;
}

assert.equal(observed.valid_accepted, EXPECTED_COUNTS.valid);
assert.equal(observed.invalid_rejected, EXPECTED_COUNTS.invalid);
assert.equal(observed.JSON_SCHEMA, EXPECTED_COUNTS.JSON_SCHEMA);
assert.equal(observed.CROSS_RECORD, EXPECTED_COUNTS.CROSS_RECORD);
assert.equal(observed.SEMANTIC_POLICY, EXPECTED_COUNTS.SEMANTIC_POLICY);

console.log(JSON.stringify({
  result: 'PASS',
  manifest_blob_sha: EXPECTED_MANIFEST_BLOB_SHA,
  fixture_index_blob_sha: EXPECTED_FIXTURE_INDEX_BLOB_SHA,
  valid_expected: EXPECTED_COUNTS.valid,
  valid_accepted: observed.valid_accepted,
  invalid_expected: EXPECTED_COUNTS.invalid,
  invalid_rejected: observed.invalid_rejected,
  json_schema_expected: EXPECTED_COUNTS.JSON_SCHEMA,
  json_schema_observed: observed.JSON_SCHEMA,
  cross_record_expected: EXPECTED_COUNTS.CROSS_RECORD,
  cross_record_observed: observed.CROSS_RECORD,
  semantic_policy_expected: EXPECTED_COUNTS.SEMANTIC_POLICY,
  semantic_policy_observed: observed.SEMANTIC_POLICY,
  skipped_fixtures: observed.skipped_fixtures,
  substituted_fixtures: observed.substituted_fixtures
}, null, 2));
