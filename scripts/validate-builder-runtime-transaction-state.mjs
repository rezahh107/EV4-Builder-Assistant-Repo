#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const fixturePath = path.resolve('tests/valid/runtime-transaction/complete-transaction.json');
const tx = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const errors = [];

if (tx.fixture_classification !== 'synthetic_validation_only') {
  errors.push('BUILDER-TRX-014: transaction evidence fixture must be explicitly labeled synthetic_validation_only.');
}
if (tx.source?.provenance?.verified === true && tx.fixture_classification !== 'synthetic_validation_only') {
  errors.push('BUILDER-TRX-001: synthetic provenance must not be presented as real runtime evidence.');
}
if (tx.completion?.session_complete === true && tx.completion?.final_session_runtime_state !== 'COMPLETED') {
  errors.push('BUILDER-TRX-011: session completion requires final_session_runtime_state COMPLETED.');
}
if (tx.completion?.build_complete === true && tx.completion?.session_complete !== true) {
  errors.push('BUILDER-TRX-011: build completion requires session completion.');
}

if (errors.length > 0) {
  console.error(`Builder runtime transaction state validation failed: ${fixturePath}`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Builder runtime transaction state validation passed: ${fixturePath}`);
