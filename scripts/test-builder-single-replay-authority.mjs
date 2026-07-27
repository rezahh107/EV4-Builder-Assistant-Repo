#!/usr/bin/env node
import assert from 'node:assert/strict';

import * as stateStore from './lib/runtime/run-state-store.mjs';
import {
  executePlannedMutation,
  validateCommittedTransitionHistory,
  verifyCommittedTransitionReplay
} from './lib/runtime/committed-transition-replay.mjs';

assert.equal(
  Object.hasOwn(stateStore, 'detectCommittedTransitionReplay'),
  false,
  'Callback-based selected-field replay authority must not be exported.'
);
assert.equal(typeof stateStore.deriveExpectedSuccessorSnapshot, 'function');
assert.equal(typeof stateStore.publishSuccessor, 'function');
assert.equal(typeof verifyCommittedTransitionReplay, 'function');
assert.equal(typeof executePlannedMutation, 'function');
assert.equal(typeof validateCommittedTransitionHistory, 'function');

console.log('Single deterministic committed replay authority validation passed.');
