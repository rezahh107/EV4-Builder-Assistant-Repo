#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadTransitionAuthority } from './lib/runtime-transaction-engine.mjs';

const root = process.cwd();
const errors = [];
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const readText = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => errors.push(message);

const authority = readJson('runtime/personal-runtime-authority.v1.json');
const transitions = readJson('runtime/state-transitions.v1.json');
const scopes = readJson('runtime/completion-scopes.v1.json');
let loadedTransitions = null;
try { loadedTransitions = loadTransitionAuthority(); }
catch (error) { fail(`Canonical transition authority cannot be loaded: ${error.message}`); }

if (authority.schema !== 'ev4-builder-personal-runtime-authority@1.0.0') fail('Unexpected runtime authority schema.');
if (authority.repository_profile !== 'personal_single_operator') fail('repository_profile must be personal_single_operator.');
if (authority.runtime_goal !== 'functional_correctness') fail('runtime_goal must be functional_correctness.');
if (authority.active !== true) fail('Personal runtime authority must be active.');
if (authority.industrial_governance !== 'removed_from_active_system') fail('Industrial governance must remain removed from the active system.');
for (const key of ['independent_review_required', 'pr_inspector_required', 'exact_head_runtime_authority', 'runtime_transaction_per_message_required', 'production_ready']) if (authority[key] !== false) fail(`${key} must be false.`);
if (authority.builder_to_responsive !== 'out_of_scope') fail('Builder to Responsive must remain out of scope.');

for (const file of [
  'scripts/lib/runtime-transaction-engine.mjs', 'runtime/completion-scopes.v1.json', 'schemas/action-ledger.schema.json',
  'schemas/runtime-transition-result.schema.json', 'schemas/resume-result.v1.schema.json', 'schemas/completion-result.v1.schema.json'
]) if (!fs.existsSync(path.join(root, file))) fail(`Missing canonical Runtime Transaction artifact: ${file}`);
if (transitions.authority !== 'executable_by_runtime_transaction_engine') fail('Transition table must declare executable Engine authority.');
if (transitions.engine !== 'scripts/lib/runtime-transaction-engine.mjs') fail('Transition table points to the wrong Engine.');
if (scopes.schema !== 'ev4-builder-completion-scopes@1.0.0' || !scopes.scopes?.desktop_builder_complete) fail('Builder Completion Scope authority is missing.');

const allowed = transitions.allowed_combinations || {};
if ((allowed.START_INTAKE_MODE || []).includes('COMPLETED')) fail('START_INTAKE_MODE must not allow COMPLETED.');
if ((allowed.FRESH_IMAGE_MODE_LIMITED || []).includes('COMPLETED')) fail('FRESH_IMAGE_MODE_LIMITED must not allow COMPLETED.');
if (!(allowed.APPROVED_HANDOFF_MODE || []).includes('COMPLETED')) fail('APPROVED_HANDOFF_MODE must allow bounded Builder completion.');
const completionTransitions = (transitions.transitions || []).filter((entry) => entry?.to?.runtime_state === 'COMPLETED');
if (completionTransitions.length !== 1) fail(`Expected exactly one transition to COMPLETED; found ${completionTransitions.length}.`);
const completion = completionTransitions[0];
if (completion?.from?.workflow_mode !== 'APPROVED_HANDOFF_MODE' || completion?.from?.runtime_state !== 'BUILD_ACTIVE') fail('COMPLETED transition must start from APPROVED_HANDOFF_MODE / BUILD_ACTIVE.');
if (completion?.trigger !== 'completion_validation_passed') fail('COMPLETED transition must require completion_validation_passed.');
const resumeTransition = (transitions.transitions || []).find((entry) => entry.id === 'resume');
if (!(resumeTransition?.forbidden_targets || []).includes('COMPLETED')) fail('Canonical Resume transition must forbid COMPLETED targets.');
for (const guard of ['builder_input_verified', 'intake_capsule_reconciled', 'predecessor_checkpoint_bound', 'action_ledger_reconciled', 'required_actions_complete', 'unresolved_blocking_evidence_count_zero', 'completion_scope_satisfied', 'completion_gate_cross_bound']) {
  if (!(completion.guards || []).includes(guard)) fail(`Completion transition missing guard: ${guard}`);
}
for (const forbidden of ['fresh_intake_to_completed', 'fresh_image_to_completed', 'completion_report_request_to_completed', 'resume_without_prior_initialized_state', 'start_command_fabricates_run', 'unresolved_blocker_disappears', 'caller_preauthors_completed_carriers', 'capsule_only_authorization', 'action_omission_satisfies_completion', 'partial_terminal_publication']) {
  if (!(transitions.forbidden || []).includes(forbidden)) fail(`Missing forbidden transition invariant: ${forbidden}`);
}

const sessionValidator = readText('scripts/validate-session-state.mjs');
const checkpointValidator = readText('scripts/validate-checkpoint.mjs');
if (sessionValidator.includes('ALLOWED_BY_MODE')) fail('Session validator retains a competing hard-coded transition matrix.');
if (!sessionValidator.includes('isAllowedCombination')) fail('Session validator is not mechanically derived from the canonical transition table.');
if (!checkpointValidator.includes('isAllowedCombination')) fail('Checkpoint validator is not mechanically derived from the canonical transition table.');
const inspector = readText('scripts/builder-inspector.mjs');
if (!inspector.includes("from './lib/runtime-transaction-engine.mjs'")) fail('builder-inspector.mjs is not a thin wrapper around the canonical Engine.');
for (const required of ['builderInputFile', 'actionLedgerFile', 'outputDirectory']) if (!inspector.includes(required)) fail(`Builder Inspector CLI is missing canonical argument: ${required}`);

const centralValidation = readText('scripts/validate.mjs');
for (const removed of ['validate-governance-progress-evidence.mjs', 'validate-governance-authorities.mjs', 'validate-governance-sequence.mjs', 'validate-pr-template-hygiene.mjs']) if (centralValidation.includes(removed)) fail(`Industrial governance remains in central validation: ${removed}`);
for (const required of ['validate-lean-runtime.mjs', 'test-builder-inspector.mjs', 'validate-builder-runtime-transaction.mjs']) if (!centralValidation.includes(required)) fail(`Central validation is missing: ${required}`);
for (const workflow of ['.github/workflows/governance-exact-head-evidence.yml', '.github/workflows/verify-project-gate-contract.yml']) if (fs.existsSync(path.join(root, workflow))) fail(`Industrial/external blocking workflow remains active: ${workflow}`);
if (loadedTransitions && loadedTransitions.transitions.length !== transitions.transitions.length) fail('Loaded transition authority differs from canonical JSON.');

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
console.log('Canonical lean Runtime Transaction authority validation passed.');
