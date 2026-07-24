#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const readText = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const readJson = (file) => JSON.parse(readText(file));
const fail = (message) => errors.push(message);
const requireTerms = (file, terms) => {
  const text = readText(file);
  for (const term of terms) if (!text.includes(term)) fail(`${file} is missing required invariant: ${term}`);
  return text;
};

const authority = readJson('runtime/personal-runtime-authority.v1.json');
const transitions = readJson('runtime/state-transitions.v1.json');
if (authority.schema !== 'ev4-builder-personal-runtime-authority@1.0.0') fail('Unexpected personal Runtime authority schema.');
if (authority.repository_profile !== 'personal_single_operator' || authority.runtime_goal !== 'functional_correctness' || authority.active !== true) fail('Personal functional Runtime authority is not active.');
for (const key of ['independent_review_required', 'pr_inspector_required', 'exact_head_runtime_authority', 'runtime_transaction_per_message_required', 'production_ready']) if (authority[key] !== false) fail(`${key} must remain false.`);
if (authority.builder_to_responsive !== 'out_of_scope') fail('Builder → Responsive must remain out of scope.');
for (const item of [
  'runtime_owned_atomic_run_bundle',
  'internal_source_snapshot',
  'external_source_independence_after_intake',
  'runtime_derived_initial_state',
  'pre_emission_full_rederivation',
  'shared_active_blocker_collection',
  'atomic_emit_batch_publication',
  'lightweight_confirmation_reconciliation',
  'internal_evidence_snapshot',
  'full_completion_rederivation',
  'atomic_completion_publication',
  'legacy_runtime_authority_inactive',
  'responsive_scope_excluded',
  'production_readiness_excluded'
]) if (!(authority.runtime_authorities || []).includes(item)) fail(`Missing Runtime authority: ${item}`);

const transitionById = Object.fromEntries((transitions.transitions || []).map((entry) => [entry.id, entry]));
for (const id of ['real-intake', 'emit-batch', 'confirm-batch', 'attach-evidence', 'complete-builder']) if (!transitionById[id]) fail(`Canonical transition is missing: ${id}`);
if (transitionById['emit-batch']?.from?.runtime_state !== 'BUILD_ACTIVE' || transitionById['emit-batch']?.to?.runtime_state !== 'WAITING_FOR_CONFIRMATION') fail('emit-batch State transition is invalid.');
if (transitionById['confirm-batch']?.from?.runtime_state !== 'WAITING_FOR_CONFIRMATION' || transitionById['confirm-batch']?.to?.runtime_state !== 'BUILD_ACTIVE') fail('confirm-batch State transition is invalid.');
for (const forbidden of ['caller_authored_initial_state', 'caller_managed_carrier_selection', 'external_source_dependency_after_intake', 'legacy_real_authority_entrypoint', 'partial_intake_publication', 'partial_emit_publication', 'partial_confirmation_publication', 'partial_evidence_publication', 'partial_completion_publication']) if (!(transitions.forbidden || []).includes(forbidden)) fail(`Missing forbidden Runtime path: ${forbidden}`);

const canonical = requireTerms('scripts/lib/runtime/canonical-run-runtime.mjs', [
  'export function initializeAtomicRun',
  'export function emitRunBatch',
  'export function confirmRunBatch',
  'export function attachRunEvidence',
  'export function completeRun',
  'export function collectActiveBlockers',
  'source/selected-source.json',
  'source/project-gate-receipt.json',
  'run-manifest.json',
  'replaceRunAtomically',
  "source.status !== 'verified'",
  'fullDeriveAndCompare',
  'CANONICAL_REAL_OPERATIONS'
]);
for (const forbidden of ['event bus', 'database adapter', 'service layer', 'public key infrastructure', 'signed receipt']) if (canonical.toLowerCase().includes(forbidden)) fail(`Canonical Runtime contains forbidden platform/security term: ${forbidden}`);

const inspector = requireTerms('scripts/builder-inspector.mjs', [
  "from './lib/runtime/canonical-run-runtime.mjs'",
  'real-intake <project-gate|direct-ce|manual-builder-input> <source-artifact.json|-> <builder-input.json|-> <run-directory>',
  'emit-batch <run-directory>',
  'confirm-batch <run-directory> <operator-token>',
  'attach-evidence <run-directory> <evidence-source.json>',
  'real-completion <run-directory>',
  'Only the Run-directory commands are real Runtime authority'
]);
for (const forbidden of [
  'emit-batch <runtime-context.json>',
  'confirm-batch <runtime-context.json>',
  'real-completion project-gate',
  'real-completion direct-ce',
  'real-completion manual-builder-input',
  'publishStrictRealCompletion',
  'writeStrictRealIntake'
]) if (inspector.includes(forbidden)) fail(`Builder Inspector retains active multi-carrier/legacy authority: ${forbidden}`);

const legacy = requireTerms('scripts/lib/builder-functional-correctness.mjs', [
  'BUILDER-LEGACY-AUTHORITY-INACTIVE',
  'legacy_fixture_and_historical_reproduction_only',
  'export function validateCanonicalResume'
]);
if (legacy.includes('publishDirectoryAtomically(')) fail('Legacy functional facade can still publish real Runtime State.');

for (const schema of [
  'schemas/run-manifest.schema.json',
  'schemas/real-intake-result.v2.schema.json',
  'schemas/emit-batch-result.v2.schema.json',
  'schemas/confirmation-result.v2.schema.json',
  'schemas/confirmation-receipt.v2.schema.json',
  'schemas/evidence-attachment-result.v1.schema.json',
  'schemas/completion-result.v2.schema.json'
]) if (!fs.existsSync(path.join(root, schema))) fail(`Generated-artifact Schema is missing: ${schema}`);

const central = readText('scripts/validate.mjs');
for (const required of [
  'validate-canonical-run-artifacts.mjs',
  'test-builder-atomic-run-bundle.mjs',
  'test-builder-authority-bypasses.mjs',
  'test-builder-explicit-source-modes.mjs',
  'test-builder-truth-spine.mjs',
  'test-builder-functional-correctness.mjs',
  'test-project-pack-determinism.mjs'
]) if (!central.includes(required)) fail(`Central validation is missing: ${required}`);

const activeDocs = [
  'AGENTS.md', 'PROJECT_INSTRUCTIONS.md', 'README.md', 'STATUS.md',
  'core/MASTER_PROMPT.md', 'core/MODE_STATE_MATRIX.md',
  'docs/BUILDER_TRUTH_SPINE.md', 'docs/EXPLICIT_SOURCE_MODES.md',
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
  if (!fs.existsSync(path.join(root, file))) {
    fail(`Active Runtime surface is missing: ${file}`);
    continue;
  }
  const text = readText(file);
  for (const term of ['production_ready: false', 'responsive_complete: false']) if (!text.includes(term)) fail(`${file} is missing ${term}.`);
  for (const forbidden of ['emit-batch <runtime-context.json>', 'confirm-batch <runtime-context.json>', 'real-completion project-gate', 'real-completion direct-ce', 'real-completion manual-builder-input']) if (text.includes(forbidden)) fail(`${file} retains contradictory multi-carrier CLI: ${forbidden}`);
}

for (const file of [
  'AGENTS.md', 'PROJECT_INSTRUCTIONS.md', 'README.md', 'STATUS.md',
  'core/MASTER_PROMPT.md', 'core/MODE_STATE_MATRIX.md',
  'runtime/project-pack/PROJECT_INSTRUCTIONS.txt',
  'dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt'
]) requireTerms(file, [
  'Atomic Run Bundle',
  'internal source snapshot',
  'real-intake',
  'emit-batch',
  'WAITING_FOR_CONFIRMATION',
  'confirm-batch',
  'attach-evidence',
  'real-completion',
  'external_source_after_intake: not_used',
  'caller_authored_initial_state: forbidden',
  'caller_managed_carrier_selection: forbidden',
  'legacy_runtime_authority: inactive'
]);

for (const workflow of ['.github/workflows/governance-exact-head-evidence.yml', '.github/workflows/verify-project-gate-contract.yml']) if (fs.existsSync(path.join(root, workflow))) fail(`Industrial/external blocking workflow remains active: ${workflow}`);

if (errors.length) {
  console.error('Lean Runtime validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Lean Runtime Atomic Run Bundle, internal snapshot, canonical authority, generated artifacts, and documentation consistency passed.');
