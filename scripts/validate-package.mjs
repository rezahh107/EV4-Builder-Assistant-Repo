#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node scripts/validate-package.mjs <builder_context_package.json>');
  process.exit(2);
}

const resolved = path.resolve(filePath);
const pkg = JSON.parse(fs.readFileSync(resolved, 'utf8'));
const errors = [];
const warnings = [];
const blockingDiagnostics = [];
const EXECUTABLE_PACKAGE_STATUSES = new Set(['ready', 'ready_with_visible_flags']);

const DIAGNOSTICS = {
  BLOCKED_PACKAGE_STATUS: ['EV4-PKG-001', 'BLOCKED_PACKAGE_STATUS'],
  SELECTED_CANDIDATE_NOT_LOCKED: ['EV4-PKG-002', 'SELECTED_CANDIDATE_NOT_LOCKED'],
  PRODUCTION_READY_NOT_FALSE: ['EV4-PKG-003', 'PRODUCTION_READY_NOT_FALSE'],
  MISSING_REQUIRED_TREE: ['EV4-PKG-004', 'MISSING_REQUIRED_TREE'],
  ACTION_TARGET_UNKNOWN: ['EV4-PKG-005', 'ACTION_TARGET_UNKNOWN'],
  MISSING_GENERATION_EVIDENCE: ['EV4-PKG-006', 'MISSING_GENERATION_EVIDENCE'],
  MISSING_FIRST_BATCH_ACTIONS: ['EV4-PKG-007', 'MISSING_FIRST_BATCH_ACTIONS'],
  MISSING_CLASS_MAP: ['EV4-PKG-008', 'MISSING_CLASS_MAP'],
  GENERATION_SOURCE_MISMATCH: ['EV4-PKG-009', 'GENERATION_SOURCE_MISMATCH'],
  INPUT_AUTHORIZATION_MISMATCH: ['EV4-PKG-010', 'INPUT_AUTHORIZATION_MISMATCH'],
  PACKAGE_DIGEST_MISMATCH: ['EV4-PKG-011', 'PACKAGE_DIGEST_MISMATCH'],
  PACKAGE_STATUS_NOT_EXECUTABLE: ['EV4-PKG-012', 'PACKAGE_STATUS_NOT_EXECUTABLE'],
  PACKAGE_TEXT_PROMPT_INJECTION: ['EV4-PKG-013', 'PACKAGE_TEXT_PROMPT_INJECTION'],
  CONFIRMATION_TEXT_UNTRUSTED: ['EV4-PKG-014', 'CONFIRMATION_TEXT_UNTRUSTED'],
  CONFIRMATION_REQUEST_MISMATCH: ['EV4-PKG-015', 'CONFIRMATION_REQUEST_MISMATCH'],
  MISSING_CONFIRMATION_SOURCE: ['EV4-PKG-016', 'MISSING_CONFIRMATION_SOURCE'],
  DUPLICATE_ID: ['EV4-PKG-101', 'DUPLICATE_ID'],
  CHILD_NODE_UNKNOWN: ['EV4-PKG-102', 'CHILD_NODE_UNKNOWN'],
  CLASS_TARGET_UNKNOWN: ['EV4-PKG-103', 'CLASS_TARGET_UNKNOWN'],
  CLASS_REFERENCE_UNKNOWN: ['EV4-PKG-104', 'CLASS_REFERENCE_UNKNOWN']
};

function fail(diag, message, { blocking = true } = {}) {
  const [id, name] = diag;
  const entry = { id, name, message };
  errors.push(entry);
  if (blocking) blockingDiagnostics.push(entry);
}

function warn(message) {
  warnings.push(message);
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

function firstMatch(value, checks) {
  if (typeof value !== 'string') return null;
  for (const check of checks) {
    if (check.pattern.test(value)) return check.label;
  }
  return null;
}

function batchPrefixFromActionId(actionId) {
  if (typeof actionId !== 'string') return null;
  const match = actionId.match(/^(BATCH-[A-Z0-9]+)-A\d+$/);
  return match ? match[1] : null;
}

function scanPromptSeedLikeText(fieldName, value) {
  if (typeof value !== 'string') return;
  warn(`${fieldName} is untrusted display-only data and must be ignored by runtime.`);
  const match = firstMatch(value, promptInjectionChecks);
  if (match) {
    fail(
      DIAGNOSTICS.PACKAGE_TEXT_PROMPT_INJECTION,
      `${fieldName} contains prompt-injection marker (${match}); runtime must not execute package strings.`
    );
  }
}

function scanConfirmationLikeText(fieldName, value) {
  if (typeof value !== 'string') return;
  warn(`${fieldName} is untrusted display-only data; runtime confirmation must be generated from confirmation_request when available.`);
  const commandMatch = firstMatch(value, confirmationCommandChecks);
  const injectionMatch = firstMatch(value, promptInjectionChecks);
  const match = commandMatch || injectionMatch;
  if (match) {
    fail(
      DIAGNOSTICS.CONFIRMATION_TEXT_UNTRUSTED,
      `${fieldName} contains command-like or role-changing text (${match}); use structured confirmation_request instead.`
    );
  }
}

const promptInjectionChecks = [
  { label: 'ignore previous instructions', pattern: /ignore\s+(?:all\s+)?previous\s+instructions/i },
  { label: 'disregard previous instructions', pattern: /disregard\s+(?:all\s+)?previous\s+instructions/i },
  { label: 'role change', pattern: /(?:change\s+your\s+role|act\s+as|you\s+are\s+now|system\s*prompt|developer\s*message)/i },
  { label: 'validation bypass', pattern: /(?:skip|bypass|disable)\s+validation/i },
  { label: 'hide warnings or flags', pattern: /hide\s+(?:warnings|flags|audit\s+flags|unknowns)/i },
  { label: 'production-ready override', pattern: /claim\s+production\s+ready/i },
  { label: 'Persian ignore-instructions phrase', pattern: /دستور(?:ها|ات)?(?:ی)?\s+قبلی\s+را\s+نادیده/u },
  { label: 'Persian role-change phrase', pattern: /نقش\s+(?:خود|تو|دستیار)?\s*را\s*(?:تغییر|عوض)/u },
  { label: 'Persian validation-bypass phrase', pattern: /اعتبارسنجی\s+را\s+(?:حذف|دور|نادیده)/u },
  { label: 'Persian hide-flags phrase', pattern: /(?:فلگ|پرچم|هشدار)(?:ها)?\s+را\s+(?:مخفی|پنهان|حذف)/u }
];

const confirmationCommandChecks = [
  { label: 'session command: ادامه', pattern: /(^|[^\p{L}\p{N}_])ادامه($|[^\p{L}\p{N}_])/u },
  { label: 'session command: ریست', pattern: /(^|[^\p{L}\p{N}_])ریست($|[^\p{L}\p{N}_])/u },
  { label: 'session command: شروع', pattern: /(^|[^\p{L}\p{N}_])شروع($|[^\p{L}\p{N}_])/u },
  { label: 'session command: استارت', pattern: /(^|[^\p{L}\p{N}_])استارت($|[^\p{L}\p{N}_])/u },
  { label: 'role or instruction smuggling', pattern: /(?:change\s+your\s+role|act\s+as|system\s*prompt|developer\s*message|نقش\s+(?:خود|تو|دستیار)?\s*را\s*(?:تغییر|عوض))/iu }
];

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
  const canonical = sortedCanonicalJson(packageWithoutDigest(value));
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function visibleAuthorizationFlags(value) {
  return [
    ...(Array.isArray(value.audit_flags_to_preserve) ? value.audit_flags_to_preserve : []),
    ...(Array.isArray(value.unknowns_to_preserve) ? value.unknowns_to_preserve : [])
  ];
}

function expectedDecision(value, diagnostics) {
  if (value.package_status === 'blocked') return 'blocked_package_status';
  if (!EXECUTABLE_PACKAGE_STATUSES.has(value.package_status)) return 'blocked_invalid_package';
  if (diagnostics.some((diag) => ['EV4-PKG-004', 'EV4-PKG-006', 'EV4-PKG-007', 'EV4-PKG-008', 'EV4-PKG-016'].includes(diag.id))) return 'blocked_missing_input';
  if (diagnostics.some((diag) => ['EV4-PKG-002', 'EV4-PKG-003', 'EV4-PKG-012'].includes(diag.id))) return 'blocked_invalid_package';
  if (diagnostics.length > 0) return 'blocked_conflict';
  return 'approved';
}

function expectedAuthorization(value, diagnostics) {
  const decision = expectedDecision(value, diagnostics);
  const approved = decision === 'approved';
  return {
    decision,
    eligible_workflow_mode: approved ? 'APPROVED_HANDOFF_MODE' : 'START_INTAKE_MODE',
    eligible_runtime_state: approved ? 'BUILD_ACTIVE' : 'EVIDENCE_REQUIRED',
    package_digest: {
      algorithm: 'sha256',
      scope: 'canonical_package_without_digest',
      value: computePackageDigest(value)
    },
    blocking_diagnostics: diagnostics.map((diag) => `${diag.id} ${diag.name}`),
    visible_flags: visibleAuthorizationFlags(value)
  };
}

function arraysEqual(left = [], right = []) {
  return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => value === right[index]);
}

if (pkg.package_status === 'blocked') {
  fail(DIAGNOSTICS.BLOCKED_PACKAGE_STATUS, 'package_status blocked cannot enter APPROVED_HANDOFF_MODE.');
} else if (!EXECUTABLE_PACKAGE_STATUSES.has(pkg.package_status)) {
  fail(DIAGNOSTICS.PACKAGE_STATUS_NOT_EXECUTABLE, `package_status must be ready or ready_with_visible_flags for executable validation; received ${pkg.package_status}.`);
}

if (pkg.selected_candidate_locked !== true) fail(DIAGNOSTICS.SELECTED_CANDIDATE_NOT_LOCKED, 'selected_candidate_locked must be true.');
if (pkg.production_ready_allowed !== false) fail(DIAGNOSTICS.PRODUCTION_READY_NOT_FALSE, 'production_ready_allowed must be false.');

const nodes = Array.isArray(pkg.approved_structure_tree) ? pkg.approved_structure_tree : [];
const nodeIds = nodes.map((node) => node.node_id).filter(Boolean);
const nodeLabels = nodes.map((node) => node.structure_label).filter(Boolean);
const nodeIdSet = new Set(nodeIds);
const nodeLabelSet = new Set(nodeLabels);

if (nodes.length === 0) fail(DIAGNOSTICS.MISSING_REQUIRED_TREE, 'approved_structure_tree must contain at least one node.');
for (const duplicate of duplicates(nodeIds)) fail(DIAGNOSTICS.DUPLICATE_ID, `Duplicate node_id: ${duplicate}`);

for (const node of nodes) {
  for (const child of node.children || []) {
    if (!nodeIdSet.has(child)) fail(DIAGNOSTICS.CHILD_NODE_UNKNOWN, `Node ${node.node_id} references unknown child node_id: ${child}`);
  }
  if (!node.element_generation || !node.element_generation_source) {
    fail(DIAGNOSTICS.MISSING_GENERATION_EVIDENCE, `Node ${node.node_id || '<missing-node-id>'} lacks element_generation or element_generation_source.`);
    continue;
  }
  if (node.element_generation === 'Unverified element type' && node.element_generation_source !== 'unverified') fail(DIAGNOSTICS.GENERATION_SOURCE_MISMATCH, `Node ${node.node_id} uses Unverified element type but source is not unverified.`);
  if (node.element_generation !== 'Unverified element type' && node.element_generation_source === 'unverified') fail(DIAGNOSTICS.GENERATION_SOURCE_MISMATCH, `Node ${node.node_id} has verified generation label but unverified source.`);
}

const classMap = Array.isArray(pkg.class_creation_application_map) ? pkg.class_creation_application_map : [];
const classNames = new Set(classMap.map((entry) => entry.class_name).filter(Boolean));

if (classMap.length === 0) fail(DIAGNOSTICS.MISSING_CLASS_MAP, 'class_creation_application_map must contain at least one class mapping.');
for (const entry of classMap) {
  const target = entry.elementor_node_or_element;
  if (typeof target === 'string' && target.startsWith('n-') && !nodeIdSet.has(target)) fail(DIAGNOSTICS.CLASS_TARGET_UNKNOWN, `Class ${entry.class_name} maps to unknown node_id: ${target}`);
}

for (const widget of pkg.widget_mapping_table || []) {
  if (widget.class_name && !classNames.has(widget.class_name)) fail(DIAGNOSTICS.CLASS_REFERENCE_UNKNOWN, `Widget mapping references class not present in class map: ${widget.class_name}`);
}

const actions = Array.isArray(pkg.first_builder_batch?.actions) ? pkg.first_builder_batch.actions : [];
const actionIds = actions.map((action) => action.action_id).filter(Boolean);
const actionIdSet = new Set(actionIds);

if (actions.length === 0) fail(DIAGNOSTICS.MISSING_FIRST_BATCH_ACTIONS, 'first_builder_batch.actions must contain at least one action.');
for (const duplicate of duplicates(actionIds)) fail(DIAGNOSTICS.DUPLICATE_ID, `Duplicate action_id: ${duplicate}`);

for (const action of actions) {
  const target = action.target_element;
  const targetKnown = nodeIdSet.has(target) || nodeLabelSet.has(target);
  if (!targetKnown) fail(DIAGNOSTICS.ACTION_TARGET_UNKNOWN, `Action ${action.action_id} targets unknown element: ${target}`);
  if (action.active_class && !classNames.has(action.active_class)) fail(DIAGNOSTICS.CLASS_REFERENCE_UNKNOWN, `Action ${action.action_id} references class not present in class map: ${action.active_class}`);
  if (!action.element_generation || !action.element_generation_source) {
    fail(DIAGNOSTICS.MISSING_GENERATION_EVIDENCE, `Action ${action.action_id || '<missing-action-id>'} lacks element_generation or element_generation_source.`);
    continue;
  }
  if (action.element_generation === 'Unverified element type' && action.element_generation_source !== 'unverified') fail(DIAGNOSTICS.GENERATION_SOURCE_MISMATCH, `Action ${action.action_id} uses Unverified element type but source is not unverified.`);
  if (action.element_generation !== 'Unverified element type' && action.element_generation_source === 'unverified') fail(DIAGNOSTICS.GENERATION_SOURCE_MISMATCH, `Action ${action.action_id} has verified generation label but unverified source.`);
}

scanPromptSeedLikeText('builder_assistant_prompt_seed', pkg.builder_assistant_prompt_seed);
scanConfirmationLikeText('confirmation_sentence', pkg.confirmation_sentence);

if (pkg.display_only_untrusted_text && typeof pkg.display_only_untrusted_text === 'object') {
  scanPromptSeedLikeText('display_only_untrusted_text.builder_assistant_prompt_seed', pkg.display_only_untrusted_text.builder_assistant_prompt_seed);
  scanConfirmationLikeText('display_only_untrusted_text.confirmation_sentence', pkg.display_only_untrusted_text.confirmation_sentence);
}

const confirmationRequest = pkg.confirmation_request;
if (!confirmationRequest) {
  if (!pkg.confirmation_sentence) {
    fail(DIAGNOSTICS.MISSING_CONFIRMATION_SOURCE, 'Both confirmation_request and legacy confirmation_sentence are missing.');
  } else {
    warn('confirmation_request is missing; package is using legacy confirmation compatibility path.');
  }
} else {
  if (confirmationRequest.template_id !== 'standard_batch_confirmation') {
    fail(DIAGNOSTICS.CONFIRMATION_REQUEST_MISMATCH, `Unsupported confirmation_request.template_id: ${confirmationRequest.template_id}`);
  }

  const confirmedActionIds = Array.isArray(confirmationRequest.confirmed_action_ids) ? confirmationRequest.confirmed_action_ids : [];

  for (const duplicate of duplicates(confirmedActionIds)) {
    fail(DIAGNOSTICS.CONFIRMATION_REQUEST_MISMATCH, `Duplicate confirmation_request.confirmed_action_ids entry: ${duplicate}`);
  }

  for (const confirmedActionId of confirmedActionIds) {
    if (!actionIdSet.has(confirmedActionId)) {
      fail(DIAGNOSTICS.CONFIRMATION_REQUEST_MISMATCH, `confirmation_request references unknown action_id: ${confirmedActionId}`);
    }
  }

  const invalidBatchActionIds = confirmedActionIds.filter((actionId) => !batchPrefixFromActionId(actionId));
  if (invalidBatchActionIds.length > 0) {
    fail(DIAGNOSTICS.CONFIRMATION_REQUEST_MISMATCH, `confirmation_request.confirmed_action_ids do not follow the standard BATCH-XXX-AYY format: ${invalidBatchActionIds.join(', ')}.`);
  } else {
    const batchPrefixes = [...new Set(confirmedActionIds.map(batchPrefixFromActionId))];
    if (batchPrefixes.length > 1) {
      fail(DIAGNOSTICS.CONFIRMATION_REQUEST_MISMATCH, `confirmation_request.confirmed_action_ids contains actions from multiple batches: ${batchPrefixes.join(', ')}.`);
    } else if (batchPrefixes.length === 0) {
      fail(DIAGNOSTICS.CONFIRMATION_REQUEST_MISMATCH, 'confirmation_request.confirmed_action_ids do not follow the standard BATCH-XXX-AYY format.');
    } else {
      const expectedConfirmationId = `CONFIRM-${batchPrefixes[0]}`;
      const expectedUserToken = `تایید ${batchPrefixes[0]}`;
      if (confirmationRequest.confirmation_id !== expectedConfirmationId) {
        fail(DIAGNOSTICS.CONFIRMATION_REQUEST_MISMATCH, `confirmation_request.confirmation_id must be ${expectedConfirmationId} for confirmed action batch ${batchPrefixes[0]}.`);
      }
      if (confirmationRequest.expected_user_token !== expectedUserToken) {
        fail(DIAGNOSTICS.CONFIRMATION_REQUEST_MISMATCH, `confirmation_request.expected_user_token must be ${expectedUserToken}.`);
      }
    }
  }
}

if (pkg.input_authorization) {
  const expected = expectedAuthorization(pkg, blockingDiagnostics);
  const actual = pkg.input_authorization;

  if (actual.decision !== expected.decision) fail(DIAGNOSTICS.INPUT_AUTHORIZATION_MISMATCH, `input_authorization.decision must be ${expected.decision}; received ${actual.decision}.`, { blocking: false });
  if (actual.eligible_workflow_mode !== expected.eligible_workflow_mode) fail(DIAGNOSTICS.INPUT_AUTHORIZATION_MISMATCH, `input_authorization.eligible_workflow_mode must be ${expected.eligible_workflow_mode}; received ${actual.eligible_workflow_mode}.`, { blocking: false });
  if (actual.eligible_runtime_state !== expected.eligible_runtime_state) fail(DIAGNOSTICS.INPUT_AUTHORIZATION_MISMATCH, `input_authorization.eligible_runtime_state must be ${expected.eligible_runtime_state}; received ${actual.eligible_runtime_state}.`, { blocking: false });
  if (!arraysEqual(actual.blocking_diagnostics, expected.blocking_diagnostics)) fail(DIAGNOSTICS.INPUT_AUTHORIZATION_MISMATCH, `input_authorization.blocking_diagnostics must be ${JSON.stringify(expected.blocking_diagnostics)}; received ${JSON.stringify(actual.blocking_diagnostics)}.`, { blocking: false });
  if (!arraysEqual(actual.visible_flags, expected.visible_flags)) fail(DIAGNOSTICS.INPUT_AUTHORIZATION_MISMATCH, `input_authorization.visible_flags must be ${JSON.stringify(expected.visible_flags)}; received ${JSON.stringify(actual.visible_flags)}.`, { blocking: false });
  if (actual.package_digest?.value !== expected.package_digest.value) fail(DIAGNOSTICS.PACKAGE_DIGEST_MISMATCH, `input_authorization.package_digest.value must be ${expected.package_digest.value}; received ${actual.package_digest?.value}.`, { blocking: false });
}

if (warnings.length > 0) {
  console.warn(`Cross-field validation warnings for ${filePath}:`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length > 0) {
  console.error(`Cross-field validation failed for ${filePath}:`);
  for (const error of errors) console.error(`- ${error.id} ${error.name}: ${error.message}`);
  process.exit(1);
}

console.log(`Cross-field validation passed: ${filePath}`);
