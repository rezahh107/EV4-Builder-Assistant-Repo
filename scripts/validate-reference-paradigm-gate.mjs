#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

export const REFERENCE_PARADIGM_DIAGNOSTICS = {
  MISSING_PARADIGM_LOCK: ['EV4-RPG-001', 'blocked_missing_paradigm_lock'],
  UNLOCKED_PARADIGM: ['EV4-RPG-002', 'blocked_unlocked_paradigm'],
  MISSING_STRUCTURE_MAP: ['EV4-RPG-003', 'blocked_missing_paradigm_structure_map'],
  UNSTRUCTURED_VISUAL_REFERENCE: ['EV4-RPG-004', 'blocked_reference_visual_expected_but_unstructured'],
  FIRST_BATCH_PARADIGM_MISMATCH: ['EV4-RPG-005', 'blocked_first_batch_paradigm_mismatch']
};

function textOfBatch(firstBuilderBatch = {}) {
  return (firstBuilderBatch.actions || [])
    .flatMap((action) => [action.target_element, action.parent, action.element_type, action.structure_panel_name, action.instruction, action.expected_result])
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

export function requiresReferenceParadigmGate(pkg) {
  return pkg?.visual_reference_present === true && pkg?.visual_parity_expected === true && pkg?.task_type !== 'pure_execution';
}

export function validateReferenceParadigmGate(pkg) {
  const diagnostics = [];
  const add = (diag, message) => diagnostics.push({ id: diag[0], name: diag[1], message });
  if (!requiresReferenceParadigmGate(pkg)) return diagnostics;

  if (pkg.reference_artifact_type === 'image_only' || pkg.reference_artifact_type === 'screenshot_only') {
    add(REFERENCE_PARADIGM_DIAGNOSTICS.UNSTRUCTURED_VISUAL_REFERENCE, 'visual reference cannot enter Builder as an image-only or screenshot-only artifact.');
  }

  const lock = pkg.reference_paradigm_lock;
  const map = pkg.paradigm_to_structure_map;

  if (!lock) add(REFERENCE_PARADIGM_DIAGNOSTICS.MISSING_PARADIGM_LOCK, 'visual parity package requires reference_paradigm_lock before BATCH-001.');
  else {
    if (lock.paradigm_locked !== true || lock.extracted_by !== 'constructability_engineer' || !Array.isArray(lock.completion_signature) || lock.completion_signature.length === 0) {
      add(REFERENCE_PARADIGM_DIAGNOSTICS.UNLOCKED_PARADIGM, 'reference_paradigm_lock must be locked by constructability_engineer with a non-empty completion_signature.');
    }
  }

  if (!map) add(REFERENCE_PARADIGM_DIAGNOSTICS.MISSING_STRUCTURE_MAP, 'visual parity package requires paradigm_to_structure_map before BATCH-001.');
  if (!lock || !map) return diagnostics;

  if (lock.connector_model && !map.connector_layer) {
    add(REFERENCE_PARADIGM_DIAGNOSTICS.MISSING_STRUCTURE_MAP, 'connector references require paradigm_to_structure_map.connector_layer.');
  }

  const batchText = textOfBatch(pkg.first_builder_batch);
  const req = map.first_batch_requirements || {};
  const forbiddenStarts = Array.isArray(req.forbidden_composition_starts) ? req.forbidden_composition_starts : [];

  if (lock.distribution_model === '3-left-3-right' && hasAny(batchText, ['vertical feature group', 'vertical feature list', 'single vertical', 'vertical stack']) && !hasAny(batchText, ['left region', 'right region', 'left/right', '3-left-3-right'])) {
    add(REFERENCE_PARADIGM_DIAGNOSTICS.FIRST_BATCH_PARADIGM_MISMATCH, 'first_builder_batch starts a vertical list instead of the locked 3-left-3-right distribution.');
  }
  if (lock.repeated_unit_form === 'pill-card' && hasAny(batchText, ['floating text/icon', 'floating text', 'floating icon']) && !hasAny(batchText, ['pill-card', 'pill card', 'card container'])) {
    add(REFERENCE_PARADIGM_DIAGNOSTICS.FIRST_BATCH_PARADIGM_MISMATCH, 'first_builder_batch starts floating text/icon units instead of pill-card containers.');
  }
  if ((lock.primary_anchor === 'house-center' || req.must_establish_primary_anchor === true) && !hasAny(batchText, ['house-center', 'house center', 'central house', 'primary anchor', 'center anchor'])) {
    add(REFERENCE_PARADIGM_DIAGNOSTICS.FIRST_BATCH_PARADIGM_MISMATCH, 'first_builder_batch does not establish or stage the central house primary anchor.');
  }
  if (lock.connector_model === 'card-edge-to-house-edge' && hasAny(batchText, ['floating line', 'floating connector', 'unrelated to cards', 'near text']) && !hasAny(batchText, ['card-edge-to-house-edge', 'card edge', 'house edge'])) {
    add(REFERENCE_PARADIGM_DIAGNOSTICS.FIRST_BATCH_PARADIGM_MISMATCH, 'first_builder_batch connector strategy conflicts with card-edge-to-house-edge.');
  }
  for (const forbidden of forbiddenStarts) {
    if (typeof forbidden === 'string' && forbidden && batchText.includes(forbidden.toLowerCase())) {
      add(REFERENCE_PARADIGM_DIAGNOSTICS.FIRST_BATCH_PARADIGM_MISMATCH, `first_builder_batch includes forbidden composition start: ${forbidden}.`);
    }
  }

  return diagnostics;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/validate-reference-paradigm-gate.mjs <builder_context_package.json>');
    process.exit(2);
  }
  const pkg = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  const diagnostics = validateReferenceParadigmGate(pkg);
  if (diagnostics.length > 0) {
    console.error(`Reference Paradigm Gate failed for ${filePath}:`);
    for (const diag of diagnostics) console.error(`- ${diag.id} ${diag.name}: ${diag.message}`);
    process.exit(1);
  }
  console.log(`Reference Paradigm Gate passed: ${filePath}`);
}
