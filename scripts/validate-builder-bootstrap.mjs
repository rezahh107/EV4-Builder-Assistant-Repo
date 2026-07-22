#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const manifestPath = path.join(root, 'manifests', 'builder-conversation-bootstrap.v1.json');
const schemaPath = path.join(root, 'schemas', 'builder-conversation-bootstrap.v1.schema.json');
const transitionsPath = path.join(root, 'runtime', 'state-transitions.v1.json');
const activeCarriers = [
  'AGENTS.md',
  'PROJECT_INSTRUCTIONS.md',
  'core/MASTER_PROMPT.md',
  'core/MODE_STATE_MATRIX.md',
  'README.md',
  'dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt'
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readText(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n');
}

function fail(code, message) {
  const error = new Error(`${code}: ${message}`);
  error.code = code;
  throw error;
}

function expect(value, expected, code, message) {
  if (JSON.stringify(value) !== JSON.stringify(expected)) fail(code, message || `expected ${JSON.stringify(expected)}, received ${JSON.stringify(value)}`);
}

function validateSchema(dataPath = manifestPath) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npx, [
    '--yes', 'ajv-cli@5', 'validate', '--spec=draft2020', '--strict=false',
    '-s', schemaPath, '-d', dataPath
  ], { cwd: root, encoding: 'utf8', shell: false });
  if (result.status !== 0) fail('BBOOT-SCHEMA-001', result.stderr || result.stdout || 'Bootstrap Schema validation failed.');
}

function validateManifest(manifest) {
  expect(manifest.contract_id, 'ev4-builder-conversation-bootstrap', 'BBOOT-001');
  expect(manifest.contract_version, '1.0.0', 'BBOOT-002');
  expect(manifest.owner_repository, 'rezahh107/EV4-Builder-Assistant-Repo', 'BBOOT-003');
  expect(manifest.canonical_fresh_intake_trigger, 'شروع', 'BBOOT-004');
  expect(manifest.canonical_resume_trigger, 'استارت', 'BBOOT-005');
  if (manifest.canonical_fresh_intake_trigger === manifest.canonical_resume_trigger) fail('BBOOT-006', 'Fresh intake and Resume triggers must differ.');
  expect(manifest.canonical_input_schema, 'ev4-builder-context-package@1.0.0', 'BBOOT-007');
  expect(manifest.filename_is_operator_hint_only, true, 'BBOOT-008');
  expect(manifest.filename_matching_is_sufficient_for_acceptance, false, 'BBOOT-009');
  expect(manifest.receipt_required, false, 'BBOOT-010');
  expect(manifest.receipt_is_semantic_input, false, 'BBOOT-011');
  expect(manifest.receipt_may_complete_or_modify_semantic_input, false, 'BBOOT-012');
  expect(manifest.pre_validation_workflow_mode, 'START_INTAKE_MODE', 'BBOOT-013');
  expect(manifest.pre_validation_runtime_state, 'INTAKE_WAITING', 'BBOOT-014');
  expect(manifest.validation_runtime_state, 'INTAKE_VALIDATING', 'BBOOT-015');
  expect(manifest.blocked_runtime_state, 'EVIDENCE_REQUIRED', 'BBOOT-016');
  expect(manifest.approved_workflow_mode, 'APPROVED_HANDOFF_MODE', 'BBOOT-017');
  expect(manifest.approved_runtime_state, 'BUILD_ACTIVE', 'BBOOT-018');
  expect(manifest.trigger_policy?.resume?.requires_valid_checkpoint_or_state_capsule, true, 'BBOOT-019');
  expect(manifest.trigger_policy?.resume?.fabricate_continuation_evidence, false, 'BBOOT-020');
  expect(manifest.trigger_policy?.repeated_fresh_intake?.preserve_confirmed_checkpoints, true, 'BBOOT-021');
  expect(manifest.trigger_policy?.repeated_fresh_intake?.preserve_initialized_state, true, 'BBOOT-022');
  expect(manifest.trigger_policy?.repeated_fresh_intake?.preserve_unresolved_evidence, true, 'BBOOT-023');
  expect(manifest.trigger_policy?.repeated_fresh_intake?.create_second_active_run, false, 'BBOOT-024');
  expect(manifest.routing_cases?.raw_project_gate_envelope?.manual_nested_extraction, false, 'BBOOT-025');
  expect(manifest.routing_cases?.raw_ce_or_ce_builder_executable?.silent_fallback, false, 'BBOOT-026');
  expect(manifest.routing_cases?.raw_ce_or_ce_builder_executable?.post_adapter_builder_context_validation_required, true, 'BBOOT-027');
  expect(manifest.repository_maintenance_exception?.start_token_activates_builder_session, false, 'BBOOT-028');
  if ((manifest.active_startup_routes || []).includes('/builder-feed-export')) fail('BBOOT-029', 'Historical Builder feed route remains active.');
}

function validateTransitions(transitions) {
  const fresh = transitions.transitions?.find((item) => item.id === 'fresh-intake');
  const repeated = transitions.transitions?.find((item) => item.id === 'repeated-start');
  const resume = transitions.transitions?.find((item) => item.id === 'resume');
  if (!fresh || fresh.trigger !== 'شروع' || fresh.to?.runtime_state !== 'INTAKE_WAITING') fail('BBOOT-STATE-001', 'Fresh intake transition is missing or incorrect.');
  if (!repeated || repeated.trigger !== 'شروع' || repeated.to !== 'SAME_STATE') fail('BBOOT-STATE-002', 'Repeated شروع must preserve state.');
  for (const guard of ['preserve_session_id', 'preserve_checkpoint', 'preserve_unresolved_blockers']) {
    if (!(repeated.guards || []).includes(guard)) fail('BBOOT-STATE-003', `Repeated شروع missing ${guard}.`);
  }
  if (!resume || resume.trigger !== 'استارت' || resume.from?.runtime_state !== 'PAUSED') fail('BBOOT-STATE-004', 'Resume transition must originate from PAUSED and use استارت.');
  for (const guard of ['prior_initialized_state_exists', 'session_id_matches', 'package_digest_matches', 'candidate_matches', 'checkpoint_valid', 'unresolved_blockers_preserved']) {
    if (!(resume.guards || []).includes(guard)) fail('BBOOT-STATE-005', `Resume missing ${guard}.`);
  }
  if (!(transitions.forbidden || []).includes('start_command_fabricates_run')) fail('BBOOT-STATE-006', 'استارت fabrication must remain forbidden.');
}

function validateCarriers() {
  for (const relative of activeCarriers) {
    const text = readText(relative);
    for (const token of ['personal_single_operator', 'production_ready: false', 'شروع', 'استارت', 'builder-input.json', 'ev4-builder-context-package@1.0.0']) {
      if (!text.includes(token)) fail('BBOOT-DOC-001', `${relative} missing ${token}.`);
    }
    if (text.includes('/builder-feed-export')) fail('BBOOT-DOC-002', `${relative} retains a historical active route.`);
  }
}

function runMutations(original) {
  const mutations = [
    ['wrong fresh trigger', (value) => { value.canonical_fresh_intake_trigger = 'start'; }],
    ['resume equals fresh', (value) => { value.canonical_resume_trigger = 'شروع'; }],
    ['wrong input Schema', (value) => { value.canonical_input_schema = 'wrong@1'; }],
    ['filename authorizes intake', (value) => { value.filename_matching_is_sufficient_for_acceptance = true; }],
    ['receipt becomes semantic', (value) => { value.receipt_is_semantic_input = true; }],
    ['resume fabricates evidence', (value) => { value.trigger_policy.resume.fabricate_continuation_evidence = true; }],
    ['repeated start drops checkpoints', (value) => { value.trigger_policy.repeated_fresh_intake.preserve_confirmed_checkpoints = false; }],
    ['raw Project Gate extraction enabled', (value) => { value.routing_cases.raw_project_gate_envelope.manual_nested_extraction = true; }],
    ['silent CE fallback enabled', (value) => { value.routing_cases.raw_ce_or_ce_builder_executable.silent_fallback = true; }],
    ['maintenance routed to runtime', (value) => { value.repository_maintenance_exception.start_token_activates_builder_session = true; }]
  ];

  for (const [label, mutate] of mutations) {
    const value = JSON.parse(JSON.stringify(original));
    mutate(value);
    let blocked = false;
    try {
      validateManifest(value);
    } catch {
      blocked = true;
    }
    if (!blocked) fail('BBOOT-MUT-001', `Mutation unexpectedly passed: ${label}`);
  }
}

try {
  validateSchema();
  const manifest = readJson(manifestPath);
  validateManifest(manifest);
  validateTransitions(readJson(transitionsPath));
  validateCarriers();
  runMutations(manifest);
  console.log('Lean Builder bootstrap semantic validation passed.');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
