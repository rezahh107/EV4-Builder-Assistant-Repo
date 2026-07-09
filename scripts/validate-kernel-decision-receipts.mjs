#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  SUCCESS_RECEIPT_TEXT,
  WARNING_RECEIPT_TEXT,
  FALLBACK_WARNING_RECEIPT_TEXT,
  formatKernelDecisionReceipt,
  isCompleteBuilderKernelTrace,
  missingKernelTraceFields
} from './format-kernel-decision-receipt.mjs';

const RECEIPT_SCHEMA = 'schemas/kernel-decision-receipt.schema.json';

const VALID_FIXTURES = [
  'tests/valid/kernel_decision_receipt_builder_action_success.json',
  'tests/valid/kernel_decision_receipt_intake_warning_missing_card.json',
  'tests/valid/kernel_decision_receipt_fallback_warning_untraced.json',
  'tests/valid/kernel_decision_receipt_repair_packet_fallback_warning.json',
  'tests/valid/kernel_decision_receipt_warning_missing_fields_unordered.json'
];

const INVALID_FIXTURES = [
  'tests/invalid/kernel-receipts/success_missing_decision_card_ref.json',
  'tests/invalid/kernel-receipts/success_missing_evidence_refs.json',
  'tests/invalid/kernel-receipts/action_success_without_trace.json',
  'tests/invalid/kernel-receipts/fallback_success_without_trace.json',
  'tests/invalid/kernel-receipts/receipt_claims_builder_design_authority.json',
  'tests/invalid/kernel-receipts/malformed_trace_rejected_options_string.json',
  'tests/invalid/kernel-receipts/malformed_trace_evidence_refs_string.json',
  'tests/invalid/kernel-receipts/malformed_trace_decision_family_object.json',
  'tests/invalid/kernel-receipts/malformed_trace_empty_arrays.json',
  'tests/invalid/kernel-receipts/malformed_trace_array_contains_empty_or_non_string.json'
];

const EXPECTED_NON_CLAIMS = [
  'builder_design_authority_claimed',
  'builder_execution_proof_claimed',
  'downstream_enforcement_claimed',
  'production_readiness_claimed',
  'enforcement_status_upgrade_claimed'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function add(errors, id, message) {
  errors.push({ id, message });
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function sortedUnique(values) {
  return [...new Set(values || [])].sort();
}

function sameStringSet(a, b) {
  return JSON.stringify(sortedUnique(a)) === JSON.stringify(sortedUnique(b));
}

function assertBaseReceipt(receipt, errors) {
  if (receipt.schema !== 'ev4-builder-kernel-decision-receipt@0.1.0') add(errors, 'EV4-RECEIPT-001', 'unexpected receipt schema.');
  if (receipt.wave !== 5) add(errors, 'EV4-RECEIPT-002', 'receipt must be Wave 5.');
  if (receipt.source_of_truth !== 'machine_readable_decision_trace') add(errors, 'EV4-RECEIPT-003', 'receipt must keep machine-readable decision trace as the source of truth.');
  if (receipt.wave_boundary !== 'presentation_layer_only') add(errors, 'EV4-RECEIPT-004', 'Wave 5 receipt must be presentation-layer only.');
  if (hasOwn(receipt, 'resolved') || hasOwn(receipt, 'authored_resolved')) add(errors, 'EV4-RECEIPT-005', 'receipt must not add authored resolved fields.');
  if (hasOwn(receipt, 'production_ready') || hasOwn(receipt, 'authored_production_ready')) add(errors, 'EV4-RECEIPT-006', 'receipt must not add authored production_ready fields.');

  const nonClaims = receipt.non_claims || {};
  for (const field of EXPECTED_NON_CLAIMS) {
    if (nonClaims[field] !== false) add(errors, 'EV4-RECEIPT-007', `non_claims.${field} must be false.`);
  }
}

function assertNoAuthorityLanguage(receipt, errors) {
  const text = String(receipt.receipt_text || '');
  if ([SUCCESS_RECEIPT_TEXT, WARNING_RECEIPT_TEXT, FALLBACK_WARNING_RECEIPT_TEXT].includes(text)) return;
  const forbidden = [
    /Builder\s+(chose|selected|decided|approved|proved)/i,
    /new\s+design\s+decision/i,
    /production\s+ready/i,
    /downstream\s+enforced/i,
    /تصمیم\s+جدید/,
    /آماده\s+تولید/,
    /اثبات\s+اجرا/
  ];
  if (forbidden.some((pattern) => pattern.test(text))) {
    add(errors, 'EV4-RECEIPT-008', 'receipt text must not claim Builder design authority, execution proof, downstream enforcement, or production readiness.');
  }
}

function assertSuccessReceipt(receipt, errors) {
  if (receipt.receipt_text !== SUCCESS_RECEIPT_TEXT) add(errors, 'EV4-RECEIPT-010', 'success receipt text must match the Builder Wave 5 success pattern.');
  if (receipt.source_trace_state !== 'complete') add(errors, 'EV4-RECEIPT-011', 'success receipt requires complete source_trace_state.');
  if (!isCompleteBuilderKernelTrace(receipt.decision_trace)) add(errors, 'EV4-RECEIPT-012', 'success receipt requires complete validated Builder machine trace.');
  if ((receipt.missing_trace_fields || []).length !== 0) add(errors, 'EV4-RECEIPT-013', 'success receipt must not list missing trace fields.');
}

function assertWarningReceipt(receipt, errors) {
  if (receipt.receipt_text !== WARNING_RECEIPT_TEXT) add(errors, 'EV4-RECEIPT-020', 'warning receipt text must match the Builder Wave 5 warning pattern.');
  if (receipt.source_trace_state === 'complete') add(errors, 'EV4-RECEIPT-021', 'warning receipt must not claim complete source trace.');
  if ((receipt.missing_trace_fields || []).length === 0) add(errors, 'EV4-RECEIPT-022', 'warning receipt must list missing trace fields.');
  if (isCompleteBuilderKernelTrace(receipt.decision_trace)) add(errors, 'EV4-RECEIPT-023', 'complete validated trace should produce success, not warning.');
}

function assertFallbackWarningReceipt(receipt, errors) {
  if (receipt.receipt_text !== FALLBACK_WARNING_RECEIPT_TEXT) add(errors, 'EV4-RECEIPT-030', 'fallback warning text must match the Builder Wave 5 fallback warning pattern.');
  if (!['fallback', 'repair_packet'].includes(receipt.surface)) add(errors, 'EV4-RECEIPT-031', 'fallback warning is allowed only on fallback or repair_packet surfaces.');
  if (receipt.source_trace_state === 'complete') add(errors, 'EV4-RECEIPT-032', 'fallback warning must not claim complete source trace.');
  if ((receipt.missing_trace_fields || []).length === 0) add(errors, 'EV4-RECEIPT-033', 'fallback warning must list missing trace fields.');
}

function assertFormatterAgreement(receipt, errors) {
  const expected = formatKernelDecisionReceipt({
    surface: receipt.surface,
    decision_trace: receipt.decision_trace ?? null,
    fallback: receipt.receipt_status === 'fallback_warning'
  });
  if (expected.surface !== receipt.surface) add(errors, 'EV4-RECEIPT-039', 'fixture surface disagrees with formatter output.');
  if (expected.receipt_status !== receipt.receipt_status) add(errors, 'EV4-RECEIPT-040', 'fixture receipt_status disagrees with formatter output.');
  if (expected.receipt_text !== receipt.receipt_text) add(errors, 'EV4-RECEIPT-041', 'fixture receipt_text disagrees with formatter output.');
  const expectedMissing = missingKernelTraceFields(receipt.decision_trace ?? null);
  if (!sameStringSet(expectedMissing, receipt.missing_trace_fields || [])) {
    add(errors, 'EV4-RECEIPT-042', 'missing_trace_fields must be derived from decision_trace, not authored independently.');
  }
}

export function validateReceipt(receipt) {
  const errors = [];
  assertBaseReceipt(receipt, errors);
  assertNoAuthorityLanguage(receipt, errors);

  if (receipt.receipt_status === 'success') assertSuccessReceipt(receipt, errors);
  else if (receipt.receipt_status === 'warning') assertWarningReceipt(receipt, errors);
  else if (receipt.receipt_status === 'fallback_warning') assertFallbackWarningReceipt(receipt, errors);
  else add(errors, 'EV4-RECEIPT-050', 'unknown receipt_status.');

  assertFormatterAgreement(receipt, errors);
  return errors;
}

function runAjv(filePath, expectedValid) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, [
    '--yes',
    'ajv-cli@5',
    'validate',
    '--spec=draft2020',
    '--strict=false',
    '-s',
    RECEIPT_SCHEMA,
    '-d',
    filePath
  ], { encoding: 'utf8' });

  const passed = result.status === 0;
  if (result.error) {
    console.error(`Failed to execute ${command}: ${result.error.message}`);
    return false;
  }

  if (passed === expectedValid) {
    console.log(`AJV receipt schema ${expectedValid ? 'accepted' : 'rejected'} fixture as expected: ${filePath}`);
    return true;
  }

  console.error(`AJV receipt schema ${expectedValid ? 'rejected valid' : 'accepted invalid'} fixture unexpectedly: ${filePath}`);
  if (result.stdout) console.error(result.stdout.trim());
  if (result.stderr) console.error(result.stderr.trim());
  return false;
}

function runExpectedValid(files) {
  let ok = true;
  for (const filePath of files) {
    ok = runAjv(filePath, true) && ok;
    const errors = validateReceipt(readJson(filePath));
    if (errors.length > 0) {
      console.error(`Kernel decision receipt validation failed for valid fixture ${filePath}:`);
      for (const error of errors) console.error(`- ${error.id}: ${error.message}`);
      ok = false;
    } else {
      console.log(`Kernel decision receipt valid fixture passed: ${filePath}`);
    }
  }
  return ok;
}

function runExpectedInvalid(files) {
  let ok = true;
  for (const filePath of files) {
    ok = runAjv(filePath, false) && ok;
    const errors = validateReceipt(readJson(filePath));
    if (errors.length === 0) {
      console.error(`Invalid Kernel decision receipt unexpectedly passed custom validation: ${filePath}`);
      ok = false;
    } else {
      console.log(`Invalid Kernel decision receipt correctly failed custom validation: ${filePath}`);
    }
  }
  return ok;
}

const args = process.argv.slice(2);
let ok;
if (args.length > 0) ok = runExpectedValid(args);
else ok = runExpectedValid(VALID_FIXTURES) && runExpectedInvalid(INVALID_FIXTURES);

if (!ok) process.exit(1);
