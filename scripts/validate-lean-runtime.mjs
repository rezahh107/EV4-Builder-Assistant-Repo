#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { requireCanonicalTransition } from './lib/builder-runtime-transition.mjs';

const root = process.cwd();
const errors = [];
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const readText = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => errors.push(message);
const includesAll = (text, terms, label) => {
  for (const term of terms) if (!text.includes(term)) fail(`${label} is missing required invariant: ${term}`);
};

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

for (const item of [
  'valid_builder_context_input',
  'explicit_source_mode_selection',
  'deterministic_content_binding',
  'selected_candidate_id_continuity',
  'decision_lineage_continuity',
  'allowed_action_batch_semantics',
  'canonical_confirmation_transaction',
  'active_confirmation_binding',
  'canonical_checkpoint_sequence',
  'exact_confirmed_batch_binding',
  'verified_evidence_status',
  'action_specific_execution_evidence',
  'session_state_consistency',
  'checkpoint_consistency',
  'unresolved_blocker_preservation',
  'atomic_confirmation_publication',
  'valid_completion_conditions'
]) {
  if (!authority.runtime_authorities.includes(item)) fail(`Missing runtime authority: ${item}`);
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

const transitionById = Object.fromEntries((transitions.transitions || []).map((entry) => [entry.id, entry]));
const emit = transitionById['emit-batch'];
const confirm = transitionById['confirm-batch'];
if (emit?.from?.runtime_state !== 'BUILD_ACTIVE' || emit?.to?.runtime_state !== 'WAITING_FOR_CONFIRMATION') fail('Canonical emit-batch transition is invalid.');
if (confirm?.from?.runtime_state !== 'WAITING_FOR_CONFIRMATION' || confirm?.to?.runtime_state !== 'BUILD_ACTIVE') fail('Canonical confirm-batch transition is invalid.');
for (const guard of ['checkpoint_sequence_valid', 'batch_matches_context', 'confirmed_action_ids_empty', 'unconfirmed_action_ids_complete', 'derived_waiting_carriers', 'atomic_publication_required']) {
  if (!(emit?.guards || []).includes(guard)) fail(`emit-batch is missing guard: ${guard}`);
}
for (const guard of ['checkpoint_sequence_valid', 'batch_matches_context', 'confirmed_action_ids_empty', 'unconfirmed_action_ids_complete', 'exact_operator_token_matches', 'derived_build_active_carriers', 'receipt_binds_resulting_checkpoint', 'atomic_publication_required']) {
  if (!(confirm?.guards || []).includes(guard)) fail(`confirm-batch is missing guard: ${guard}`);
}
for (const forbidden of [
  'confirm_batch_from_build_active',
  'confirm_batch_from_preconfirmed_carrier',
  'evidence_without_verified_source_status',
  'generic_subject_authorizes_action_execution',
  'completion_batch_drift'
]) {
  if (!(transitions.forbidden || []).includes(forbidden)) fail(`Missing forbidden Runtime path: ${forbidden}`);
}

const transitionModule = readText('scripts/lib/builder-runtime-transition.mjs');
const explicitSource = readText('scripts/lib/builder-explicit-source-runtime.mjs');
const functional = readText('scripts/lib/builder-functional-correctness.mjs');
const sequence = readText('scripts/lib/checkpoint-sequence.mjs');
const inspector = readText('scripts/builder-inspector.mjs');
const centralValidation = readText('scripts/validate.mjs');

includesAll(sequence, [
  'export function checkpointSequenceIsValid',
  'checkpoint_sequence === 1',
  'parent_checkpoint_id === null',
  'parent_checkpoint_id.trim().length > 0'
], 'Canonical checkpoint sequence module');

includesAll(explicitSource, [
  "PROJECT_GATE: 'project-gate'",
  "DIRECT_CE: 'direct-ce'",
  "MANUAL_BUILDER_INPUT: 'manual-builder-input'",
  "source_selection: 'operator_explicit'",
  "content_binding_status: 'verified'",
  "origin_assurance: 'not_independently_verified'",
  "origin_assurance: 'manual_operator_supplied'",
  'BUILDER-CONTEXT-113'
], 'Explicit source Runtime');

includesAll(functional, [
  'validateSourceModeArguments',
  'writeStrictRealIntake',
  'publishEmitBatchTransaction',
  'validateConfirmationTransaction',
  'publishConfirmationTransaction',
  'validateStrictConfirmationReceipt',
  'verifyStrictEvidenceLedger',
  'validateStrictRealCompletion',
  'publishStrictRealCompletion',
  'validateCanonicalResume',
  "source.status !== 'verified'",
  'assertion.subject_ref !== source.action_id',
  'source.subject_ref !== source.action_id',
  'checkpoint.batch_id !== receipt.batch_id',
  'receipt.batch_id !== context.action_batch.batch_id',
  'receipt.selected_candidate_id !== context.selected_candidate_id',
  'receipt.confirmation_id !== context.confirmation.confirmation_id',
  "'confirmation-receipt.json'",
  "'confirmation-result.json'",
  "'checkpoint.json'",
  "'session-state.json'",
  'Atomic Confirmation publication failed; no output was published.'
], 'Functional-correctness Runtime');

for (const forbiddenPlatformTerm of ['event bus', 'plugin guard registry', 'database adapter', 'service layer', 'public key infrastructure']) {
  if (`${transitionModule}\n${explicitSource}\n${functional}`.toLowerCase().includes(forbiddenPlatformTerm)) fail(`Forbidden generalized platform term appears in Runtime code: ${forbiddenPlatformTerm}`);
}

includesAll(inspector, [
  "from './lib/builder-functional-correctness.mjs'",
  'real-intake project-gate',
  'real-intake direct-ce',
  'real-intake manual-builder-input',
  'emit-batch',
  'confirm-batch',
  'real-completion project-gate',
  'real-completion direct-ce',
  'real-completion manual-builder-input',
  'Aliases intake and completion are fixture/compatibility-only'
], 'Builder Inspector CLI');
if (inspector.includes('writeConfirmationReceipt')) fail('Builder Inspector still routes confirm-batch through Receipt-only legacy behavior.');

for (const required of [
  'validate-lean-runtime.mjs',
  'test-builder-authority-bypasses.mjs',
  'test-builder-truth-spine.mjs',
  'test-builder-explicit-source-modes.mjs',
  'test-builder-functional-correctness.mjs',
  'test-project-pack-determinism.mjs',
  'validate-builder-runtime-transaction.mjs'
]) {
  if (!centralValidation.includes(required)) fail(`Central validation is missing: ${required}`);
}

const activeDocs = [
  'AGENTS.md',
  'PROJECT_INSTRUCTIONS.md',
  'core/MASTER_PROMPT.md',
  'core/MODE_STATE_MATRIX.md',
  'README.md',
  'STATUS.md',
  'docs/BUILDER_TRUTH_SPINE.md',
  'docs/EXPLICIT_SOURCE_MODES.md',
  'runtime/project-pack/PROJECT_INSTRUCTIONS.txt',
  'runtime/project-pack/01_RUNTIME_CORE.md',
  'runtime/project-pack/02_INTAKE_INSPECTOR.md',
  'runtime/project-pack/03_STATE_RESUME.md',
  'runtime/project-pack/04_ACTION_CONFIRMATION.md',
  'runtime/project-pack/05_CHECKPOINT_COMPLETION.md',
  'dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt',
  'dist/chatgpt-project/knowledge/01_RUNTIME_CORE.md',
  'dist/chatgpt-project/knowledge/02_INTAKE_INSPECTOR.md',
  'dist/chatgpt-project/knowledge/03_STATE_RESUME.md',
  'dist/chatgpt-project/knowledge/04_ACTION_CONFIRMATION.md',
  'dist/chatgpt-project/knowledge/05_CHECKPOINT_COMPLETION.md'
];
for (const file of activeDocs) {
  const text = readText(file);
  if (!text.includes('production_ready: false')) fail(`${file} does not preserve production_ready: false.`);
  if (!text.includes('real-completion')) fail(`${file} does not identify the actual Completion command.`);
}

for (const file of [
  'AGENTS.md', 'PROJECT_INSTRUCTIONS.md', 'core/MASTER_PROMPT.md', 'README.md', 'STATUS.md',
  'docs/BUILDER_TRUTH_SPINE.md', 'docs/EXPLICIT_SOURCE_MODES.md',
  'runtime/project-pack/PROJECT_INSTRUCTIONS.txt', 'runtime/project-pack/01_RUNTIME_CORE.md',
  'dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt', 'dist/chatgpt-project/knowledge/01_RUNTIME_CORE.md'
]) {
  includesAll(readText(file), [
    'explicit operator source mode',
    'real-intake',
    'emit-batch',
    'WAITING_FOR_CONFIRMATION',
    'confirm-batch',
    'BUILD_ACTIVE',
    'verified Evidence',
    'real-completion',
    'COMPLETED'
  ], file);
}

for (const file of [
  'AGENTS.md', 'PROJECT_INSTRUCTIONS.md', 'README.md', 'docs/BUILDER_TRUTH_SPINE.md',
  'runtime/project-pack/PROJECT_INSTRUCTIONS.txt', 'runtime/project-pack/04_ACTION_CONFIRMATION.md',
  'dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt', 'dist/chatgpt-project/knowledge/04_ACTION_CONFIRMATION.md'
]) {
  includesAll(readText(file), [
    'WAITING_FOR_CONFIRMATION',
    'confirmation-receipt.json',
    'checkpoint.json',
    'session-state.json',
    'confirmation-result.json'
  ], file);
}

for (const file of [
  'AGENTS.md', 'PROJECT_INSTRUCTIONS.md', 'README.md', 'docs/BUILDER_TRUTH_SPINE.md',
  'runtime/project-pack/PROJECT_INSTRUCTIONS.txt', 'runtime/project-pack/05_CHECKPOINT_COMPLETION.md',
  'dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt', 'dist/chatgpt-project/knowledge/05_CHECKPOINT_COMPLETION.md'
]) {
  const text = readText(file);
  if (!text.includes('verified')) fail(`${file} does not require verified Evidence status.`);
  if (!text.includes('required_action_execution') && !text.includes('Action-specific') && !text.includes('Action execution')) fail(`${file} does not document Action-specific execution Evidence.`);
}

for (const file of activeDocs) {
  const text = readText(file);
  for (const forbidden of [
    'node scripts/builder-inspector.mjs intake builder-input.json builder-intake-result.json',
    'node scripts/builder-inspector.mjs completion \\\n',
    'confirm-batch <runtime-context.json> <session-state.json> <checkpoint.json> <operator-token> <confirmation-receipt.json>'
  ]) {
    if (text.includes(forbidden)) fail(`${file} retains contradictory legacy Runtime instruction: ${forbidden.trim()}`);
  }
}

for (const workflow of ['.github/workflows/governance-exact-head-evidence.yml', '.github/workflows/verify-project-gate-contract.yml']) {
  if (fs.existsSync(path.join(root, workflow))) fail(`Industrial/external blocking workflow remains active: ${workflow}`);
}

if (errors.length > 0) {
  console.error('Lean runtime validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Lean Runtime explicit source, canonical Confirmation, sequence, Evidence, Completion, documentation, and Project Pack consistency passed.');
