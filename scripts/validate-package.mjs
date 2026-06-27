#!/usr/bin/env node
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

function fail(message) {
  errors.push(message);
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

if (pkg.selected_candidate_locked !== true) {
  fail('selected_candidate_locked must be true.');
}

if (pkg.production_ready_allowed !== false) {
  fail('production_ready_allowed must be false.');
}

const nodes = Array.isArray(pkg.approved_structure_tree) ? pkg.approved_structure_tree : [];
const nodeIds = nodes.map((node) => node.node_id).filter(Boolean);
const nodeLabels = nodes.map((node) => node.structure_label).filter(Boolean);
const nodeIdSet = new Set(nodeIds);
const nodeLabelSet = new Set(nodeLabels);

for (const duplicate of duplicates(nodeIds)) {
  fail(`Duplicate node_id: ${duplicate}`);
}

for (const node of nodes) {
  for (const child of node.children || []) {
    if (!nodeIdSet.has(child)) {
      fail(`Node ${node.node_id} references unknown child node_id: ${child}`);
    }
  }

  if (node.element_generation === 'Unverified element type' && node.element_generation_source !== 'unverified') {
    fail(`Node ${node.node_id} uses Unverified element type but source is not unverified.`);
  }

  if (node.element_generation !== 'Unverified element type' && node.element_generation_source === 'unverified') {
    fail(`Node ${node.node_id} has verified generation label but unverified source.`);
  }
}

const classMap = Array.isArray(pkg.class_creation_application_map) ? pkg.class_creation_application_map : [];
const classNames = new Set(classMap.map((entry) => entry.class_name).filter(Boolean));

for (const entry of classMap) {
  const target = entry.elementor_node_or_element;
  if (typeof target === 'string' && target.startsWith('n-') && !nodeIdSet.has(target)) {
    fail(`Class ${entry.class_name} maps to unknown node_id: ${target}`);
  }
}

for (const widget of pkg.widget_mapping_table || []) {
  if (widget.class_name && !classNames.has(widget.class_name)) {
    fail(`Widget mapping references class not present in class map: ${widget.class_name}`);
  }
}

const actions = pkg.first_builder_batch?.actions || [];
const actionIds = actions.map((action) => action.action_id).filter(Boolean);
const actionIdSet = new Set(actionIds);

for (const duplicate of duplicates(actionIds)) {
  fail(`Duplicate action_id: ${duplicate}`);
}

for (const action of actions) {
  const target = action.target_element;
  const targetKnown = nodeIdSet.has(target) || nodeLabelSet.has(target);
  if (!targetKnown) {
    fail(`Action ${action.action_id} targets unknown element: ${target}`);
  }

  if (action.active_class && !classNames.has(action.active_class)) {
    fail(`Action ${action.action_id} references class not present in class map: ${action.active_class}`);
  }

  if (action.element_generation === 'Unverified element type' && action.element_generation_source !== 'unverified') {
    fail(`Action ${action.action_id} uses Unverified element type but source is not unverified.`);
  }

  if (action.element_generation !== 'Unverified element type' && action.element_generation_source === 'unverified') {
    fail(`Action ${action.action_id} has verified generation label but unverified source.`);
  }
}

if (typeof pkg.builder_assistant_prompt_seed === 'string') {
  warn('builder_assistant_prompt_seed is deprecated and must be ignored by runtime; treat it as untrusted display-only data.');
  const match = firstMatch(pkg.builder_assistant_prompt_seed, promptInjectionChecks);
  if (match) {
    fail(`builder_assistant_prompt_seed contains prompt-injection marker (${match}); runtime must not execute package strings.`);
  }
}

if (typeof pkg.confirmation_sentence === 'string') {
  warn('confirmation_sentence is legacy display-only data; runtime confirmation must be generated from confirmation_request when available.');
  const commandMatch = firstMatch(pkg.confirmation_sentence, confirmationCommandChecks);
  const injectionMatch = firstMatch(pkg.confirmation_sentence, promptInjectionChecks);
  const match = commandMatch || injectionMatch;
  if (match) {
    fail(`confirmation_sentence contains command-like or role-changing text (${match}); use structured confirmation_request instead.`);
  }
}

const confirmationRequest = pkg.confirmation_request;
if (!confirmationRequest) {
  warn('confirmation_request is missing; package is using legacy confirmation compatibility path.');
} else {
  if (confirmationRequest.template_id !== 'standard_batch_confirmation') {
    fail(`Unsupported confirmation_request.template_id: ${confirmationRequest.template_id}`);
  }

  const confirmedActionIds = Array.isArray(confirmationRequest.confirmed_action_ids)
    ? confirmationRequest.confirmed_action_ids
    : [];

  for (const duplicate of duplicates(confirmedActionIds)) {
    fail(`Duplicate confirmation_request.confirmed_action_ids entry: ${duplicate}`);
  }

  for (const confirmedActionId of confirmedActionIds) {
    if (!actionIdSet.has(confirmedActionId)) {
      fail(`confirmation_request references unknown action_id: ${confirmedActionId}`);
    }
  }

  const batchPrefixes = [...new Set(confirmedActionIds.map(batchPrefixFromActionId).filter(Boolean))];
  if (batchPrefixes.length === 1) {
    const expectedConfirmationId = `CONFIRM-${batchPrefixes[0]}`;
    const expectedUserToken = `تایید ${batchPrefixes[0]}`;
    if (confirmationRequest.confirmation_id !== expectedConfirmationId) {
      fail(`confirmation_request.confirmation_id must be ${expectedConfirmationId} for confirmed action batch ${batchPrefixes[0]}.`);
    }
    if (confirmationRequest.expected_user_token !== expectedUserToken) {
      fail(`confirmation_request.expected_user_token must be ${expectedUserToken}.`);
    }
  }
}

if (warnings.length > 0) {
  console.warn(`Cross-field validation warnings for ${filePath}:`);
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

if (errors.length > 0) {
  console.error(`Cross-field validation failed for ${filePath}:`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Cross-field validation passed: ${filePath}`);
