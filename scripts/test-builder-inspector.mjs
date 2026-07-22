#!/usr/bin/env node
import { createHarness, finishHarness } from './test-runtime-engine-support.mjs';
import { testInputAndTransitions } from './test-runtime-input-transition.mjs';
import { testLedgerScopeAndGate } from './test-runtime-ledger-completion.mjs';
import { testCliAndAtomicity } from './test-runtime-cli-atomic.mjs';

const harness = createHarness();
try {
  testInputAndTransitions(harness);
  testLedgerScopeAndGate(harness);
  testCliAndAtomicity(harness);
  finishHarness(harness);
} catch (error) {
  console.error('Canonical Runtime Transaction Engine tests failed:');
  console.error(error.message);
  process.exit(1);
}
console.log('Canonical Runtime Transaction Engine intake, transition, Resume, Completion, Ledger, Scope, Gate, mutation, replay, and atomic-publication tests passed.');
