#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const readText = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => errors.push(message);

const authority = readJson('runtime/personal-runtime-authority.v1.json');
const transitions = readJson('runtime/state-transitions.v1.json');

if (authority.schema !== 'ev4-builder-personal-runtime-authority@1.0.0') fail('Unexpected runtime authority schema.');
if (authority.repository_profile !== 'personal_single_operator') fail('repository_profile must be personal_single_operator.');
if (authority.runtime_goal !== 'functional_correctness') fail('runtime_goal must be functional_correctness.');
if (authority.active !== true) fail('Personal runtime authority must be active.');
if (authority.industrial_governance !== 'removed_from_active_system') fail('Industrial governance must be removed from the active system.');
for (const key of ['independent_review_required', 'pr_inspector_required', 'exact_head_runtime_authority', 'runtime_transaction_per_message_required', 'production_ready']) {
  if (authority[key] !== false) fail(`${key} must be false.`);
}
if (authority.builder_to_responsive !== 'out_of_scope') fail('Builder to Responsive must remain out of scope.');

const requiredRuntimeAuthorities = [
  'valid_builder_context_input',
  'selected_candidate_id_continuity',
  'decision_lineage_continuity',
  'allowed_action_batch_semantics',
  'active_confirmation_binding',
  'session_state_consistency',
  'checkpoint_consistency',
  'unresolved_blocker_preservation',
  'valid_completion_conditions'
];
for (const item of requiredRuntimeAuthorities) {
  if (!authority.runtime_authorities.includes(item)) fail(`Missing runtime authority: ${item}`);
}

const requiredNonRuntime = [
  'exact_head_ci',
  'pr_inspector',
  'independent_review',
  'review_receipt',
  'owner_merge_receipt',
  'repository_commit_identity'
];
for (const item of requiredNonRuntime) {
  if (!authority.non_runtime_authorities.includes(item)) fail(`Missing non-runtime authority classification: ${item}`);
}

const allowed = transitions.allowed_combinations || {};
if ((allowed.START_INTAKE_MODE || []).includes('COMPLETED')) fail('START_INTAKE_MODE must not allow COMPLETED.');
if ((allowed.FRESH_IMAGE_MODE_LIMITED || []).includes('COMPLETED')) fail('FRESH_IMAGE_MODE_LIMITED must not allow COMPLETED.');
if (!(allowed.APPROVED_HANDOFF_MODE || []).includes('COMPLETED')) fail('APPROVED_HANDOFF_MODE must allow bounded Builder completion.');

const completionTransitions = (transitions.transitions || []).filter((entry) => entry?.to?.runtime_state === 'COMPLETED');
if (completionTransitions.length !== 1) fail(`Expected exactly one transition to COMPLETED; found ${completionTransitions.length}.`);
const completion = completionTransitions[0];
if (completion?.from?.workflow_mode !== 'APPROVED_HANDOFF_MODE' || completion?.from?.runtime_state !== 'BUILD_ACTIVE') {
  fail('COMPLETED transition must start from APPROVED_HANDOFF_MODE / BUILD_ACTIVE.');
}
if (completion?.trigger !== 'completion_validation_passed') fail('COMPLETED transition must require completion_validation_passed.');
for (const guard of ['final_checkpoint_valid', 'package_digest_matches', 'candidate_matches', 'required_actions_complete', 'unresolved_blocking_evidence_count_zero', 'completion_status_valid', 'completion_gate_valid']) {
  if (!(completion.guards || []).includes(guard)) fail(`Completion transition missing guard: ${guard}`);
}

for (const forbidden of ['fresh_intake_to_completed', 'fresh_image_to_completed', 'completion_report_request_to_completed', 'resume_without_prior_initialized_state', 'start_command_fabricates_run', 'unresolved_blocker_disappears']) {
  if (!(transitions.forbidden || []).includes(forbidden)) fail(`Missing forbidden transition invariant: ${forbidden}`);
}

const centralValidation = readText('scripts/validate.mjs');
for (const removed of [
  'validate-governance-progress-evidence.mjs',
  'validate-governance-authorities.mjs',
  'validate-governance-sequence.mjs',
  'validate-pr-template-hygiene.mjs'
]) {
  if (centralValidation.includes(removed)) fail(`Industrial governance remains in central validation: ${removed}`);
}
for (const required of ['validate-lean-runtime.mjs', 'test-builder-inspector.mjs', 'validate-builder-runtime-transaction.mjs']) {
  if (!centralValidation.includes(required)) fail(`Central validation is missing: ${required}`);
}

for (const workflow of ['.github/workflows/governance-exact-head-evidence.yml', '.github/workflows/verify-project-gate-contract.yml']) {
  if (fs.existsSync(path.join(root, workflow))) fail(`Industrial/external blocking workflow remains active: ${workflow}`);
}

const activeDocs = ['AGENTS.md', 'README.md', 'STATUS.md', 'PROJECT_INSTRUCTIONS.md', 'core/MASTER_PROMPT.md', 'core/MODE_STATE_MATRIX.md'];
for (const file of activeDocs) {
  const text = readText(file);
  if (!text.includes('personal_single_operator')) fail(`${file} does not declare personal_single_operator.`);
  if (!text.includes('production_ready: false')) fail(`${file} does not preserve production_ready: false.`);
}

if (errors.length > 0) {
  console.error('Lean runtime validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Lean runtime authority and transition validation passed.');
