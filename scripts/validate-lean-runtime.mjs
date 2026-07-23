#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { requireCanonicalTransition } from './lib/builder-runtime-transition.mjs';

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

const requiredNonRuntime = ['exact_head_ci', 'pr_inspector', 'independent_review', 'review_receipt', 'owner_merge_receipt', 'repository_commit_identity'];
for (const item of requiredNonRuntime) {
  if (!authority.non_runtime_authorities.includes(item)) fail(`Missing non-runtime authority classification: ${item}`);
}

const allowed = transitions.allowed_combinations || {};
if ((allowed.START_INTAKE_MODE || []).includes('COMPLETED')) fail('START_INTAKE_MODE must not allow COMPLETED.');
if ((allowed.FRESH_IMAGE_MODE_LIMITED || []).includes('COMPLETED')) fail('FRESH_IMAGE_MODE_LIMITED must not allow COMPLETED.');
if (!(allowed.APPROVED_HANDOFF_MODE || []).includes('COMPLETED')) fail('APPROVED_HANDOFF_MODE must allow bounded Builder completion.');

try {
  requireCanonicalTransition('resume');
  requireCanonicalTransition('complete-builder');
} catch (error) {
  fail(error.message);
}

const completionTransitions = (transitions.transitions || []).filter((entry) => entry?.to?.runtime_state === 'COMPLETED');
if (completionTransitions.length !== 1) fail(`Expected exactly one transition to COMPLETED; found ${completionTransitions.length}.`);

for (const forbidden of [
  'fresh_intake_to_completed',
  'fresh_image_to_completed',
  'completion_report_request_to_completed',
  'resume_without_prior_initialized_state',
  'start_command_fabricates_run',
  'unresolved_blocker_disappears',
  'caller_authored_completed_carrier_as_transition_input',
  'capsule_only_resume_or_completion_authorization',
  'required_action_disappears_by_omission'
]) {
  if (!(transitions.forbidden || []).includes(forbidden)) fail(`Missing forbidden transition invariant: ${forbidden}`);
}

const transitionModule = readText('scripts/lib/builder-runtime-transition.mjs');
for (const symbol of [
  'verifyBuilderInput',
  'verifyIntakeCapsule',
  'verifyRuntimeIdentity',
  'validateResumeTransition',
  'validateCompletionTransition',
  'reconcileRequiredActions',
  'publishDirectoryAtomically'
]) {
  if (!transitionModule.includes(`function ${symbol}`)) fail(`Shared bounded transition module is missing ${symbol}.`);
}

const truthSpine = readText('scripts/lib/builder-truth-spine.mjs');
for (const symbol of [
  'fixtureValidateBuilderInput',
  'createConfirmationReceipt',
  'validateConfirmationReceipt',
  'verifyEvidenceLedger'
]) {
  if (!truthSpine.includes(`function ${symbol}`)) fail(`Shared Builder truth-spine control is missing ${symbol}.`);
}

const explicitSource = readText('scripts/lib/builder-explicit-source-runtime.mjs');
for (const symbol of [
  'resolveExplicitBuilderSource',
  'resolveRealBuilderSource',
  'verifyDerivedContext',
  'writeRealIntake',
  'validateRealCompletion',
  'publishRealCompletion'
]) {
  if (!explicitSource.includes(`function ${symbol}`)) fail(`Explicit source Runtime is missing ${symbol}.`);
}
for (const requiredTerm of [
  "PROJECT_GATE: 'project-gate'",
  "DIRECT_CE: 'direct-ce'",
  "MANUAL_BUILDER_INPUT: 'manual-builder-input'",
  "content_binding_status: 'verified'",
  "source_selection: 'operator_explicit'",
  "origin_assurance: 'not_independently_verified'",
  "origin_assurance: 'manual_operator_supplied'",
  "receipt_binding_status: 'matched'",
  'BUILDER-CONTEXT-113'
]) {
  if (!explicitSource.includes(requiredTerm)) fail(`Explicit source Runtime is missing required invariant: ${requiredTerm}`);
}
for (const forbiddenOriginClaim of [
  "verification_status: 'verified_source_bound'",
  'producer_repository: sourceArtifact',
  'producer_commit_sha: sourceArtifact',
  'producer_artifact_id:',
  'producer_artifact_sha256:'
]) {
  if (explicitSource.includes(forbiddenOriginClaim)) fail(`Explicit source Runtime retains origin-overclaiming code: ${forbiddenOriginClaim}`);
}
for (const forbiddenPlatformTerm of ['event bus', 'plugin guard registry', 'database adapter', 'service layer', 'public key infrastructure', 'signed receipt']) {
  if (`${transitionModule}\n${truthSpine}\n${explicitSource}`.toLowerCase().includes(forbiddenPlatformTerm)) fail(`Generalized or external-security platform term appears in bounded Runtime modules: ${forbiddenPlatformTerm}`);
}

const sessionValidator = readText('scripts/validate-session-state.mjs');
if (sessionValidator.includes('const ALLOWED_BY_MODE = {')) fail('Session validator still maintains a competing hard-coded transition matrix.');
if (!sessionValidator.includes('runtime/state-transitions.v1.json')) fail('Session validator must derive allowed combinations from canonical transition data.');

const inspector = readText('scripts/builder-inspector.mjs');
if (!inspector.includes("from './lib/builder-runtime-transition.mjs'")) fail('Builder Inspector must preserve delegation to the shared bounded transition module.');
if (!inspector.includes("from './lib/builder-explicit-source-runtime.mjs'")) fail('Builder Inspector must delegate active source selection and Completion to the explicit-source Runtime.');
for (const command of ['fixture-validation', 'real-intake', 'confirm-batch', 'real-completion', 'manual-builder-input']) {
  if (!inspector.includes(command)) fail(`Builder Inspector is missing command or source mode: ${command}.`);
}
if (!inspector.includes('resume <builder-input.json>')) fail('Resume CLI must require actual Builder Input.');

const centralValidation = readText('scripts/validate.mjs');
for (const removed of [
  'validate-governance-progress-evidence.mjs',
  'validate-governance-authorities.mjs',
  'validate-governance-sequence.mjs',
  'validate-pr-template-hygiene.mjs'
]) {
  if (centralValidation.includes(removed)) fail(`Industrial governance remains in central validation: ${removed}`);
}
for (const required of [
  'validate-lean-runtime.mjs',
  'test-builder-authority-bypasses.mjs',
  'test-builder-truth-spine.mjs',
  'test-builder-explicit-source-modes.mjs',
  'validate-builder-runtime-transaction.mjs'
]) {
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
for (const file of ['README.md', 'STATUS.md', 'docs/EXPLICIT_SOURCE_MODES.md']) {
  const text = readText(file);
  for (const term of [
    'fixture_validation_is_real_completion: false',
    'real_completion_requires_explicit_source_mode: true',
    'real_completion_requires_deterministic_content_binding: true',
    'origin_identity_independently_verified: false',
    'manual_builder_input_mode_enabled: true',
    'completion_status_runtime_derived: true',
    'completion_gate_runtime_derived: true'
  ]) {
    if (!text.includes(term)) fail(`${file} is missing explicit-source Runtime declaration: ${term}`);
  }
}

if (errors.length > 0) {
  console.error('Lean runtime validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Lean Runtime authority, explicit source modes, deterministic content binding, and canonical transition consistency passed.');
