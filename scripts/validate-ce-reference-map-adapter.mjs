#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { normalizeCeReferenceCarrier } from './normalize-ce-reference-map.mjs';
import { validateReferenceParadigmGate } from './validate-reference-paradigm-gate.mjs';

const ROOT = process.cwd();
const VALID_DIR = path.join(ROOT, 'tests', 'valid');
const INVALID_DIR = path.join(ROOT, 'tests', 'invalid');
const PREFIX = 'ce_reference_map_adapter_';

function fixturePaths(directory) {
  return fs.readdirSync(directory)
    .filter((name) => name.startsWith(PREFIX) && name.endsWith('.json'))
    .map((name) => path.join(directory, name))
    .sort();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertBuilderReferenceGateAccepts(fixture, normalized, filePath) {
  const pkg = {
    visual_reference_present: true,
    visual_parity_expected: true,
    task_type: 'visual_build',
    reference_artifact_type: 'structured_contract',
    reference_paradigm_lock: fixture.reference_paradigm_lock,
    paradigm_to_structure_map: normalized.paradigm_to_structure_map,
    first_batch_structure_intent: normalized.first_batch_structure_intent,
    first_builder_batch: {
      actions: [
        {
          target_element: 'Smart Home Section / Relative Stage',
          parent: 'Smart Home Section / Root',
          element_type: 'Container',
          structure_panel_name: 'Smart Home Section / Relative Stage',
          instruction: 'Create central house primary anchor with left region and right region for pill-card card-edge-to-house-edge connectors.',
          expected_result: 'Central house anchor and left/right regions staged.'
        }
      ]
    }
  };

  const diagnostics = validateReferenceParadigmGate(pkg);
  assert.deepEqual(diagnostics, [], `${filePath} normalized output should satisfy Builder reference paradigm gate.`);
}

const validFixtures = fixturePaths(VALID_DIR);
const invalidFixtures = fixturePaths(INVALID_DIR);

if (validFixtures.length === 0) throw new Error(`No valid ${PREFIX} fixtures found.`);
if (invalidFixtures.length === 0) throw new Error(`No invalid ${PREFIX} fixtures found.`);

for (const filePath of validFixtures) {
  const fixture = readJson(filePath);
  const normalized = normalizeCeReferenceCarrier(
    fixture.ce_paradigm_to_structure_map,
    fixture.reference_paradigm_lock
  );

  assert.deepEqual(normalized, fixture.expected.normalized, `${filePath} normalized output changed.`);
  assertBuilderReferenceGateAccepts(fixture, normalized, filePath);
  console.log(`CE reference map adapter valid fixture passed: ${filePath}`);
}

for (const filePath of invalidFixtures) {
  const fixture = readJson(filePath);
  let failed = false;
  try {
    normalizeCeReferenceCarrier(fixture.ce_paradigm_to_structure_map, fixture.reference_paradigm_lock);
  } catch {
    failed = true;
  }
  if (!failed) throw new Error(`Invalid CE reference map adapter fixture unexpectedly passed: ${filePath}`);
  console.log(`CE reference map adapter invalid fixture correctly failed: ${filePath}`);
}
