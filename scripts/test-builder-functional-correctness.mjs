#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { computePackageDigest } from './lib/canonical-builder-package.mjs';
import {
  collectActiveBlockers,
  initializeAtomicRun,
  validateCanonicalRun,
  validateCanonicalSourceModeArguments
} from './lib/runtime/canonical-run-runtime.mjs';
import {
  publishConfirmationTransaction,
  publishEmitBatchTransaction,
  publishStrictRealCompletion,
  writeStrictRealIntake
} from './lib/builder-functional-correctness.mjs';
import { checkpointSequenceIsValid } from './lib/checkpoint-sequence.mjs';

const ROOT = process.cwd();
const FIXTURE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'builder_context_package.json');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-functional-correctness-'));
const failures = [];
let count = 0;

function test(title, fn) {
  count += 1;
  try {
    fn();
    console.log(`PASS ${count}: ${title}`);
  } catch (error) {
    failures.push(`FAIL ${count}: ${title}: ${error.message}`);
  }
}

function manualSource(name) {
  const pkg = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  for (const entry of pkg.source_payload_ledger || []) entry.source_ref = `operator-content:${entry.payload_name}`;
  pkg.input_authorization.package_digest.value = computePackageDigest(pkg);
  const file = path.join(TEMP, `${name}.json`);
  fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  return file;
}

try {
  test('project-gate requires both consumed inputs', () => assert.equal(validateCanonicalSourceModeArguments({ sourceMode: 'project-gate', sourceArtifactFile: 'receipt.json', builderInputFile: 'builder.json' }).passed, true));
  test('direct-ce rejects unused Builder Input', () => assert.equal(validateCanonicalSourceModeArguments({ sourceMode: 'direct-ce', sourceArtifactFile: 'ce.json', builderInputFile: 'unused.json' }).passed, false));
  test('manual mode rejects unused source artifact', () => assert.equal(validateCanonicalSourceModeArguments({ sourceMode: 'manual-builder-input', sourceArtifactFile: 'unused.json', builderInputFile: 'builder.json' }).passed, false));
  test('canonical sequence accepts initial Checkpoint', () => assert.equal(checkpointSequenceIsValid({ checkpoint_sequence: 1, parent_checkpoint_id: null }), true));
  test('canonical sequence accepts subsequent Checkpoint', () => assert.equal(checkpointSequenceIsValid({ checkpoint_sequence: 2, parent_checkpoint_id: 'CP-001' }), true));
  test('canonical sequence rejects sequence 1 with parent', () => assert.equal(checkpointSequenceIsValid({ checkpoint_sequence: 1, parent_checkpoint_id: 'CP-000' }), false));
  test('canonical sequence rejects sequence 2 with null parent', () => assert.equal(checkpointSequenceIsValid({ checkpoint_sequence: 2, parent_checkpoint_id: null }), false));

  test('shared blocker collector deduplicates all active blocker surfaces', () => {
    const blockers = collectActiveBlockers(
      { unresolved_evidence: ['B-001', 'B-002'] },
      {
        unresolved_blockers: ['B-002', 'B-003'],
        assertions: [
          { assertion_id: 'A-001', status: 'not_checked' },
          { assertion_id: 'A-002', status: 'insufficient_evidence' },
          { assertion_id: 'A-003', status: 'confirmed' }
        ]
      }
    );
    assert.deepEqual(blockers, ['A-001', 'A-002', 'B-001', 'B-002', 'B-003']);
  });

  test('Runtime derives the complete initial Run without caller-authored State', () => {
    const source = manualSource('initial-run');
    const runDirectory = path.join(TEMP, 'initial-run');
    const result = initializeAtomicRun({ sourceMode: 'manual-builder-input', builderInputFile: source, runDirectory });
    assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
    assert.equal(result.checkpoint.checkpoint_sequence, 1);
    assert.equal(result.checkpoint.parent_checkpoint_id, null);
    assert.equal(result.checkpoint.runtime_state, 'BUILD_ACTIVE');
    assert.equal(result.checkpoint.confirmed_action_ids.length, 0);
    assert.deepEqual(result.checkpoint.unconfirmed_action_ids, result.context.action_batch.action_ids);
    assert.equal(result.session.last_verified_checkpoint.checkpoint_id, result.checkpoint.checkpoint_id);
    assert.equal(validateCanonicalRun(runDirectory, { fullDerivation: true }).passed, true);
  });

  for (const [name, operation] of [
    ['writeStrictRealIntake', writeStrictRealIntake],
    ['publishEmitBatchTransaction', publishEmitBatchTransaction],
    ['publishConfirmationTransaction', publishConfirmationTransaction],
    ['publishStrictRealCompletion', publishStrictRealCompletion]
  ]) {
    test(`legacy ${name} cannot act as real Runtime authority`, () => {
      const result = operation({});
      assert.equal(result.passed, false);
      assert.equal(result.diagnostics[0].code, 'BUILDER-LEGACY-AUTHORITY-INACTIVE');
      assert.equal(result.builder_build_complete, false);
    });
  }
} finally {
  fs.rmSync(TEMP, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Functional correctness tests failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(`Passed ${count - failures.length}/${count} tests.`);
  process.exit(1);
}
console.log(`Functional correctness tests passed: ${count}/${count}.`);
