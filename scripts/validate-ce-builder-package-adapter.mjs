#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { normalizeCeBuilderExecutablePackage } from './normalize-ce-builder-executable-package.mjs';
import { PROTECTED_FIELD_DEFINITIONS, canonicalSha256, validateBuilderFieldPreservationManifest } from './ce-builder-field-preservation-contract.mjs';

const ROOT = process.cwd();
const VALID_DIR = path.join(ROOT, 'tests', 'valid');
const INVALID_DIR = path.join(ROOT, 'tests', 'invalid');
const PREFIX = 'ce_builder_package_adapter_';

function fixturePaths(directory) {
  return fs.readdirSync(directory)
    .filter((name) => name.startsWith(PREFIX) && name.endsWith('.json'))
    .map((name) => path.join(directory, name))
    .sort();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run(command, args, label) {
  const result = spawnSync(command, args, { stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${label} failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
}

function validateBuilderPackage(builderPackage, filePath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-ce-builder-adapter-'));
  try {
    const outputPath = path.join(tmpDir, 'builder_context_package.json');
    fs.writeFileSync(outputPath, JSON.stringify(builderPackage, null, 2));

    const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    run(npxCommand, [
      '--yes',
      'ajv-cli@5',
      'validate',
      '--spec=draft2020',
      '--strict=false',
      '-s',
      'schemas/builder-context-package.schema.json',
      '-d',
      outputPath
    ], `schema validation for ${filePath}`);
    run(process.execPath, ['scripts/validate-package.mjs', outputPath], `cross-field validation for ${filePath}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function assertProtectedFieldsPreserved(cePackage, builderPackage, filePath) {
  const manifestViolations = validateBuilderFieldPreservationManifest(builderPackage);
  assert.deepEqual(manifestViolations, [], `field preservation manifest must be valid for ${filePath}`);
  assert.equal(builderPackage.ce_to_builder_field_preservation_manifest?.result, 'pass', `field preservation manifest must pass for ${filePath}`);

  for (const fieldDef of PROTECTED_FIELD_DEFINITIONS) {
    assert.deepEqual(builderPackage[fieldDef.field], cePackage[fieldDef.field], `${fieldDef.field} must reach Builder input unchanged.`);
    const digest = canonicalSha256(cePackage[fieldDef.field]);
    const manifestField = builderPackage.ce_to_builder_field_preservation_manifest.fields.find((entry) => entry.field === fieldDef.field);
    assert.ok(manifestField, `${fieldDef.field} must be present in preservation manifest.`);
    assert.equal(manifestField.source_path, fieldDef.source_path);
    assert.equal(manifestField.target_path, fieldDef.target_path);
    assert.equal(manifestField.source_sha256, digest);
    assert.equal(manifestField.target_sha256, digest);
  }
}

const validFixtures = fixturePaths(VALID_DIR);
const invalidFixtures = fixturePaths(INVALID_DIR);

if (validFixtures.length === 0) throw new Error(`No valid ${PREFIX} fixtures found.`);
if (invalidFixtures.length === 0) throw new Error(`No invalid ${PREFIX} fixtures found.`);

for (const filePath of validFixtures) {
  const fixture = readJson(filePath);
  const ceBefore = JSON.stringify(fixture.ce_builder_executable_package);
  const builderPackage = normalizeCeBuilderExecutablePackage(fixture.ce_builder_executable_package);

  assert.equal(JSON.stringify(fixture.ce_builder_executable_package), ceBefore, 'adapter must not mutate CE input payload.');
  assert.equal(builderPackage.schema, 'ev4-builder-context-package@1.0.0');
  assert.equal(builderPackage.package_status, 'ready');
  assert.equal(builderPackage.production_ready_allowed, false);
  assert.equal(builderPackage.selected_candidate_id, fixture.ce_builder_executable_package.selected_candidate_id);
  assert.equal(builderPackage.confirmation_request.template_id, 'standard_batch_confirmation');
  assert.equal(builderPackage.first_builder_batch.actions.length, fixture.ce_builder_executable_package.first_safe_builder_batch.actions.length);
  assert.deepEqual(
    builderPackage.confirmation_request.confirmed_action_ids,
    fixture.ce_builder_executable_package.confirmation_request.confirmed_action_ids
  );
  assertProtectedFieldsPreserved(fixture.ce_builder_executable_package, builderPackage, filePath);
  assert.ok(builderPackage.input_authorization?.package_digest?.value, 'normalized package must include computed input_authorization.package_digest.value');

  validateBuilderPackage(builderPackage, filePath);
  console.log(`CE builder package adapter valid fixture passed: ${filePath}`);
}

for (const filePath of invalidFixtures) {
  const fixture = readJson(filePath);
  let failed = false;
  try {
    normalizeCeBuilderExecutablePackage(fixture.ce_builder_executable_package);
  } catch {
    failed = true;
  }
  if (!failed) throw new Error(`Invalid CE builder package adapter fixture unexpectedly passed: ${filePath}`);
  console.log(`CE builder package adapter invalid fixture correctly failed: ${filePath}`);
}
