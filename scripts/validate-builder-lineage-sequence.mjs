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
  MISSING_LINEAGE: ['EV4-LINEAGE-001', 'MISSING_DECISION_LINEAGE'],
  INCOMPLETE_LINEAGE: ['EV4-LINEAGE-002', 'INCOMPLETE_DECISION_LINEAGE'],
  UNKNOWN_LINEAGE_REF: ['EV4-LINEAGE-003', 'UNKNOWN_DECISION_LINEAGE_REF'],
  LINEAGE_REPLACED: ['EV4-LINEAGE-004', 'DECISION_LINEAGE_REPLACED'],
  LINEAGE_DROPPED: ['EV4-LINEAGE-005', 'DECISION_LINEAGE_DROPPED'],
  FALLBACK_WITHOUT_LINEAGE: ['EV4-LINEAGE-006', 'FALLBACK_WITHOUT_DECISION_LINEAGE']
};

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/validate-builder-lineage-sequence.mjs <sequence-fixture.json> [more-fixtures...]');
  process.exit(2);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function lineageKey(lineage) {
  return [
    lineage.decision_family,
    lineage.decision_card_ref,
    lineage.selected_option,
    JSON.stringify(lineage.rejected_options),
    JSON.stringify(lineage.evidence_refs),
    lineage.evidence_state
  ].join('|');
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0 && value.every(hasValue);
  return value !== undefined && value !== null && String(value).length > 0;
}

function validateLineageObject(lineage, errors, location) {
  if (!lineage || typeof lineage !== 'object' || Array.isArray(lineage)) {
    errors.push({ diag: DIAGNOSTICS.MISSING_LINEAGE, message: `${location} must carry decision_lineage.` });
    return false;
  }

  let valid = true;
  for (const field of REQUIRED_LINEAGE_FIELDS) {
    if (!hasValue(lineage[field])) {
      errors.push({ diag: DIAGNOSTICS.INCOMPLETE_LINEAGE, message: `${location}.decision_lineage.${field} is required and must be non-empty.` });
      valid = false;
    }
  }

  if (lineage.consumer_stage !== 'builder') {
    errors.push({ diag: DIAGNOSTICS.INCOMPLETE_LINEAGE, message: `${location}.decision_lineage.consumer_stage must be builder.` });
    valid = false;
  }

  return valid;
}

function getLineage(item) {
  if (item?.decision_lineage) return item.decision_lineage;
  if (item?.decision_lineage_ref) return item.decision_lineage_ref;
  return null;
}

function validateSequence(sequence, filePath) {
  const errors = [];
  const intakeLineage = new Map();
  const actionLineageRefs = new Map();

  for (const [index, record] of (sequence.builder_intake?.decision_lineage || []).entries()) {
    const location = `builder_intake.decision_lineage[${index}]`;
    if (validateLineageObject(record, errors, location)) {
      intakeLineage.set(record.decision_card_ref, record);
    }
  }

  if (intakeLineage.size === 0) {
    errors.push({ diag: DIAGNOSTICS.MISSING_LINEAGE, message: 'builder_intake.decision_lineage must include at least one complete Kernel-governed decision record.' });
  }

  for (const [index, action] of (sequence.builder_action_output?.actions || []).entries()) {
    const location = `builder_action_output.actions[${index}]`;
    const lineage = getLineage(action);
    if (!validateLineageObject(lineage, errors, location)) continue;

    const upstream = intakeLineage.get(lineage.decision_card_ref);
    if (!upstream) {
      errors.push({ diag: DIAGNOSTICS.UNKNOWN_LINEAGE_REF, message: `${location} references decision_card_ref ${lineage.decision_card_ref} that is not present in intake lineage.` });
      continue;
    }

    actionLineageRefs.set(lineage.decision_card_ref, lineage);
    if (lineageKey(lineage) !== lineageKey(upstream)) {
      errors.push({ diag: DIAGNOSTICS.LINEAGE_REPLACED, message: `${location} changed upstream decision lineage for ${lineage.decision_card_ref}.` });
    }
  }

  for (const decisionCardRef of intakeLineage.keys()) {
    if (!actionLineageRefs.has(decisionCardRef)) {
      errors.push({ diag: DIAGNOSTICS.LINEAGE_DROPPED, message: `builder_action_output dropped intake decision lineage ${decisionCardRef}.` });
    }
  }

  for (const [index, attempt] of (sequence.builder_fallback_attempts || []).entries()) {
    const location = `builder_fallback_attempts[${index}]`;
    const lineage = getLineage(attempt);
    if (!validateLineageObject(lineage, errors, location)) {
      errors.push({ diag: DIAGNOSTICS.FALLBACK_WITHOUT_LINEAGE, message: `${location} cannot be used as an unrecorded Builder design decision.` });
      continue;
    }

    const upstream = intakeLineage.get(lineage.decision_card_ref);
    if (!upstream || lineageKey(lineage) !== lineageKey(upstream)) {
      errors.push({ diag: DIAGNOSTICS.FALLBACK_WITHOUT_LINEAGE, message: `${location} must preserve an existing upstream decision lineage record.` });
    }
  }

  if (errors.length > 0) {
    console.error(`Builder lineage sequence validation failed for ${filePath}:`);
    for (const error of errors) {
      const [id, name] = error.diag;
      console.error(`- ${id} ${name}: ${error.message}`);
    }
    return false;
  }

  console.log(`Builder lineage sequence validation passed: ${filePath}`);
  return true;
}

let ok = true;
for (const filePath of args) {
  ok = validateSequence(readJson(filePath), filePath) && ok;
}

if (!ok) process.exit(1);
