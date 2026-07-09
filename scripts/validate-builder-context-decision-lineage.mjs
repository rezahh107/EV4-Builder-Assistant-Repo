#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_LINEAGE_FIELDS = [
  'decision_family',
  'decision_card_ref',
  'selected_option',
  'rejected_options',
  'evidence_refs',
  'evidence_state',
  'consumer_stage'
];

const DIAGNOSTICS = {
  MISSING_LINEAGE: ['EV4-PKG-020', 'MISSING_INTAKE_DECISION_LINEAGE'],
  INCOMPLETE_LINEAGE: ['EV4-PKG-021', 'INCOMPLETE_INTAKE_DECISION_LINEAGE'],
  DUPLICATE_LINEAGE: ['EV4-PKG-022', 'DUPLICATE_INTAKE_DECISION_LINEAGE']
};

const DEFAULT_VALID_FIXTURES = [
  'tests/valid/builder_context_package_with_decision_lineage.json'
];

const DEFAULT_INVALID_FIXTURES = [
  'tests/invalid/lineage-intake/builder_context_package_kernel_lineage_missing.json'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0 && value.every(hasValue);
  return value !== undefined && value !== null && String(value).length > 0;
}

function requiresKernelLineage(pkg) {
  return (pkg.source_payload_ledger || []).some((entry) => (
    entry?.payload_name === 'Kernel_Decision_Lineage' ||
    entry?.schema === 'ev4-kernel-decision-lineage@1.0.0'
  ));
}

function validateLineageRecord(record, errors, location) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    errors.push({ diag: DIAGNOSTICS.MISSING_LINEAGE, message: `${location} must be a decision lineage object.` });
    return false;
  }

  let valid = true;
  for (const field of REQUIRED_LINEAGE_FIELDS) {
    if (!hasValue(record[field])) {
      errors.push({ diag: DIAGNOSTICS.INCOMPLETE_LINEAGE, message: `${location}.${field} is required and must be non-empty.` });
      valid = false;
    }
  }

  if (record.consumer_stage !== 'builder') {
    errors.push({ diag: DIAGNOSTICS.INCOMPLETE_LINEAGE, message: `${location}.consumer_stage must be builder.` });
    valid = false;
  }

  return valid;
}

function validatePackage(pkg, filePath) {
  const errors = [];
  const lineage = Array.isArray(pkg.decision_lineage) ? pkg.decision_lineage : [];

  if (requiresKernelLineage(pkg) && lineage.length === 0) {
    errors.push({
      diag: DIAGNOSTICS.MISSING_LINEAGE,
      message: 'Builder_Context_Package declares Kernel_Decision_Lineage in source_payload_ledger but does not carry top-level decision_lineage.'
    });
  }

  const seenDecisionCards = new Set();
  lineage.forEach((record, index) => {
    const location = `decision_lineage[${index}]`;
    if (!validateLineageRecord(record, errors, location)) return;

    if (seenDecisionCards.has(record.decision_card_ref)) {
      errors.push({ diag: DIAGNOSTICS.DUPLICATE_LINEAGE, message: `${location}.decision_card_ref duplicates ${record.decision_card_ref}.` });
      return;
    }
    seenDecisionCards.add(record.decision_card_ref);
  });

  if (errors.length > 0) {
    console.error(`Builder context decision-lineage validation failed for ${filePath}:`);
    for (const error of errors) {
      const [id, name] = error.diag;
      console.error(`- ${id} ${name}: ${error.message}`);
    }
    return false;
  }

  console.log(`Builder context decision-lineage validation passed: ${filePath}`);
  return true;
}

function runValidFixtures(files) {
  let ok = true;
  for (const filePath of files) ok = validatePackage(readJson(filePath), filePath) && ok;
  return ok;
}

function runInvalidFixtures(files) {
  let ok = true;
  for (const filePath of files) {
    if (validatePackage(readJson(filePath), filePath)) {
      console.error(`Invalid Builder context lineage fixture unexpectedly passed: ${filePath}`);
      ok = false;
    } else {
      console.log(`Invalid Builder context lineage fixture correctly failed: ${filePath}`);
    }
  }
  return ok;
}

const args = process.argv.slice(2);
let ok;
if (args.length === 0) {
  ok = runValidFixtures(DEFAULT_VALID_FIXTURES) && runInvalidFixtures(DEFAULT_INVALID_FIXTURES);
} else {
  ok = runValidFixtures(args);
}

if (!ok) process.exit(1);
