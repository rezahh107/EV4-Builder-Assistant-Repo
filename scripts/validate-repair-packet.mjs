#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node scripts/validate-repair-packet.mjs <repair-packet.json>');
  process.exit(2);
}

const repair = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
const errors = [];

const DIAGNOSTICS = {
  SELECTED_CANDIDATE_CHANGED: ['EV4-REPAIR-001', 'SELECTED_CANDIDATE_CHANGED'],
  PRODUCTION_READY_TRUE: ['EV4-REPAIR-002', 'PRODUCTION_READY_TRUE'],
  CONFIRMED_WORK_WITHOUT_EVIDENCE: ['EV4-REPAIR-003', 'CONFIRMED_WORK_WITHOUT_EVIDENCE'],
  REPAIR_RESUME_CONDITION_MISSING: ['EV4-REPAIR-004', 'REPAIR_RESUME_CONDITION_MISSING'],
  ROOT_FIX_SCOPE_MISSING: ['EV4-REPAIR-005', 'ROOT_FIX_SCOPE_MISSING'],
  ROLLBACK_SCOPE_MISSING: ['EV4-REPAIR-006', 'ROLLBACK_SCOPE_MISSING'],
  NORMAL_BATCH_RESUME_UNSAFE: ['EV4-REPAIR-007', 'NORMAL_BATCH_RESUME_UNSAFE']
};

function fail(diag, message) {
  const [id, name] = diag;
  errors.push({ id, name, message });
}

if (repair.production_ready !== false) {
  fail(DIAGNOSTICS.PRODUCTION_READY_TRUE, 'Repair packets must keep production_ready false.');
}

if (
  repair.selected_candidate_id &&
  repair.last_safe_checkpoint?.selected_candidate_id &&
  repair.selected_candidate_id !== repair.last_safe_checkpoint.selected_candidate_id
) {
  fail(
    DIAGNOSTICS.SELECTED_CANDIDATE_CHANGED,
    `selected_candidate_id ${repair.selected_candidate_id} differs from last_safe_checkpoint.selected_candidate_id ${repair.last_safe_checkpoint.selected_candidate_id}.`
  );
}

for (const collectionName of ['confirmed_work', 'still_valid_work']) {
  for (const item of repair[collectionName] || []) {
    if (
      (item.status === 'confirmed' || item.status === 'still_valid') &&
      (!Array.isArray(item.evidence_refs) || item.evidence_refs.length === 0)
    ) {
      fail(
        DIAGNOSTICS.CONFIRMED_WORK_WITHOUT_EVIDENCE,
        `${collectionName}.${item.work_id || '<unknown>'} is ${item.status} but has no evidence_refs.`
      );
    }
  }
}

const hasResumeToken = typeof repair.resume_condition?.expected_user_token === 'string' && repair.resume_condition.expected_user_token.length > 0;
const hasBlockingScreenshot =
  repair.resume_condition?.required_screenshot?.required === true &&
  typeof repair.resume_condition.required_screenshot.target === 'string' &&
  repair.resume_condition.required_screenshot.target.length > 0;

if (!hasResumeToken && !hasBlockingScreenshot) {
  fail(
    DIAGNOSTICS.REPAIR_RESUME_CONDITION_MISSING,
    'Repair packet must require a repair-specific expected_user_token or a targeted screenshot before resume.'
  );
}

if (hasResumeToken && /^تایید BATCH-/u.test(repair.resume_condition.expected_user_token)) {
  fail(
    DIAGNOSTICS.NORMAL_BATCH_RESUME_UNSAFE,
    'Repair resume token must be repair-specific, not a normal BATCH confirmation token.'
  );
}

if (
  repair.root_fix_required?.value === true &&
  (!Array.isArray(repair.root_fix_required.repo_scope) || repair.root_fix_required.repo_scope.length === 0)
) {
  fail(DIAGNOSTICS.ROOT_FIX_SCOPE_MISSING, 'root_fix_required.value true requires at least one repo_scope entry.');
}

if (
  repair.trigger?.type === 'root_pipeline_gap' &&
  repair.root_fix_required?.value !== true
) {
  fail(DIAGNOSTICS.ROOT_FIX_SCOPE_MISSING, 'trigger.type root_pipeline_gap requires root_fix_required.value true.');
}

if (
  repair.rollback_required?.value === true &&
  (!Array.isArray(repair.invalid_or_unverified_work) || repair.invalid_or_unverified_work.length === 0)
) {
  fail(DIAGNOSTICS.ROLLBACK_SCOPE_MISSING, 'rollback_required.value true requires invalid_or_unverified_work entries.');
}

if (errors.length > 0) {
  console.error(`Repair packet validation failed for ${filePath}:`);
  for (const error of errors) console.error(`- ${error.id} ${error.name}: ${error.message}`);
  process.exit(1);
}

console.log(`Repair packet validation passed: ${filePath}`);
