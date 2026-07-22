#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/validate-action-batch.mjs <file>');
  process.exit(2);
}

const batch = readJson(file);
const errors = [];
const fail = (id, message) => errors.push({ id, message });
const approved = new Set(batch.approved_class_map || []);
const allowedScopes = new Set(['Local Classes', 'Global Classes']);

if ((batch.actions || []).length > batch.max_normal_actions) {
  fail('EV4-ACTION-001', 'normal batch action count exceeds max_normal_actions.');
}

const highRisk = (batch.actions || []).filter((action) => action.risk_level === 'high');
if (highRisk.length > 1 && !batch.allow_multiple_high_risk) {
  fail('EV4-ACTION-002', 'high-risk visual/overlay/SVG batches are limited to one action unless explicitly allowed.');
}

for (const action of batch.actions || []) {
  if (action.class_name && action.allowed_class_source === 'approved_class_map' && !approved.has(action.class_name)) {
    fail('EV4-ACTION-003', `unapproved class name: ${action.class_name}`);
  }
  if (action.class_operation === 'add' && action.class_name && !approved.has(action.class_name)) {
    fail('EV4-ACTION-004', 'action may not add unapproved class names.');
  }
  if (action.class_operation === 'remove' && approved.has(action.class_name)) {
    fail('EV4-ACTION-005', 'action may not remove approved class names.');
  }
  if ((action.forbidden_changes || []).includes('selected_candidate_id') || action.control_name === 'selected_candidate_id') {
    fail('EV4-ACTION-006', 'action may not change selected_candidate_id.');
  }
  if (['tablet', 'mobile'].includes(action.responsive_scope) && action.claims_responsive_behavior && !batch.evidence?.responsive) {
    fail('EV4-ACTION-007', 'tablet/mobile behavior claims require evidence.');
  }
  if (batch.checkpointed && String(action.confirmation_scope || '').trim() === '') {
    fail('EV4-ACTION-008', 'checkpointed action requires confirmation_scope.');
  }
  if (action.class_name && !allowedScopes.has(action.class_scope)) {
    fail('EV4-ACTION-009', 'action with class_name must declare Elementor class_scope as Local Classes or Global Classes.');
  }
  if (typeof action.value === 'number' && (!String(action.unit || '').trim() || !String(action.value_source || '').trim())) {
    fail('EV4-ACTION-010', 'numeric action values require unit and value_source.');
  }

  const extendedRiskMetadataRequired = action.risk_level === 'high' || action.difficult_to_reverse === true;
  if (extendedRiskMetadataRequired) {
    for (const field of ['rationale', 'reversibility_analysis', 'safety_decision', 'confirmation_scope']) {
      if (!String(action[field] || '').trim()) fail('EV4-ACTION-011', `high-risk or difficult-to-reverse action requires ${field}.`);
    }
    if (!Array.isArray(action.evidence_required) || action.evidence_required.length === 0) {
      fail('EV4-ACTION-012', 'high-risk or difficult-to-reverse action requires evidence_required.');
    }
    if (!Array.isArray(action.forbidden_changes) || action.forbidden_changes.length === 0) {
      fail('EV4-ACTION-013', 'high-risk or difficult-to-reverse action requires forbidden_changes.');
    }
  }
}

finish('Action Batch Contract', file, errors);
