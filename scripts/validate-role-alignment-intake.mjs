#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const INVALID_FIXTURES = [
  'tests/invalid/role_alignment_architect_only_stage11_export.json',
  'tests/invalid/role_alignment_ce_review_only_output.json',
  'tests/invalid/ce_builder_package_adapter_visual_missing_golden_reference.json'
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function assertArchitectOnlyExportRejected(doc, relativePath) {
  const architectOnly = doc.schema === 'ev4-architect-builder-feed-export@1.0.0'
    || doc.packet_purpose === 'ce_intake_source'
    || doc.intended_consumer === 'constructability_engineer'
    || doc.builder_executable_allowed === false;
  if (!architectOnly) throw new Error(`${relativePath}: fixture is not an Architect-only export`);
}

function assertCeReviewOnlyRejected(doc, relativePath) {
  const review = doc.constructability_review || doc;
  if (review.allowed_output_now !== 'Constructability Review') throw new Error(`${relativePath}: expected Constructability Review only`);
  if (review.blocked_output_now !== 'Builder Executable Package') throw new Error(`${relativePath}: expected Builder Executable Package to be blocked`);
  if (doc.builder_executable_package !== null && doc.builder_executable_package !== undefined) {
    throw new Error(`${relativePath}: review-only fixture must not carry builder_executable_package`);
  }
}

function assertVisualParityMissingGoldenRejected(doc, relativePath) {
  const pkg = doc.ce_builder_executable_package;
  if (!pkg || pkg.visual_parity_build !== true) throw new Error(`${relativePath}: expected visual parity CE package`);
  if (pkg.golden_reference_contract) throw new Error(`${relativePath}: negative fixture unexpectedly has golden_reference_contract`);
}

for (const relativePath of INVALID_FIXTURES) {
  if (!fs.existsSync(path.join(ROOT, relativePath))) throw new Error(`Missing role alignment fixture: ${relativePath}`);
}

assertArchitectOnlyExportRejected(readJson(INVALID_FIXTURES[0]), INVALID_FIXTURES[0]);
assertCeReviewOnlyRejected(readJson(INVALID_FIXTURES[1]), INVALID_FIXTURES[1]);
assertVisualParityMissingGoldenRejected(readJson(INVALID_FIXTURES[2]), INVALID_FIXTURES[2]);

console.log('Builder role alignment intake checks passed.');
