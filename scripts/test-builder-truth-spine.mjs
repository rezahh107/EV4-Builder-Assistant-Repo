#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  fixtureValidateBuilderInput,
  createConfirmationReceipt,
  writeConfirmationReceipt,
  validateConfirmationReceipt,
  verifyEvidenceLedger,
  validateRealCompletion,
  publishRealCompletion,
  resolveRealBuilderSource
} from './lib/builder-truth-spine.mjs';
import { writeRealIntake } from './lib/builder-explicit-source-runtime.mjs';
import { publishStrictRealCompletion } from './lib/builder-functional-correctness.mjs';
import { CANONICAL_REAL_OPERATIONS } from './lib/runtime/canonical-run-runtime.mjs';

const ROOT = process.cwd();
const fixture = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'builder_context_package.json');
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

function assertInactive(result) {
  assert.equal(result.passed, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.builder_build_complete, false);
  assert.equal(result.responsive_complete, false);
  assert.equal(result.production_ready, false);
  assert.equal(result.diagnostics?.[0]?.code, 'BUILDER-LEGACY-AUTHORITY-INACTIVE');
}

test('fixture validation remains non-authoritative', () => {
  const result = fixtureValidateBuilderInput(fixture);
  assert.equal(result.status, 'accepted');
  assert.equal(result.runtime_mode, 'fixture-validation');
  assert.equal(result.builder_build_complete, false);
  assert.equal(result.runtime_state, 'NOT_A_REAL_RUN');
});

test('canonical real operations are exactly Run-directory operations', () => {
  assert.deepEqual(CANONICAL_REAL_OPERATIONS, ['real-intake', 'emit-batch', 'confirm-batch', 'attach-evidence', 'real-completion']);
});

for (const [name, fn] of Object.entries({
  createConfirmationReceipt,
  writeConfirmationReceipt,
  validateConfirmationReceipt,
  verifyEvidenceLedger,
  validateRealCompletion,
  publishRealCompletion,
  resolveRealBuilderSource,
  writeRealIntake,
  publishStrictRealCompletion
})) {
  test(`${name} is inactive as real Runtime authority`, () => assertInactive(fn({})));
}

if (failures.length) {
  console.error('Builder truth-spine tests failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Passed ${count - failures.length}/${count} tests.`);
  process.exit(1);
}
console.log(`Builder truth-spine tests passed: ${count}/${count}.`);
