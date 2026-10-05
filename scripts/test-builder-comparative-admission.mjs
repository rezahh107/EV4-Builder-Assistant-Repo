#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { computeCanonicalDigest, computePackageDigest } from './lib/canonical-builder-package.mjs';
import { initializeAtomicRun, emitRunBatch } from './lib/runtime/canonical-run-runtime.mjs';
import {
  admitComparativeResolution,
  bindComparativeRequirement,
  deriveRequiredDomains
} from './lib/runtime/comparative-admission.mjs';
import { cleanBuilderPackage, writeJson } from './lib/runtime/runtime-test-fixtures.mjs';

const ROOT = process.cwd();
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-comparative-admission-'));
const CONTRACT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'comparative-admission-contract.v1.json'), 'utf8'));
const RULES_BY_DOMAIN = {};
for (const [ruleId, domainId] of Object.entries(CONTRACT.rule_domain_index)) if (!RULES_BY_DOMAIN[domainId]) RULES_BY_DOMAIN[domainId] = ruleId;

function resetDigest(pkg) { pkg.input_authorization.package_digest.value = computePackageDigest(pkg); return pkg; }
function createRun(name, actionCount = 1) {
  const pkg = cleanBuilderPackage();
  const base = pkg.first_builder_batch.actions[0];
  pkg.first_builder_batch.actions = Array.from({ length: actionCount }, (_, i) => ({ ...structuredClone(base), action_id: `BATCH-001-A${String(i + 1).padStart(2, '0')}` }));
  pkg.first_builder_batch.max_actions = actionCount;
  pkg.confirmation_request.confirmed_action_ids = pkg.first_builder_batch.actions.map((a) => a.action_id);
  resetDigest(pkg);
  const source = writeJson(path.join(TEMP, `${name}-builder.json`), pkg);
  const runDirectory = path.join(TEMP, `run-${name}`);
  const intake = initializeAtomicRun({ sourceMode: 'manual-builder-input', sourceArtifactFile: null, builderInputFile: source, runDirectory });
  assert.equal(intake.passed, true, JSON.stringify(intake.diagnostics));
  return { pkg, source, runDirectory };
}
function baseRequirement(actionId, suffix = actionId) {
  return {
    schema: CONTRACT.requirement_schema,
    action_id: actionId,
    decision_requirement_id: `REQ-${suffix}`,
    implementation_question: 'Choose width for variable localized content at narrow widths.',
    governing_upstream_constraints: ['content role locked', 'responsive intent locked'],
    implementation_surface_type: 'text',
    material_behavior_dimensions: ['size'],
    content_variability: 'variable_localized',
    reference_frame: 'parent',
    responsive_relevance: true,
    text_semantics_relevance: false,
    interaction_relevance: false,
    media_relevance: false,
    reuse_scope: 'local',
    platform_capability_relevance: false,
    accessibility_relevance: false,
    performance_relevance: false,
    security_relevance: false,
    saved_state_relevance: false,
    runtime_validation_relevance: false,
    allowed_authority_boundary: 'BUILDER_BOUNDED_ONLY',
    required_material_parameters: ['width_behavior', 'width_value'],
    fully_specified_upstream_parameters: [],
    unresolved_material_parameters: ['width_behavior', 'width_value'],
    upstream_parameter_bindings: {}
  };
}
function directRequirement(action, index = 0) {
  const fields = ['target_element', 'element_type', 'instruction', 'expected_result'];
  return {
    schema: CONTRACT.requirement_schema,
    action_id: action.action_id,
    decision_requirement_id: `REQ-DIRECT-${action.action_id}`,
    implementation_question: 'Execute exact upstream action.',
    governing_upstream_constraints: ['all material implementation parameters are bound upstream'],
    implementation_surface_type: 'generic', material_behavior_dimensions: [], content_variability: 'fixed', reference_frame: 'none',
    responsive_relevance: false, text_semantics_relevance: false, interaction_relevance: false, media_relevance: false,
    reuse_scope: 'local', platform_capability_relevance: false, accessibility_relevance: false, performance_relevance: false,
    security_relevance: false, saved_state_relevance: false, runtime_validation_relevance: false,
    allowed_authority_boundary: 'BUILDER_BOUNDED_ONLY',
    required_material_parameters: fields,
    fully_specified_upstream_parameters: fields,
    unresolved_material_parameters: [],
    upstream_parameter_bindings: Object.fromEntries(fields.map((field) => [field, { source_ref: `first_builder_batch.actions[${index}].${field}`, evidence: String(action[field] ?? '') }]))
  };
}
function bind(runDirectory, requirement, label) {
  const file = writeJson(path.join(TEMP, `${label}-requirement.json`), requirement);
  return bindComparativeRequirement({ runDirectory, requirementSourceFile: file });
}
function resolutionFor(requirementResult, label) {
  const required = requirementResult.result.required_domain_ids;
  const requirementDigest = requirementResult.result.decision_requirement_digest;
  return {
    schema: CONTRACT.resolution_schema,
    resolution_id: `RES-${label}`,
    action_id: requirementResult.result.action_id,
    decision_requirement_id: requirementResult.result.decision_requirement_id,
    decision_requirement_digest: requirementDigest,
    evaluated_domain_ids: [...required],
    validated_rule_ids: required.map((domain) => RULES_BY_DOMAIN[domain]),
    candidate_options: [{ option_id: 'A', label: 'bounded-fluid' }, { option_id: 'B', label: 'fixed' }],
    selected_option: 'A',
    selected_parameters: { width_behavior: 'bounded-fluid', width_value: '70%' },
    parameter_basis: { width_behavior: 'variable localized text and narrow widths', width_value: 'bounded parent-relative realization' },
    authority_result: 'PASS',
    verification_obligations: ['verify localized text at narrow width and falsify overflow'],
    coverage_status: 'COMPLETE',
    comparative_source_sha256: CONTRACT.comparative_source_sha256,
    comparison_completed_before_selection: true
  };
}
function admit(runDirectory, resolution, label) {
  const file = writeJson(path.join(TEMP, `${label}-resolution.json`), resolution);
  return admitComparativeResolution({ runDirectory, resolutionSourceFile: file });
}
function onlyCarrier(runDirectory, kind) {
  const dir = path.join(runDirectory, 'comparative', kind);
  const files = fs.readdirSync(dir).filter((x) => x.endsWith('.json'));
  assert.equal(files.length, 1);
  return path.join(dir, files[0]);
}
function mutateReceipt(runDirectory, fn) {
  const file = onlyCarrier(runDirectory, 'receipts');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  fn(value);
  value.receipt_digest = null;
  value.receipt_digest = computeCanonicalDigest(Object.fromEntries(Object.entries(value).filter(([k]) => k !== 'receipt_digest')));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
function hasCode(result, code) { return (result.diagnostics || []).some((d) => d.code === code); }

try {
  const domainProbe = baseRequirement('BATCH-001-A01', 'DOMAIN-PROBE');
  assert.deepEqual(deriveRequiredDomains(domainProbe), ['IMPLEMENTATION_VERIFICATION','RESPONSIVE_BREAKPOINTS_DIRECTION','TEXT_SEMANTICS','UNITS_SIZE_SPACING']);

  {
    const { pkg, runDirectory } = createRun('direct-pass');
    assert.equal(bind(runDirectory, directRequirement(pkg.first_builder_batch.actions[0]), 'direct-pass').passed, true);
    assert.equal(emitRunBatch({ runDirectory }).passed, true);
  }
  {
    const { runDirectory } = createRun('direct-bypass');
    const req = baseRequirement('BATCH-001-A01', 'DIRECT-BYPASS');
    req.authority_classification = 'DIRECT_EXECUTION';
    const bound = bind(runDirectory, req, 'direct-bypass');
    assert.equal(bound.passed, true);
    assert.equal(bound.result.authority_classification, 'BOUNDED_MICRO_RESOLUTION');
    const emitted = emitRunBatch({ runDirectory });
    assert.equal(emitted.passed, false);
    assert.equal(hasCode(emitted, 'RUN-COMPARATIVE-EMIT-004'), true);
  }
  {
    const { runDirectory } = createRun('bmr-pass');
    const bound = bind(runDirectory, baseRequirement('BATCH-001-A01', 'BMR-PASS'), 'bmr-pass');
    assert.equal(bound.passed, true);
    assert.equal(admit(runDirectory, resolutionFor(bound, 'BMR-PASS'), 'bmr-pass').passed, true);
    const emitted = emitRunBatch({ runDirectory });
    assert.equal(emitted.passed, true, JSON.stringify(emitted.diagnostics));
    assert.equal(emitted.result.runtime_state, 'WAITING_FOR_CONFIRMATION');
  }
  {
    const { runDirectory } = createRun('missing-receipt');
    assert.equal(bind(runDirectory, baseRequirement('BATCH-001-A01', 'MISSING'), 'missing-receipt').passed, true);
    const emitted = emitRunBatch({ runDirectory });
    assert.equal(emitted.passed, false);
    assert.equal(hasCode(emitted, 'RUN-COMPARATIVE-EMIT-004'), true);
  }
  for (const [name, mutate] of [
    ['stale-requirement', (r) => { r.decision_requirement_digest = '0'.repeat(64); }],
    ['wrong-action', (r) => { r.action_id = 'BATCH-001-A99'; }],
    ['wrong-resolution', (r) => { r.resolution_digest = '1'.repeat(64); }],
    ['missing-domain', (r) => { r.required_domain_ids = r.required_domain_ids.slice(1); }],
    ['unsupported-validator', (r) => { r.validator_identity = 'UNSUPPORTED_VALIDATOR'; }]
  ]) {
    const { runDirectory } = createRun(name);
    const bound = bind(runDirectory, baseRequirement('BATCH-001-A01', name.toUpperCase()), name);
    assert.equal(bound.passed, true);
    assert.equal(admit(runDirectory, resolutionFor(bound, name.toUpperCase()), name).passed, true);
    mutateReceipt(runDirectory, mutate);
    assert.equal(emitRunBatch({ runDirectory }).passed, false, name);
  }
  for (const [name, mutate] of [
    ['coverage-incomplete', (r) => { r.coverage_status = 'INCOMPLETE'; }],
    ['authority-fail', (r) => { r.authority_result = 'FAIL'; }],
    ['routing-omission', (r) => { r.evaluated_domain_ids = ['UNITS_SIZE_SPACING','IMPLEMENTATION_VERIFICATION']; r.validated_rule_ids = ['CMP-UNITS-001','CMP-VERIFY-001']; }]
  ]) {
    const { runDirectory } = createRun(name);
    const bound = bind(runDirectory, baseRequirement('BATCH-001-A01', name.toUpperCase()), name);
    const res = resolutionFor(bound, name.toUpperCase()); mutate(res);
    assert.equal(admit(runDirectory, res, name).passed, false, name);
    assert.equal(emitRunBatch({ runDirectory }).passed, false, name);
  }
  {
    const { runDirectory } = createRun('posthoc');
    const first = baseRequirement('BATCH-001-A01', 'POSTHOC');
    assert.equal(bind(runDirectory, first, 'posthoc-1').passed, true);
    const second = structuredClone(first); second.responsive_relevance = false;
    assert.equal(bind(runDirectory, second, 'posthoc-2').passed, false);
  }
  {
    const { pkg, runDirectory } = createRun('mixed', 3);
    assert.equal(bind(runDirectory, directRequirement(pkg.first_builder_batch.actions[0], 0), 'mixed-direct').passed, true);
    const b2 = bind(runDirectory, baseRequirement('BATCH-001-A02', 'MIXED-VALID'), 'mixed-valid');
    assert.equal(b2.passed, true); assert.equal(admit(runDirectory, resolutionFor(b2, 'MIXED-VALID'), 'mixed-valid').passed, true);
    assert.equal(bind(runDirectory, baseRequirement('BATCH-001-A03', 'MIXED-INVALID'), 'mixed-invalid').passed, true);
    assert.equal(emitRunBatch({ runDirectory }).passed, false);
  }

  console.log('Comparative admission runtime tests passed.');
} finally {
  fs.rmSync(TEMP, { recursive: true, force: true });
}
