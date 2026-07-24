#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];

function fail(message) { errors.push(message); }
function readText(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function readJson(file) { return JSON.parse(readText(file)); }
function includesAll(text, terms, label) { for (const term of terms) if (!text.includes(term)) fail(`${label} is missing required invariant: ${term}`); }
function listRuntimeModules(directory) {
  const files = [];
  for (const entry of fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true })) {
    const rel = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listRuntimeModules(rel));
    else if (entry.name.endsWith('.mjs')) files.push(rel.split(path.sep).join('/'));
  }
  return files;
}

const authority = readJson('runtime/personal-runtime-authority.v1.json');
const transitions = readJson('runtime/state-transitions.v1.json');
const runtimeModules = listRuntimeModules('scripts/lib/runtime');
const runtimeCode = runtimeModules.map((file) => readText(file)).join('\n');
const inspector = readText('scripts/builder-inspector.mjs');
const truthSpine = readText('scripts/lib/builder-truth-spine.mjs');
const functional = readText('scripts/lib/builder-functional-correctness.mjs');
const explicitSource = readText('scripts/lib/builder-explicit-source-runtime.mjs');
const centralValidation = readText('scripts/validate.mjs');

if (authority.repository_profile !== 'personal_single_operator') fail('repository_profile must be personal_single_operator.');
if (authority.runtime_goal !== 'functional_correctness') fail('runtime_goal must be functional_correctness.');
if (authority.builder_to_responsive !== 'out_of_scope' || authority.production_ready !== false) fail('Builder to Responsive and production boundary changed.');
for (const field of ['stable_run_root','immutable_state_generations','atomic_current_pointer','local_single_writer_lock','state_loaded_after_lock','internal_source_snapshot','canonical_confirmation_transaction','verified_evidence_status','action_specific_execution_evidence','valid_completion_conditions']) if (!authority.runtime_authorities.includes(field)) fail(`Missing Runtime authority: ${field}`);

includesAll(runtimeCode, [
  "path.join(run, '.mutation-lock')",
  "readJson(path.join(run, 'CURRENT.json'))",
  'generationRef(number)',
  "fs.renameSync(currentTemporary, path.join(run, 'CURRENT.json'))",
  'for (const [filename, bytes] of expected.generationFiles)',
  "injectedPoint(failureInjection, 'after_lock_acquisition')",
  "injectedPoint(failureInjection, 'after_active_generation_load')",
  'RUN_BUSY_OR_STALE_LOCK',
  'before_CURRENT_rename',
  'after_CURRENT_rename',
  'deriveExpectedSuccessorSnapshot',
  'listFutureGenerations',
  'loadExactSuccessorCandidate',
  'compareSuccessorToExpected',
  'finalizeExistingExactSuccessor',
  'detectCommittedTransitionReplay',
  'RUN_UNCOMMITTED_SUCCESSOR_CONFLICT',
  'RUN_UNCOMMITTED_SUCCESSOR_INCOMPLETE',
  'RUN_AMBIGUOUS_FUTURE_GENERATIONS',
  'recoverRunLock',
  'inspectRunGenerations'
], 'Canonical generation Runtime');
if (runtimeCode.includes('replaceRunAtomically')) fail('Run-root replacement implementation remains active.');
if (runtimeCode.includes('fs.renameSync(target, backup)')) fail('Active Run-root backup swap remains.');
if (runtimeCode.includes("writeJson(path.join(stage, 'run-manifest.json')")) fail('Mutable top-level Run manifest publication remains.');
if (runtimeCode.includes("writeJson(path.join(stage, 'runtime-context.json')")) fail('Mutable top-level Runtime Context publication remains.');
if (runtimeCode.includes("writeJson(path.join(stage, 'session-state.json')")) fail('Mutable top-level Session publication remains.');
if (runtimeCode.includes("writeJson(path.join(stage, 'checkpoint.json')")) fail('Mutable top-level Checkpoint publication remains.');
const mutationStart = runtimeCode.indexOf('export function withRunMutation');
const mutationEnd = runtimeCode.indexOf('export function intakeResultRefs');
const mutationFunction = mutationStart >= 0 && mutationEnd > mutationStart ? runtimeCode.slice(mutationStart, mutationEnd) : '';
if (!mutationFunction) fail('Canonical mutation wrapper is missing.');
else {
  if (mutationFunction.indexOf('acquireRunLock') > mutationFunction.indexOf('loadRunUnlocked')) fail('Canonical State is loaded before lock acquisition.');
  if (!mutationFunction.includes('releaseRunLock')) fail('Run lock is not released in canonical mutation wrapper.');
}

includesAll(inspector, ['real-intake <project-gate|direct-ce|manual-builder-input>','emit-batch <run-directory>','confirm-batch <run-directory>','attach-evidence <run-directory>','real-completion <run-directory>','inspect-run-generations <run-directory>','recover-run-lock <run-directory>'], 'Builder Inspector CLI');
for (const [file, text] of [['scripts/lib/builder-truth-spine.mjs', truthSpine],['scripts/lib/builder-functional-correctness.mjs', functional],['scripts/lib/builder-explicit-source-runtime.mjs', explicitSource]]) if (!text.includes('BUILDER-LEGACY-AUTHORITY-INACTIVE')) fail(`${file} does not explicitly disable Legacy real authority.`);
for (const [file, text] of [['scripts/lib/builder-truth-spine.mjs', truthSpine],['scripts/lib/builder-functional-correctness.mjs', functional]]) {
  if (text.includes('builder_build_complete: true')) fail(`${file} can still claim real Builder Completion.`);
  if (text.includes('publishDirectoryAtomically')) fail(`${file} can still publish caller-managed State carriers.`);
}
for (const name of ['resolveRealBuilderSource','writeRealIntake','validateRealCompletion','publishRealCompletion']) {
  const expression = new RegExp(`export function ${name}\\([^)]*\\) \\{ return inactiveLegacyAuthority`);
  if (!expression.test(explicitSource)) fail(`scripts/lib/builder-explicit-source-runtime.mjs does not fail closed for ${name}.`);
}

const transitionById = Object.fromEntries((transitions.transitions || []).map((entry) => [entry.id, entry]));
for (const id of ['real-intake','emit-batch','confirm-batch','attach-evidence','complete-builder']) {
  const transition = transitionById[id];
  if (!transition || transition.authority_scope !== 'canonical_real_run' || transition.real_run_authority !== true) fail(`Canonical transition metadata is invalid: ${id}`);
}
for (const id of ['resume','fixture-completion']) {
  const transition = transitionById[id];
  if (!transition || transition.authority_scope !== 'compatibility_only' || transition.real_run_authority !== false) fail(`Compatibility transition metadata is invalid: ${id}`);
}
const completionGuards = transitionById['complete-builder']?.guards || [];
for (const guard of ['run_root_valid','current_pointer_valid','active_generation_valid','run_lock_held','internal_source_snapshot_hash_matches','full_runtime_context_rederivation_matches','canonical_confirmation_artifacts_valid','confirmed_checkpoint_lineage_valid','batch_matches_context','confirmed_action_set_complete','action_body_digests_match','internal_evidence_snapshots_valid','required_action_evidence_complete','required_completion_claims_complete','active_blocker_set_empty','checkpoint_sequence_valid','successor_generation_valid','runtime_derived_completion_status','runtime_derived_completion_gate','atomic_generation_publication','atomic_current_pointer_update']) if (!completionGuards.includes(guard)) fail(`Completion State Machine is missing guard: ${guard}`);
for (const outdated of ['builder_input_verified','intake_capsule_verified','completion_status_valid','completion_gate_bound']) if (completionGuards.includes(outdated)) fail(`Completion State Machine retains Legacy guard: ${outdated}`);

for (const required of ['scripts/test-builder-historical-bypass-records.mjs','scripts/test-builder-authority-bypasses.mjs','scripts/test-builder-explicit-source-modes.mjs','scripts/test-builder-truth-spine.mjs','scripts/test-builder-functional-correctness.mjs','scripts/test-builder-atomic-run-bundle.mjs','scripts/test-builder-successor-reconciliation.mjs','scripts/test-builder-run-concurrency.mjs','scripts/test-builder-run-crash-recovery.mjs','scripts/validate-canonical-run-artifacts.mjs','scripts/validate-lean-runtime.mjs','scripts/test-project-pack-determinism.mjs']) {
  if (!centralValidation.includes(required)) fail(`Central validation is missing: ${required}`);
  if (!fs.existsSync(path.join(ROOT, required))) fail(`Required validation file is missing: ${required}`);
}

const activeDocs = ['AGENTS.md','PROJECT_INSTRUCTIONS.md','README.md','STATUS.md','core/MASTER_PROMPT.md','core/MODE_STATE_MATRIX.md','docs/BUILDER_TRUTH_SPINE.md','docs/EXPLICIT_SOURCE_MODES.md','runtime/project-pack/PROJECT_INSTRUCTIONS.txt','runtime/project-pack/01_RUNTIME_CORE.md','runtime/project-pack/02_INTAKE_INSPECTOR.md','runtime/project-pack/03_STATE_RESUME.md','runtime/project-pack/04_ACTION_CONFIRMATION.md','runtime/project-pack/05_CHECKPOINT_COMPLETION.md','dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt','dist/chatgpt-project/knowledge/01_RUNTIME_CORE.md','dist/chatgpt-project/knowledge/02_INTAKE_INSPECTOR.md','dist/chatgpt-project/knowledge/03_STATE_RESUME.md','dist/chatgpt-project/knowledge/04_ACTION_CONFIRMATION.md','dist/chatgpt-project/knowledge/05_CHECKPOINT_COMPLETION.md'];
const declarations = ['external_source_after_intake: not_used','caller_authored_initial_state: forbidden','caller_managed_carrier_selection: forbidden','legacy_runtime_authority: inactive','run_root_replacement: forbidden','active_generation_mutation: forbidden','mutation_without_run_lock: forbidden','state_load_before_lock: forbidden','current_pointer_to_partial_generation: forbidden','lost_update: forbidden','responsive_complete: false','production_ready: false'];
for (const file of activeDocs) {
  if (!fs.existsSync(path.join(ROOT, file))) { fail(`Active Runtime document is missing: ${file}`); continue; }
  const text = readText(file);
  includesAll(text, declarations, file);
  includesAll(text, ['CURRENT.json','generations/000001','.mutation-lock','WAITING_FOR_CONFIRMATION','attach-evidence','COMPLETED'], file);
  for (const forbidden of ['<runtime-context.json> <session-state.json> <checkpoint.json>',"writeJson(path.join(stage, 'checkpoint.json')",'highest-numbered generation becomes active']) if (text.includes(forbidden)) fail(`${file} contains contradictory Runtime guidance: ${forbidden}`);
}
if (!runtimeModules.includes('scripts/lib/runtime/canonical-run-runtime.mjs')) fail('Canonical Runtime module is missing.');
if (!runtimeModules.includes('scripts/lib/runtime/runtime-test-fixtures.mjs')) fail('Runtime test fixture helper is missing.');

if (errors.length) {
  console.error('Lean Runtime validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Lean Runtime stable root, immutable generations, exact successor reconciliation, atomic CURRENT, local locking, Legacy isolation, replay, concurrency, crash recovery, and documentation consistency passed.');
