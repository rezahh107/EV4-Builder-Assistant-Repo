#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CE_TO_BUILDER_GATE = 'ce_to_builder_contract_gate';
export const CE_TO_BUILDER_GATE_VERSION = '1.0.0';
export const SUPPORTED_CE_CONTRACT_VERSION = 'ev4-builder-executable-package@1.0.0';
const FIRST_BUILDER_BATCH_ACTION_HARD_CAP = 5;

const HINT = Object.freeze({
  CONTRACT_VERSION_MISSING: `Add schema: ${SUPPORTED_CE_CONTRACT_VERSION} to the CE builder_executable_package.`,
  CONTRACT_VERSION_UNSUPPORTED: `Use ${SUPPORTED_CE_CONTRACT_VERSION} or update the Builder gate deliberately.`,
  SCHEMA_INVALID: 'Emit a JSON object under ce_builder_executable_package or pass the raw CE package object.',
  REQUIRED_FIELD_MISSING: 'Regenerate the complete CE Builder Executable Package with all required carriers.',
  FIELD_TYPE_INVALID: 'Fix the producer output shape; the gate does not coerce types.',
  FIELD_VALUE_INVALID: 'Correct the CE output so the value matches the executable contract.',
  FORBIDDEN_FIELD_PRESENT: 'Remove executable prose fields from the CE package; keep prose display-only outside runtime authority.',
  UNKNOWN_FIELD_PRESENT: 'Declare the new field in the CE→Builder contract and update tests before use.',
  SEMANTIC_INVARIANT_FAILED: 'Fix the CE package so locked IDs, approved classes, status, or confirmation data agree.',
  REFERENCE_MISSING: 'Provide the missing structured reference/carrier data from CE evidence.',
  REFERENCE_UNRESOLVED: 'Fix the referenced ID/name or add the missing carrier through CE output generation.',
  BUILDER_REQUIRED_CONTEXT_MISSING: 'Regenerate CE output with the complete Builder-required execution context.',
  UNSUPPORTED_BUILDER_MODE: 'Return to CE correction or evidence collection until no Builder strategy decision remains.',
  AMBIGUOUS_CE_OUTPUT: 'Add explicit structured data so Builder does not infer behavior from prose.',
  PROMPT_INJECTION_RISK_IN_DATA: 'Remove or quarantine the suspicious prose; never use it as runtime instruction.',
  INTERNAL_CONTRACT_DRIFT: 'Update both sides of the explicit CE→Builder contract with matching fixtures.',
  VALIDATOR_INTERNAL_ERROR: 'Fix the validator and rerun; do not allow Builder execution while this appears.'
});

const ALLOWED_FIELDS = new Set([
  'schema','package_id','review_ref','architect_contract','selected_candidate_id','approved_class_names','builder_package_status','builder_decisions_required','blocking_dependencies','selected_candidate_locked','selected_candidate_id_unchanged','approved_class_names_unchanged','visual_parity_build','golden_reference_contract','build_intent_brief','spatial_lexicon_version_used','visual_tolerance_policy','approved_structure_tree','class_creation_application_map','widget_mapping_table','editable_content_map','decoration_only_map','asset_replacement_map','scoped_css_need_map','responsive_qa_seed','forbidden_work','confirmation_request','first_safe_builder_batch','reference_paradigm_lock','paradigm_to_structure_map','audit_flags_to_preserve','unknowns_to_preserve'
]);
const FORBIDDEN_FIELDS = new Set(['builder_assistant_prompt_seed','runtime_instructions','system_prompt','developer_message','execute_directive','skip_validation','normalization_override']);
const REQUIRED_FIELDS = ['schema','package_id','review_ref','architect_contract','selected_candidate_id','approved_class_names','builder_package_status','builder_decisions_required','blocking_dependencies','selected_candidate_locked','selected_candidate_id_unchanged','approved_class_names_unchanged','approved_structure_tree','class_creation_application_map','widget_mapping_table','editable_content_map','decoration_only_map','asset_replacement_map','scoped_css_need_map','responsive_qa_seed','forbidden_work','confirmation_request','first_safe_builder_batch'];
const ARRAY_FIELDS = ['approved_class_names','blocking_dependencies','approved_structure_tree','class_creation_application_map','widget_mapping_table','editable_content_map','decoration_only_map','asset_replacement_map','scoped_css_need_map','forbidden_work'];
const OBJECT_FIELDS = ['architect_contract','responsive_qa_seed','confirmation_request','first_safe_builder_batch'];
const INJECTION = [
  ['ignore previous instructions', /ignore\s+(?:all\s+)?previous\s+instructions/i],
  ['disregard previous instructions', /disregard\s+(?:all\s+)?previous\s+instructions/i],
  ['role change', /(?:change\s+your\s+role|act\s+as|you\s+are\s+now|system\s*prompt|developer\s*message)/i],
  ['validation bypass', /(?:skip|bypass|disable)\s+validation/i],
  ['hide warnings or flags', /hide\s+(?:warnings|flags|audit\s+flags|unknowns)/i],
  ['production-ready override', /claim\s+production\s+ready/i],
  ['Persian ignore-instructions phrase', /دستور(?:ها|ات)?(?:ی)?\s+قبلی\s+را\s+نادیده/u],
  ['Persian role-change phrase', /نقش\s+(?:خود|تو|دستیار)?\s*را\s*(?:تغییر|عوض)/u],
  ['Persian validation-bypass phrase', /اعتبارسنجی\s+را\s+(?:حذف|دور|نادیده)/u]
];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const typ = (v) => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
const actual = (v) => typeof v === 'string' ? (v.length > 160 ? `${v.slice(0,157)}...` : v) : v === undefined ? 'undefined' : v === null ? 'null' : typeof v === 'object' ? typ(v) : String(v);
const jp = (base, ...parts) => parts.reduce((p, part) => typeof part === 'number' ? `${p}[${part}]` : p === '$' ? `$.${part}` : `${p}.${part}`, base);
const arrEq = (a = [], b = []) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
const batchPrefix = (id) => typeof id === 'string' ? id.match(/^(BATCH-[A-Z0-9]+)-A\d+$/)?.[1] || null : null;
const get = (root, parts) => parts.reduce((cur, key) => cur == null ? undefined : cur[key], root);
const safeClassScope = (className) => typeof className === 'string' && className.startsWith('smart-home__');

function reportFor(contractVersion) {
  return { gate: CE_TO_BUILDER_GATE, gate_version: CE_TO_BUILDER_GATE_VERSION, result: 'pass', blocking: false, contract_version: contractVersion, errors: [] };
}
function fail(report, code, path, message, { expected = '', actual: got = '', evidence = 'code' } = {}) {
  report.errors.push({ code, severity: 'blocker', path, message, expected, actual: got, blocking: true, remediation_hint: HINT[code] || HINT.VALIDATOR_INTERNAL_ERROR, evidence });
}
function finalize(report) {
  report.errors.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message));
  report.blocking = report.errors.some((e) => e.blocking);
  report.result = report.blocking ? 'fail' : 'pass';
  return report;
}
function unwrap(input) {
  return isObj(input) && Object.hasOwn(input, 'ce_builder_executable_package')
    ? { pkg: input.ce_builder_executable_package, base: '$.ce_builder_executable_package' }
    : { pkg: input, base: '$' };
}
function requireType(report, pkg, base, field, type) {
  if (pkg[field] === undefined) return;
  const ok = type === 'array' ? Array.isArray(pkg[field]) : type === 'object' ? isObj(pkg[field]) : typeof pkg[field] === type;
  if (!ok) fail(report, 'FIELD_TYPE_INVALID', jp(base, field), `${field} must be ${type}.`, { expected: type, actual: typ(pkg[field]), evidence: 'schema' });
}
function scanText(report, value, pathNow) {
  if (typeof value === 'string') {
    for (const [label, pattern] of INJECTION) {
      if (pattern.test(value)) {
        fail(report, 'PROMPT_INJECTION_RISK_IN_DATA', pathNow, `${pathNow} contains prompt-injection marker (${label}); package text is data and must not alter gate behavior.`, { expected: 'data-only text without runtime override markers', actual: actual(value), evidence: 'code' });
        return;
      }
    }
    return;
  }
  if (Array.isArray(value)) return value.forEach((v, i) => scanText(report, v, `${pathNow}[${i}]`));
  if (isObj(value)) for (const [k, v] of Object.entries(value)) scanText(report, v, jp(pathNow, k));
}

export function validateCeToBuilderContractGate(input) {
  const { pkg, base } = unwrap(input);
  const contractVersion = isObj(pkg) ? (pkg.schema ?? pkg.contract_version ?? null) : null;
  const report = reportFor(contractVersion);
  try {
    if (!isObj(pkg)) {
      fail(report, 'SCHEMA_INVALID', base, 'CE builder executable package must be a JSON object.', { expected: 'object', actual: typ(pkg), evidence: 'schema' });
      return finalize(report);
    }
    if (!contractVersion) fail(report, 'CONTRACT_VERSION_MISSING', jp(base, 'schema'), 'CE package contract version is missing.', { expected: SUPPORTED_CE_CONTRACT_VERSION, actual: 'missing', evidence: 'contract' });
    else if (contractVersion !== SUPPORTED_CE_CONTRACT_VERSION) fail(report, 'CONTRACT_VERSION_UNSUPPORTED', jp(base, Object.hasOwn(pkg, 'schema') ? 'schema' : 'contract_version'), `Unsupported CE package contract version: ${contractVersion}.`, { expected: SUPPORTED_CE_CONTRACT_VERSION, actual: contractVersion, evidence: 'contract' });

    for (const key of Object.keys(pkg).sort()) {
      if (FORBIDDEN_FIELDS.has(key)) fail(report, 'FORBIDDEN_FIELD_PRESENT', jp(base, key), `${key} is forbidden at the CE→Builder execution boundary.`, { expected: 'absent', actual: 'present', evidence: 'security' });
      else if (!ALLOWED_FIELDS.has(key)) fail(report, 'UNKNOWN_FIELD_PRESENT', jp(base, key), `${key} is not declared for the strict CE→Builder gate.`, { expected: 'declared CE→Builder field', actual: key, evidence: 'contract' });
    }
    for (const field of REQUIRED_FIELDS) if (!Object.hasOwn(pkg, field)) fail(report, 'REQUIRED_FIELD_MISSING', jp(base, field), `${field} is required.`, { expected: 'present', actual: 'missing', evidence: 'contract' });
    for (const field of ARRAY_FIELDS) requireType(report, pkg, base, field, 'array');
    for (const field of OBJECT_FIELDS) requireType(report, pkg, base, field, 'object');

    const ac = isObj(pkg.architect_contract) ? pkg.architect_contract : {};
    for (const field of ['source_ref', 'selected_candidate_id']) {
      if (ac[field] === undefined) fail(report, 'REQUIRED_FIELD_MISSING', jp(base, 'architect_contract', field), `architect_contract.${field} is required.`, { expected: 'present', actual: 'missing', evidence: 'contract' });
      else if (typeof ac[field] !== 'string') fail(report, 'FIELD_TYPE_INVALID', jp(base, 'architect_contract', field), `architect_contract.${field} must be string.`, { expected: 'string', actual: typ(ac[field]), evidence: 'schema' });
    }
    if (!Array.isArray(ac.approved_class_names)) fail(report, 'FIELD_TYPE_INVALID', jp(base, 'architect_contract', 'approved_class_names'), 'architect_contract.approved_class_names must be array.', { expected: 'array', actual: typ(ac.approved_class_names), evidence: 'schema' });

    if (pkg.builder_package_status !== undefined && pkg.builder_package_status !== 'executable_ready') fail(report, 'UNSUPPORTED_BUILDER_MODE', jp(base, 'builder_package_status'), 'Only executable_ready CE packages may enter the Builder gate.', { expected: 'executable_ready', actual: actual(pkg.builder_package_status), evidence: 'contract' });
    if (pkg.builder_decisions_required !== undefined && pkg.builder_decisions_required !== 0) fail(report, 'UNSUPPORTED_BUILDER_MODE', jp(base, 'builder_decisions_required'), 'Builder decisions must be zero before Builder execution.', { expected: '0', actual: actual(pkg.builder_decisions_required), evidence: 'contract' });
    if (Array.isArray(pkg.blocking_dependencies) && pkg.blocking_dependencies.length !== 0) fail(report, 'BUILDER_REQUIRED_CONTEXT_MISSING', jp(base, 'blocking_dependencies'), 'blocking_dependencies must be empty before Builder execution.', { expected: '[]', actual: JSON.stringify(pkg.blocking_dependencies), evidence: 'contract' });
    for (const field of ['selected_candidate_locked','selected_candidate_id_unchanged','approved_class_names_unchanged']) if (pkg[field] !== undefined && pkg[field] !== true) fail(report, 'SEMANTIC_INVARIANT_FAILED', jp(base, field), `${field} must be true.`, { expected: 'true', actual: actual(pkg[field]), evidence: 'contract' });
    if (typeof pkg.selected_candidate_id === 'string' && typeof ac.selected_candidate_id === 'string' && pkg.selected_candidate_id !== ac.selected_candidate_id) fail(report, 'SEMANTIC_INVARIANT_FAILED', jp(base, 'selected_candidate_id'), 'selected_candidate_id must match architect_contract.selected_candidate_id.', { expected: ac.selected_candidate_id, actual: pkg.selected_candidate_id, evidence: 'code' });
    if (Array.isArray(pkg.approved_class_names) && Array.isArray(ac.approved_class_names) && !arrEq(pkg.approved_class_names, ac.approved_class_names)) fail(report, 'SEMANTIC_INVARIANT_FAILED', jp(base, 'approved_class_names'), 'approved_class_names must exactly match architect_contract.approved_class_names.', { expected: JSON.stringify(ac.approved_class_names), actual: JSON.stringify(pkg.approved_class_names), evidence: 'code' });

    const nodes = Array.isArray(pkg.approved_structure_tree) ? pkg.approved_structure_tree : [];
    const nodeIds = new Set(nodes.map((n) => isObj(n) ? n.node_id : undefined).filter(Boolean));
    const nodeLabels = new Set(nodes.map((n) => isObj(n) ? n.structure_label : undefined).filter(Boolean));
    if (Array.isArray(pkg.approved_structure_tree) && nodes.length === 0) fail(report, 'BUILDER_REQUIRED_CONTEXT_MISSING', jp(base, 'approved_structure_tree'), 'approved_structure_tree must contain at least one node.', { expected: 'non-empty array', actual: 'empty array', evidence: 'contract' });
    nodes.forEach((node, i) => {
      if (!isObj(node)) return fail(report, 'FIELD_TYPE_INVALID', jp(base, 'approved_structure_tree', i), 'approved_structure_tree item must be object.', { expected: 'object', actual: typ(node), evidence: 'schema' });
      for (const f of ['node_id','structure_label','element_generation','element_generation_source']) if (typeof node[f] !== 'string' || node[f].length === 0) fail(report, 'REQUIRED_FIELD_MISSING', jp(base, 'approved_structure_tree', i, f), `approved_structure_tree[${i}].${f} is required.`, { expected: 'non-empty string', actual: actual(node[f]), evidence: 'contract' });
      if (Array.isArray(node.children)) node.children.forEach((child, j) => { if (!nodeIds.has(child)) fail(report, 'REFERENCE_UNRESOLVED', jp(base, 'approved_structure_tree', i, 'children', j), `Child node reference is unresolved: ${child}.`, { expected: 'known node_id', actual: actual(child), evidence: 'code' }); });
    });

    const classMap = Array.isArray(pkg.class_creation_application_map) ? pkg.class_creation_application_map : [];
    const classNames = new Set(classMap.map((e) => isObj(e) ? e.class_name : undefined).filter(Boolean));
    if (Array.isArray(pkg.class_creation_application_map) && classMap.length === 0) fail(report, 'BUILDER_REQUIRED_CONTEXT_MISSING', jp(base, 'class_creation_application_map'), 'class_creation_application_map must contain at least one class mapping.', { expected: 'non-empty array', actual: 'empty array', evidence: 'contract' });
    classMap.forEach((e, i) => {
      if (!isObj(e)) return;
      if (typeof e.class_name !== 'string' || e.class_name.length === 0) fail(report, 'REQUIRED_FIELD_MISSING', jp(base, 'class_creation_application_map', i, 'class_name'), 'class_name is required for class map entries.', { expected: 'non-empty string', actual: actual(e.class_name), evidence: 'contract' });
      if (typeof e.elementor_node_or_element === 'string' && e.elementor_node_or_element.startsWith('n-') && !nodeIds.has(e.elementor_node_or_element)) fail(report, 'REFERENCE_UNRESOLVED', jp(base, 'class_creation_application_map', i, 'elementor_node_or_element'), `Class map target is unresolved: ${e.elementor_node_or_element}.`, { expected: 'known node_id', actual: e.elementor_node_or_element, evidence: 'code' });
    });

    const actions = Array.isArray(pkg.first_safe_builder_batch?.actions) ? pkg.first_safe_builder_batch.actions : [];
    const actionIds = actions.map((a) => isObj(a) ? a.action_id : undefined).filter(Boolean);
    const actionIdSet = new Set(actionIds);
    if (!Array.isArray(pkg.first_safe_builder_batch?.actions)) fail(report, 'BUILDER_REQUIRED_CONTEXT_MISSING', jp(base, 'first_safe_builder_batch', 'actions'), 'first_safe_builder_batch.actions must be present.', { expected: 'array', actual: typ(pkg.first_safe_builder_batch?.actions), evidence: 'contract' });
    else if (actions.length === 0) fail(report, 'BUILDER_REQUIRED_CONTEXT_MISSING', jp(base, 'first_safe_builder_batch', 'actions'), 'first_safe_builder_batch.actions must contain at least one action.', { expected: 'non-empty array', actual: 'empty array', evidence: 'contract' });
    else if (actions.length > FIRST_BUILDER_BATCH_ACTION_HARD_CAP) fail(report, 'FIELD_VALUE_INVALID', jp(base, 'first_safe_builder_batch', 'actions'), `first_safe_builder_batch.actions exceeds hard cap ${FIRST_BUILDER_BATCH_ACTION_HARD_CAP}.`, { expected: `<= ${FIRST_BUILDER_BATCH_ACTION_HARD_CAP}`, actual: String(actions.length), evidence: 'contract' });
    actions.forEach((action, i) => {
      if (!isObj(action)) return fail(report, 'FIELD_TYPE_INVALID', jp(base, 'first_safe_builder_batch', 'actions', i), 'first_safe_builder_batch action must be object.', { expected: 'object', actual: typ(action), evidence: 'schema' });
      if (action.requires_decision !== false) fail(report, 'UNSUPPORTED_BUILDER_MODE', jp(base, 'first_safe_builder_batch', 'actions', i, 'requires_decision'), 'Builder action requires_decision must be false.', { expected: 'false', actual: actual(action.requires_decision), evidence: 'contract' });
      const p = isObj(action.parameters) ? action.parameters : {};
      if (!isObj(action.parameters)) fail(report, 'FIELD_TYPE_INVALID', jp(base, 'first_safe_builder_batch', 'actions', i, 'parameters'), 'action.parameters must be object.', { expected: 'object', actual: typ(action.parameters), evidence: 'schema' });
      const target = p.target_element || action.target_node;
      if (typeof target !== 'string' || target.length === 0) fail(report, 'REQUIRED_FIELD_MISSING', jp(base, 'first_safe_builder_batch', 'actions', i, 'target_node'), 'Action target_node or parameters.target_element is required.', { expected: 'known target string', actual: actual(target), evidence: 'contract' });
      else if (!nodeIds.has(target) && !nodeLabels.has(target)) fail(report, 'REFERENCE_UNRESOLVED', jp(base, 'first_safe_builder_batch', 'actions', i, 'target_node'), `Action target is unresolved: ${target}.`, { expected: 'known node_id or structure_label', actual: target, evidence: 'code' });
      const activeClass = p.active_class || action.active_class;
      if (activeClass && !classNames.has(activeClass)) fail(report, 'REFERENCE_UNRESOLVED', jp(base, 'first_safe_builder_batch', 'actions', i, 'parameters', 'active_class'), `Action active_class is not in class_creation_application_map: ${activeClass}.`, { expected: 'known class_name', actual: activeClass, evidence: 'code' });
      if (activeClass && !(p.active_class_scope || action.active_class_scope) && !safeClassScope(activeClass)) fail(report, 'AMBIGUOUS_CE_OUTPUT', jp(base, 'first_safe_builder_batch', 'actions', i, 'parameters', 'active_class_scope'), `Action ${action.action_id || i} carries active_class without explicit or contract-safe class scope.`, { expected: 'Local Classes | Global Classes | contract-safe default', actual: 'missing', evidence: 'contract' });
      for (const f of ['element_generation','element_generation_source','instruction','expected_result']) {
        const v = p[f] || action[f];
        if (typeof v !== 'string' || v.length === 0) fail(report, 'REQUIRED_FIELD_MISSING', jp(base, 'first_safe_builder_batch', 'actions', i, 'parameters', f), `Action ${f} is required.`, { expected: 'non-empty string', actual: actual(v), evidence: 'contract' });
      }
    });

    const confirmation = isObj(pkg.confirmation_request) ? pkg.confirmation_request : null;
    if (confirmation) {
      const confirmed = Array.isArray(confirmation.confirmed_action_ids) ? confirmation.confirmed_action_ids : [];
      if (!Array.isArray(confirmation.confirmed_action_ids) || confirmed.length === 0) fail(report, 'BUILDER_REQUIRED_CONTEXT_MISSING', jp(base, 'confirmation_request', 'confirmed_action_ids'), 'confirmation_request.confirmed_action_ids must be a non-empty array.', { expected: 'non-empty array', actual: typ(confirmation.confirmed_action_ids), evidence: 'contract' });
      confirmed.forEach((id, i) => { if (!actionIdSet.has(id)) fail(report, 'REFERENCE_UNRESOLVED', jp(base, 'confirmation_request', 'confirmed_action_ids', i), `confirmation_request references unknown action_id: ${id}.`, { expected: 'known action_id', actual: actual(id), evidence: 'code' }); });
      const prefixes = [...new Set(confirmed.map(batchPrefix))];
      if (prefixes.length !== 1 || !prefixes[0]) fail(report, 'AMBIGUOUS_CE_OUTPUT', jp(base, 'confirmation_request', 'confirmed_action_ids'), 'confirmation_request.confirmed_action_ids must belong to one BATCH-XXX prefix.', { expected: 'one standard batch prefix', actual: JSON.stringify(confirmed), evidence: 'code' });
      else {
        const expectedId = `CONFIRM-${prefixes[0]}`;
        const expectedToken = `تایید ${prefixes[0]}`;
        if (confirmation.confirmation_id !== expectedId) fail(report, 'SEMANTIC_INVARIANT_FAILED', jp(base, 'confirmation_request', 'confirmation_id'), 'confirmation_request.confirmation_id does not match confirmed batch.', { expected: expectedId, actual: actual(confirmation.confirmation_id), evidence: 'code' });
        if (confirmation.expected_user_token !== expectedToken) fail(report, 'SEMANTIC_INVARIANT_FAILED', jp(base, 'confirmation_request', 'expected_user_token'), 'confirmation_request.expected_user_token does not match confirmed batch.', { expected: expectedToken, actual: actual(confirmation.expected_user_token), evidence: 'code' });
      }
    }

    if (pkg.visual_parity_build === true) {
      for (const f of ['golden_reference_contract','build_intent_brief','visual_tolerance_policy','reference_paradigm_lock','paradigm_to_structure_map']) if (!isObj(pkg[f])) fail(report, 'REFERENCE_MISSING', jp(base, f), `${f} is required as object for visual_parity_build packages.`, { expected: 'object', actual: typ(pkg[f]), evidence: 'contract' });
      if (typeof pkg.spatial_lexicon_version_used !== 'string' || pkg.spatial_lexicon_version_used.length === 0) fail(report, 'REFERENCE_MISSING', jp(base, 'spatial_lexicon_version_used'), 'spatial_lexicon_version_used is required for visual_parity_build packages.', { expected: 'non-empty string', actual: actual(pkg.spatial_lexicon_version_used), evidence: 'contract' });
      const connectorLayer = get(pkg, ['paradigm_to_structure_map','connector_layer']);
      if (typeof connectorLayer === 'string') fail(report, 'INTERNAL_CONTRACT_DRIFT', jp(base, 'paradigm_to_structure_map', 'connector_layer'), 'CE must emit structured connector_layer { node, model }, not Builder compact node:model string.', { expected: 'object { node, model }', actual: connectorLayer, evidence: 'docs' });
      else if (connectorLayer !== undefined && !isObj(connectorLayer)) fail(report, 'FIELD_TYPE_INVALID', jp(base, 'paradigm_to_structure_map', 'connector_layer'), 'paradigm_to_structure_map.connector_layer must be object.', { expected: 'object', actual: typ(connectorLayer), evidence: 'schema' });
    }
    scanText(report, pkg, base);
  } catch (error) {
    fail(report, 'VALIDATOR_INTERNAL_ERROR', base, `Validator internal error: ${error.message}`, { expected: 'validator completes', actual: error.name, evidence: 'code' });
  }
  return finalize(report);
}

export class CeToBuilderContractGateError extends Error {
  constructor(report) { super('CE→Builder Contract Gate failed. Builder execution must not start.'); this.name = 'CeToBuilderContractGateError'; this.report = report; }
}
export function assertCeToBuilderContractGatePass(input) {
  const report = validateCeToBuilderContractGate(input);
  if (report.result !== 'pass') throw new CeToBuilderContractGateError(report);
  return report;
}

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
function fixturePaths(dir, prefix) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.startsWith(prefix) && n.endsWith('.json')).map((n) => path.join(dir, n)).sort() : [];
}
function runSelfTest() {
  const root = process.cwd();
  const valid = fixturePaths(path.join(root, 'tests', 'valid'), 'ce_to_builder_contract_gate_');
  const invalid = fixturePaths(path.join(root, 'tests', 'invalid'), 'ce_to_builder_contract_gate_');
  assert.ok(valid.length > 0, 'No valid ce_to_builder_contract_gate fixtures found.');
  assert.ok(invalid.length > 0, 'No invalid ce_to_builder_contract_gate fixtures found.');
  for (const f of valid) {
    const input = readJson(f), before = JSON.stringify(input), first = validateCeToBuilderContractGate(input), second = validateCeToBuilderContractGate(input);
    assert.deepEqual(first, second, `Gate must be deterministic for ${f}`);
    assert.equal(JSON.stringify(input), before, `Gate must not mutate ${f}`);
    assert.equal(first.result, 'pass', `Valid gate fixture failed: ${f}\n${JSON.stringify(first, null, 2)}`);
    console.log(`CE→Builder gate valid fixture passed: ${f}`);
  }
  for (const f of invalid) {
    const input = readJson(f), before = JSON.stringify(input), first = validateCeToBuilderContractGate(input), second = validateCeToBuilderContractGate(input);
    assert.deepEqual(first, second, `Gate must be deterministic for ${f}`);
    assert.equal(JSON.stringify(input), before, `Gate must not mutate ${f}`);
    assert.equal(first.result, 'fail', `Invalid gate fixture unexpectedly passed: ${f}`);
    assert.ok(first.errors.length > 0, `Invalid gate fixture must emit structured errors: ${f}`);
    console.log(`CE→Builder gate invalid fixture correctly failed: ${f}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const filePath = process.argv[2];
  if (!filePath) runSelfTest();
  else {
    const report = validateCeToBuilderContractGate(readJson(path.resolve(filePath)));
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.result === 'pass' ? 0 : 1);
  }
}
