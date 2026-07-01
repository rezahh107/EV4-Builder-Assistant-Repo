#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeCeReferenceCarrier } from './normalize-ce-reference-map.mjs';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, location) {
  if (!isObject(value)) throw new Error(`${location} must be an object.`);
  return value;
}

function requireString(value, location) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${location} must be a non-empty string.`);
  }
  return value.trim();
}

function requireArray(value, location) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${location} must be a non-empty array.`);
  return value;
}

function requireEmptyArray(value, location) {
  if (!Array.isArray(value) || value.length !== 0) throw new Error(`${location} must be an empty array.`);
}

function arraysEqual(left = [], right = []) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]);
}

function unique(values) {
  return [...new Set(values)];
}

function sortedCanonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(sortedCanonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${sortedCanonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function packageWithoutDigest(value) {
  const cloned = JSON.parse(JSON.stringify(value));
  if (cloned.input_authorization?.package_digest) delete cloned.input_authorization.package_digest;
  return cloned;
}

function computePackageDigest(value) {
  return crypto.createHash('sha256').update(sortedCanonicalJson(packageWithoutDigest(value)), 'utf8').digest('hex');
}

function assertCeExecutablePackage(cePackage) {
  requireObject(cePackage, 'ce_builder_executable_package');
  requireString(cePackage.package_id, 'package_id');
  requireString(cePackage.review_ref, 'review_ref');
  const architectContract = requireObject(cePackage.architect_contract, 'architect_contract');
  requireString(architectContract.source_ref, 'architect_contract.source_ref');
  const selectedCandidateId = requireString(cePackage.selected_candidate_id, 'selected_candidate_id');
  const architectSelectedCandidateId = requireString(architectContract.selected_candidate_id, 'architect_contract.selected_candidate_id');

  if (selectedCandidateId !== architectSelectedCandidateId) {
    throw new Error('selected_candidate_id must match architect_contract.selected_candidate_id.');
  }

  const approvedClassNames = requireArray(cePackage.approved_class_names, 'approved_class_names');
  const architectApprovedClassNames = requireArray(architectContract.approved_class_names, 'architect_contract.approved_class_names');

  if (!arraysEqual(approvedClassNames, architectApprovedClassNames)) {
    throw new Error('approved_class_names must exactly match architect_contract.approved_class_names.');
  }

  if (cePackage.builder_package_status !== 'executable_ready') throw new Error('builder_package_status must be executable_ready.');
  if (cePackage.builder_decisions_required !== 0) throw new Error('builder_decisions_required must be 0.');
  requireEmptyArray(cePackage.blocking_dependencies, 'blocking_dependencies');
  if (cePackage.selected_candidate_locked !== true) throw new Error('selected_candidate_locked must be true.');
  if (cePackage.selected_candidate_id_unchanged !== true) throw new Error('selected_candidate_id_unchanged must be true.');
  if (cePackage.approved_class_names_unchanged !== true) throw new Error('approved_class_names_unchanged must be true.');
  requireObject(cePackage.confirmation_request, 'confirmation_request');
  requireObject(cePackage.first_safe_builder_batch, 'first_safe_builder_batch');
}

function requireBuilderPayloadCarriers(cePackage) {
  const requiredCarriers = [
    'approved_structure_tree',
    'class_creation_application_map',
    'widget_mapping_table',
    'editable_content_map',
    'decoration_only_map',
    'asset_replacement_map',
    'scoped_css_need_map',
    'forbidden_work'
  ];

  for (const carrier of requiredCarriers) {
    requireArray(cePackage[carrier], carrier);
  }

  requireObject(cePackage.responsive_qa_seed, 'responsive_qa_seed');
}

function assertVisualReferencePrerequisites(cePackage) {
  if (cePackage.visual_parity_build !== true) return;
  requireObject(cePackage.golden_reference_contract, 'golden_reference_contract');
  requireObject(cePackage.build_intent_brief, 'build_intent_brief');
  requireString(cePackage.spatial_lexicon_version_used, 'spatial_lexicon_version_used');
  requireObject(cePackage.visual_tolerance_policy, 'visual_tolerance_policy');
  requireObject(cePackage.reference_paradigm_lock, 'reference_paradigm_lock');
  requireObject(cePackage.paradigm_to_structure_map, 'paradigm_to_structure_map');
}

function normalizeAction(action, index) {
  requireObject(action, `first_safe_builder_batch.actions[${index}]`);
  const parameters = requireObject(action.parameters, `first_safe_builder_batch.actions[${index}].parameters`);
  if (action.requires_decision !== false) {
    throw new Error(`first_safe_builder_batch.actions[${index}].requires_decision must be false.`);
  }

  const actionId = requireString(action.action_id, `first_safe_builder_batch.actions[${index}].action_id`);
  const target = requireString(parameters.target_element || action.target_node, `first_safe_builder_batch.actions[${index}].target_node`);

  return {
    action_id: actionId,
    target_element: target,
    ...(parameters.parent ? { parent: requireString(parameters.parent, `first_safe_builder_batch.actions[${index}].parameters.parent`) } : {}),
    ...(parameters.element_type ? { element_type: requireString(parameters.element_type, `first_safe_builder_batch.actions[${index}].parameters.element_type`) } : {}),
    element_generation: requireString(parameters.element_generation || action.element_generation, `first_safe_builder_batch.actions[${index}].parameters.element_generation`),
    element_generation_source: requireString(parameters.element_generation_source || action.element_generation_source, `first_safe_builder_batch.actions[${index}].parameters.element_generation_source`),
    ...(parameters.structure_panel_name ? { structure_panel_name: requireString(parameters.structure_panel_name, `first_safe_builder_batch.actions[${index}].parameters.structure_panel_name`) } : {}),
    ...(parameters.active_class ? { active_class: requireString(parameters.active_class, `first_safe_builder_batch.actions[${index}].parameters.active_class`) } : {}),
    instruction: requireString(parameters.instruction, `first_safe_builder_batch.actions[${index}].parameters.instruction`),
    ...(Array.isArray(parameters.properties_not_to_change) ? { properties_not_to_change: parameters.properties_not_to_change.map((item, itemIndex) => requireString(item, `first_safe_builder_batch.actions[${index}].parameters.properties_not_to_change[${itemIndex}]`)) } : {}),
    expected_result: requireString(parameters.expected_result, `first_safe_builder_batch.actions[${index}].parameters.expected_result`)
  };
}

function normalizeFirstBuilderBatch(firstSafeBuilderBatch) {
  requireString(firstSafeBuilderBatch.batch_id, 'first_safe_builder_batch.batch_id');
  const actions = requireArray(firstSafeBuilderBatch.actions, 'first_safe_builder_batch.actions').map(normalizeAction);
  if (actions.length > 5) throw new Error('first_safe_builder_batch.actions must not exceed Builder hard cap of 5 actions.');

  return {
    max_actions: Number.isInteger(firstSafeBuilderBatch.max_actions)
      ? firstSafeBuilderBatch.max_actions
      : actions.length,
    actions
  };
}

function batchPrefixFromActionId(actionId) {
  const match = actionId.match(/^(BATCH-[A-Z0-9]+)-A\d+$/);
  return match ? match[1] : null;
}

function normalizeConfirmationRequest(ceConfirmationRequest, builderActions) {
  const confirmedActionIds = requireArray(ceConfirmationRequest.confirmed_action_ids, 'confirmation_request.confirmed_action_ids')
    .map((actionId, index) => requireString(actionId, `confirmation_request.confirmed_action_ids[${index}]`));
  const builderActionIds = new Set(builderActions.map((action) => action.action_id));

  for (const actionId of confirmedActionIds) {
    if (!builderActionIds.has(actionId)) throw new Error(`confirmation_request references unknown normalized action_id: ${actionId}.`);
  }

  const batchPrefixes = unique(confirmedActionIds.map(batchPrefixFromActionId));
  if (batchPrefixes.length !== 1 || !batchPrefixes[0]) {
    throw new Error('confirmation_request.confirmed_action_ids must belong to one BATCH-XXX action prefix.');
  }

  const expectedConfirmationId = `CONFIRM-${batchPrefixes[0]}`;
  const expectedUserToken = `تایید ${batchPrefixes[0]}`;
  if (ceConfirmationRequest.confirmation_id !== expectedConfirmationId) {
    throw new Error(`confirmation_request.confirmation_id must be ${expectedConfirmationId}.`);
  }
  if (ceConfirmationRequest.expected_user_token !== expectedUserToken) {
    throw new Error(`confirmation_request.expected_user_token must be ${expectedUserToken}.`);
  }

  return {
    confirmation_id: expectedConfirmationId,
    confirmed_action_ids: confirmedActionIds,
    expected_user_token: expectedUserToken,
    template_id: 'standard_batch_confirmation'
  };
}

function attachInputAuthorization(builderPackage) {
  const visibleFlags = [
    ...(Array.isArray(builderPackage.audit_flags_to_preserve) ? builderPackage.audit_flags_to_preserve : []),
    ...(Array.isArray(builderPackage.unknowns_to_preserve) ? builderPackage.unknowns_to_preserve : [])
  ];

  builderPackage.input_authorization = {
    decision: 'approved',
    eligible_workflow_mode: 'APPROVED_HANDOFF_MODE',
    eligible_runtime_state: 'BUILD_ACTIVE',
    package_digest: {
      algorithm: 'sha256',
      scope: 'canonical_package_without_digest',
      value: ''
    },
    blocking_diagnostics: [],
    visible_flags: visibleFlags
  };
  builderPackage.input_authorization.package_digest.value = computePackageDigest(builderPackage);
}

export function normalizeCeBuilderExecutablePackage(cePackage) {
  assertCeExecutablePackage(cePackage);
  requireBuilderPayloadCarriers(cePackage);
  assertVisualReferencePrerequisites(cePackage);

  const firstBuilderBatch = normalizeFirstBuilderBatch(cePackage.first_safe_builder_batch);
  const confirmationRequest = normalizeConfirmationRequest(cePackage.confirmation_request, firstBuilderBatch.actions);
  const visualReferenceBuild = cePackage.visual_parity_build === true;
  const referenceCarriers = visualReferenceBuild
    ? normalizeCeReferenceCarrier(cePackage.paradigm_to_structure_map, cePackage.reference_paradigm_lock)
    : {};

  const builderPackage = {
    schema: 'ev4-builder-context-package@1.0.0',
    source_stage: '/builder-feed-export',
    source_handoff_stage: '/handoff-export',
    package_status: 'ready',
    selected_candidate_id: cePackage.selected_candidate_id,
    selected_candidate_locked: true,
    production_ready_allowed: false,
    source_payload_ledger: [
      {
        payload_name: 'CE Builder Executable Package',
        schema: 'ev4-builder-executable-package@1.0.0',
        status: cePackage.builder_package_status,
        source_ref: cePackage.package_id
      }
    ],
    approved_structure_tree: cePackage.approved_structure_tree,
    class_creation_application_map: cePackage.class_creation_application_map,
    widget_mapping_table: cePackage.widget_mapping_table,
    editable_content_map: cePackage.editable_content_map,
    decoration_only_map: cePackage.decoration_only_map,
    asset_replacement_map: cePackage.asset_replacement_map,
    scoped_css_need_map: cePackage.scoped_css_need_map,
    responsive_qa_seed: cePackage.responsive_qa_seed,
    ...(Array.isArray(cePackage.audit_flags_to_preserve) ? { audit_flags_to_preserve: cePackage.audit_flags_to_preserve } : {}),
    ...(Array.isArray(cePackage.unknowns_to_preserve) ? { unknowns_to_preserve: cePackage.unknowns_to_preserve } : {}),
    forbidden_work: cePackage.forbidden_work,
    first_builder_batch: firstBuilderBatch,
    confirmation_request: confirmationRequest,
    ...(visualReferenceBuild ? {
      task_type: 'visual_build',
      visual_reference_present: true,
      visual_parity_expected: true,
      reference_artifact_type: 'structured_contract',
      reference_paradigm_lock: cePackage.reference_paradigm_lock,
      ...referenceCarriers
    } : {})
  };

  attachInputAuthorization(builderPackage);
  return builderPackage;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: node scripts/normalize-ce-builder-executable-package.mjs <ce-builder-executable-package.json>');
    process.exit(2);
  }

  const cePackage = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  console.log(JSON.stringify(normalizeCeBuilderExecutablePackage(cePackage), null, 2));
}
