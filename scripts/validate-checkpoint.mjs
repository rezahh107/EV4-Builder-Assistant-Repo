#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node scripts/validate-checkpoint.mjs <checkpoint.json>');
  process.exit(2);
}

const checkpoint = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
const errors = [];

function fail(message) {
  errors.push(message);
}

function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

if (checkpoint.schema !== 'ev4-builder-checkpoint@0.2.0') {
  console.log(`Checkpoint cross-field validation skipped for legacy schema: ${filePath}`);
  process.exit(0);
}

const assertions = Array.isArray(checkpoint.assertions) ? checkpoint.assertions : [];
const evidenceLedger = Array.isArray(checkpoint.evidence_ledger) ? checkpoint.evidence_ledger : [];
const confirmedActionIds = Array.isArray(checkpoint.confirmed_action_ids) ? checkpoint.confirmed_action_ids : [];
const unconfirmedActionIds = Array.isArray(checkpoint.unconfirmed_action_ids) ? checkpoint.unconfirmed_action_ids : [];

const assertionIds = assertions.map((assertion) => assertion.assertion_id).filter(Boolean);
const evidenceIds = evidenceLedger.map((evidence) => evidence.evidence_id).filter(Boolean);
const assertionIdSet = new Set(assertionIds);
const evidenceById = new Map(evidenceLedger.map((evidence) => [evidence.evidence_id, evidence]));

for (const duplicate of duplicates(assertionIds)) fail(`Duplicate assertion_id: ${duplicate}`);
for (const duplicate of duplicates(evidenceIds)) fail(`Duplicate evidence_id: ${duplicate}`);

for (const actionId of confirmedActionIds) {
  if (unconfirmedActionIds.includes(actionId)) {
    fail(`Action ID appears in both confirmed_action_ids and unconfirmed_action_ids: ${actionId}`);
  }
}

for (const evidence of evidenceLedger) {
  for (const claimId of evidence.supports_claim_ids || []) {
    if (!assertionIdSet.has(claimId)) {
      fail(`Evidence ${evidence.evidence_id} supports unknown assertion_id: ${claimId}`);
    }
  }
}

for (const assertion of assertions) {
  for (const evidenceRef of assertion.evidence_refs || []) {
    const evidence = evidenceById.get(evidenceRef);
    if (!evidence) {
      fail(`Assertion ${assertion.assertion_id} references unknown evidence_id: ${evidenceRef}`);
      continue;
    }
    if (!(evidence.supports_claim_ids || []).includes(assertion.assertion_id)) {
      fail(`Evidence ${evidenceRef} does not support assertion_id ${assertion.assertion_id}.`);
    }
    if (assertion.status === 'confirmed' && evidence.status !== 'available') {
      fail(`Confirmed assertion ${assertion.assertion_id} references non-available evidence ${evidenceRef}.`);
    }
  }

  if (assertion.status === 'confirmed' && (!Array.isArray(assertion.evidence_refs) || assertion.evidence_refs.length === 0)) {
    fail(`Confirmed assertion ${assertion.assertion_id} must include evidence_refs.`);
  }
}

if (errors.length > 0) {
  console.error(`Checkpoint cross-field validation failed for ${filePath}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Checkpoint cross-field validation passed: ${filePath}`);
