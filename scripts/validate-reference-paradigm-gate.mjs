#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

export const REFERENCE_PARADIGM_DIAGNOSTICS = {
  MISSING_PARADIGM_LOCK: ['EV4-RPG-001', 'blocked_missing_paradigm_lock'],
  UNLOCKED_PARADIGM: ['EV4-RPG-002', 'blocked_unlocked_paradigm'],
  MISSING_STRUCTURE_MAP: ['EV4-RPG-003', 'blocked_missing_paradigm_structure_map'],
  UNSTRUCTURED_VISUAL_REFERENCE: ['EV4-RPG-004', 'blocked_reference_visual_expected_but_unstructured'],
  FIRST_BATCH_PARADIGM_MISMATCH: ['EV4-RPG-005', 'blocked_first_batch_paradigm_mismatch'],
  MISSING_FIRST_BATCH_STRUCTURE_INTENT: ['EV4-RPG-006', 'blocked_missing_first_batch_structure_intent'],
  FIRST_BATCH_STRUCTURE_INTENT_MISMATCH: ['EV4-RPG-007', 'blocked_first_batch_structure_intent_mismatch']
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

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNoneString(value) {
  return isNonEmptyString(value) && value !== 'none';
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function hasStructuredParadigmMap(map) {
  return (
    isObject(map) &&
    isNonEmptyString(map.primary_anchor) &&
    isNonEmptyStringArray(map.regions) &&
    isNonEmptyStringArray(map.repeated_units) &&
    isObject(map.first_batch_requirements)
  );
}

function hasStructuredFirstBatchIntent(intent) {
  return (
    isObject(intent) &&
    typeof intent.primary_anchor_staged === 'boolean' &&
    isNonEmptyString(intent.primary_anchor) &&
    isNonEmptyString(intent.distribution_model) &&
    isNonEmptyString(intent.repeated_unit_form) &&
    isNonEmptyString(intent.region_model) &&
    Number.isInteger(intent.left_region_count) &&
    Number.isInteger(intent.right_region_count) &&
    isNonEmptyString(intent.connector_strategy) &&
    typeof intent.connector_layer_staged === 'boolean' &&
    typeof intent.forbidden_composition_start === 'boolean'
  );
}

function normalizedTerms(values = []) {
  return values
    .filter((value) => typeof value === 'string')
    .map((value) => value.toLowerCase());
}

function hasRegionModel(map, model) {
  if (model !== 'left-center-right') return false;
  const regions = normalizedTerms(map?.regions);
  return regions.some((region) => region.includes('left')) && regions.some((region) => region.includes('center')) && regions.some((region) => region.includes('right'));
}

function connectorRequired(lock, map) {
  const req = map?.first_batch_requirements || {};
  return isNonNoneString(lock?.connector_model) || isNonNoneString(map?.connector_layer) || isNonNoneString(req.connector_strategy);
}

function expectedLeftCount(distributionModel) {
  const match = typeof distributionModel === 'string' ? distributionModel.match(/^(\d+)-left/) : null;
  return match ? Number(match[1]) : null;
}

function expectedRightCount(distributionModel) {
  const match = typeof distributionModel === 'string' ? distributionModel.match(/-(\d+)-right$/) : null;
  return match ? Number(match[1]) : null;
}

function addTextFallbackDiagnostics({ add, lock, map, pkg }) {
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
}

function addStructuredIntentDiagnostics({ add, lock, map, intent }) {
  const req = map.first_batch_requirements || {};
  const mismatches = [];

  if ((lock.primary_anchor === 'house-center' || req.must_establish_primary_anchor === true) && intent.primary_anchor_staged !== true) {
    mismatches.push('primary_anchor_staged must be true when the locked paradigm requires a primary anchor.');
  }
  if (intent.primary_anchor !== lock.primary_anchor || intent.primary_anchor !== map.primary_anchor) {
    mismatches.push(`primary_anchor must match lock/map primary anchor ${lock.primary_anchor}.`);
  }
  if (intent.distribution_model !== lock.distribution_model) {
    mismatches.push(`distribution_model must match locked distribution ${lock.distribution_model}.`);
  }
  if (intent.repeated_unit_form !== lock.repeated_unit_form) {
    mismatches.push(`repeated_unit_form must match locked repeated unit form ${lock.repeated_unit_form}.`);
  }
  if (req.must_use_repeated_unit_form && intent.repeated_unit_form !== req.must_use_repeated_unit_form) {
    mismatches.push(`repeated_unit_form must match first_batch_requirements ${req.must_use_repeated_unit_form}.`);
  }
  if (!hasRegionModel(map, intent.region_model)) {
    mismatches.push(`region_model ${intent.region_model} is not proven by paradigm_to_structure_map.regions.`);
  }

  const expectedLeft = expectedLeftCount(lock.distribution_model);
  const expectedRight = expectedRightCount(lock.distribution_model);
  if (expectedLeft !== null && intent.left_region_count !== expectedLeft) {
    mismatches.push(`left_region_count must be ${expectedLeft} for ${lock.distribution_model}.`);
  }
  if (expectedRight !== null && intent.right_region_count !== expectedRight) {
    mismatches.push(`right_region_count must be ${expectedRight} for ${lock.distribution_model}.`);
  }

  if (connectorRequired(lock, map)) {
    const expectedConnector = (lock.connector_model ?? null) || (req.connector_strategy ?? null);
    const lockModel = lock.connector_model ?? null;
    const reqStrategy = req.connector_strategy ?? null;
    if (lockModel !== null && reqStrategy !== null && lockModel !== reqStrategy) {
      mismatches.push(`Inconsistent connector configuration: lock connector model (${lockModel}) does not match requirements connector strategy (${reqStrategy}).`);
    } else if ((intent.connector_strategy ?? null) !== expectedConnector) {
      mismatches.push(`connector_strategy must match the required connector model ${expectedConnector}.`);
    }
    if (intent.connector_layer_staged !== true) {
      mismatches.push('connector_layer_staged must be true when the lock/map requires connectors.');
    }
  }

  if (intent.forbidden_composition_start !== false) {
    mismatches.push('forbidden_composition_start must be false.');
  }

  for (const message of mismatches) {
    add(REFERENCE_PARADIGM_DIAGNOSTICS.FIRST_BATCH_STRUCTURE_INTENT_MISMATCH, message);
  }
}

export function requiresReferenceParadigmGate(pkg) {
  return pkg?.visual_reference_present === true && pkg?.visual_parity_expected === true && pkg?.task_type !== 'pure_execution';
}

export function validateReferenceParadigmGate(pkg) {
  const diagnostics = [];
  const add = (diag, message) => diagnostics.push({ id: diag[0], name: diag[1], message });
  if (!requiresReferenceParadigmGate(pkg)) return diagnostics;

  if (pkg.reference_artifact_type !== 'structured_contract') {
    add(REFERENCE_PARADIGM_DIAGNOSTICS.UNSTRUCTURED_VISUAL_REFERENCE, 'visual reference parity requires reference_artifact_type structured_contract.');
  }

  const lock = pkg.reference_paradigm_lock;
  const map = pkg.paradigm_to_structure_map;
  const intent = pkg.first_batch_structure_intent;

  if (!lock) add(REFERENCE_PARADIGM_DIAGNOSTICS.MISSING_PARADIGM_LOCK, 'visual parity package requires reference_paradigm_lock before BATCH-001.');
  else {
    if (lock.paradigm_locked !== true || lock.extracted_by !== 'constructability_engineer' || !Array.isArray(lock.completion_signature) || lock.completion_signature.length === 0) {
      add(REFERENCE_PARADIGM_DIAGNOSTICS.UNLOCKED_PARADIGM, 'reference_paradigm_lock must be locked by constructability_engineer with a non-empty completion_signature.');
    }
  }

  if (!hasStructuredParadigmMap(map)) {
    add(REFERENCE_PARADIGM_DIAGNOSTICS.MISSING_STRUCTURE_MAP, 'visual parity package requires structured paradigm_to_structure_map with primary_anchor, regions, repeated_units, and first_batch_requirements before BATCH-001.');
  }

  const hasIntent = hasStructuredFirstBatchIntent(intent);
  if (!hasIntent) {
    add(REFERENCE_PARADIGM_DIAGNOSTICS.MISSING_FIRST_BATCH_STRUCTURE_INTENT, 'visual parity package requires structured first_batch_structure_intent before BATCH-001.');
  }

  if (!lock || !hasStructuredParadigmMap(map)) return diagnostics;

  if (isNonNoneString(lock.connector_model) && !map.connector_layer) {
    add(REFERENCE_PARADIGM_DIAGNOSTICS.MISSING_STRUCTURE_MAP, 'connector references require paradigm_to_structure_map.connector_layer.');
  }

  if (hasIntent) {
    addStructuredIntentDiagnostics({ add, lock, map, intent });
  } else {
    addTextFallbackDiagnostics({ add, lock, map, pkg });
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
