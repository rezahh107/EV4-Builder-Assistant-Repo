#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { computePackageDigest } from './lib/builder-package-identity.mjs';
import { validatePersonalTransition } from './lib/builder-personal-transition.mjs';

const ROOT = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-builder-inspector-tests-'));
const inspector = path.join(ROOT, 'scripts', 'builder-inspector.mjs');

function writeJson(name, value) {
  const file = path.join(temp, name);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return file;
}

function run(args, expected = 0) {
  const result = spawnSync(process.execPath, [inspector, ...args], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== expected) throw new Error(`Command failed expectation (${expected}): ${args.join(' ')}\nstdout=${result.stdout}\nstderr=${result.stderr}`);
  return result;
}

function packageFixture() {
  return {
    schema: 'ev4-builder-context-package@1.0.0',
    source_stage: '/builder-feed-export',
    source_handoff_stage: '/handoff-export',
    package_status: 'ready',
    selected_candidate_id: 'CANDIDATE-PERSONAL-001',
    selected_candidate_locked: true,
    production_ready_allowed: false,
    source_payload_ledger: [{ payload_name: 'CE Builder Executable Package', schema: 'ev4-builder-executable-package@1.0.0', status: 'executable_ready', source_ref: 'fixture' }],
    approved_structure_tree: [{ node_id: 'n-001', structure_label: 'Root', class_name: 'fixture__root', element_type: 'Container', element_generation: 'Shared compatibility element', element_generation_source: 'builder_context_package', role: 'root', children: [] }],
    class_creation_application_map: [{ class_name: 'fixture__root', elementor_class_scope: 'Local Classes', related_structure_label: 'Root', elementor_node_or_element: 'n-001', when_to_create: 'create root', reusable_or_one_off: 'section_scoped', purpose: 'fixture root', css_needed_now: 'no' }],
    widget_mapping_table: [{ structure_label: 'Root', class_name: 'fixture__root', recommended_widget_or_element: 'Container', editable_content: 'none', why_this_mapping: 'Fixture root.', unknowns: [] }],
    editable_content_map: [],
    decoration_only_map: [],
    asset_replacement_map: [],
    scoped_css_need_map: [],
    responsive_qa_seed: { unresolved_breakpoints: ['tablet', 'mobile'], connector_behavior_status: 'not_applicable', meaningful_content_visibility_rule: 'preserve', notes: 'fixture' },
    forbidden_work: ['do_not_change_selected_candidate'],
    first_builder_batch: { max_actions: 1, actions: [{ action_id: 'BATCH-001-A01', target_element: 'Root', element_type: 'Container', element_generation: 'Shared compatibility element', element_generation_source: 'builder_context_package', structure_panel_name: 'Root', active_class: 'fixture__root', active_class_scope: 'Local Classes', instruction: 'Create Root.', properties_not_to_change: ['selected_candidate_id'], expected_result: 'Root exists.' }] },
    confirmation_request: { confirmation_id: 'CONFIRM-BATCH-001', confirmed_action_ids: ['BATCH-001-A01'], expected_user_token: 'تایید BATCH-001', template_id: 'standard_batch_confirmation' },
    task_type: 'pure_execution',
    visual_reference_present: false,
    visual_parity_expected: false,
    reference_artifact_type: 'none'
  };
}

function checkpoint(pkg, state, complete = false) {
  const evidence = {
    evidence_id: 'EV-001', evidence_type: 'user_confirmation', source_ref: 'test', captured_at: '2026-07-22T00:00:00Z',
    content_sha256: 'b'.repeat(64), supports_claim_ids: ['ASSERT-001'], status: 'available'
  };
  return {
    schema: 'ev4-builder-checkpoint@0.2.0', checkpoint_id: `CP-${state}`, checkpoint_sequence: complete ? 2 : 1,
    parent_checkpoint_id: complete ? 'CP-BUILD_ACTIVE' : null, package_id: 'builder-input.json', package_sha256: computePackageDigest(pkg),
    selected_candidate_id: pkg.selected_candidate_id, workflow_mode: 'APPROVED_HANDOFF_MODE', runtime_state: state, batch_id: 'BATCH-001',
    confirmed_action_ids: complete ? ['BATCH-001-A01'] : [], unconfirmed_action_ids: complete ? [] : ['BATCH-001-A01'],
    assertions: [{ assertion_id: 'ASSERT-001', subject_ref: 'BATCH-001-A01', claim: 'Root exists.', status: complete ? 'confirmed' : 'not_checked', evidence_refs: complete ? ['EV-001'] : [] }],
    evidence_ledger: complete ? [evidence] : [],
    retry_policy: { max_retry_per_action: 3, retry_1: 'clarify_instruction', retry_2: 'request_targeted_screenshot', retry_3: 'enter_CORRECTION' },
    created_at: '2026-07-22T00:00:00Z', created_from: complete ? 'user_confirmation' : 'initial'
  };
}

function session(pkg, cp, state, unresolved = []) {
  return {
    schema: 'ev4-builder-session-state@0.1.0', workflow_mode: 'APPROVED_HANDOFF_MODE', runtime_state: state,
    state_capsule: `[STATE workflow=APPROVED_HANDOFF_MODE state=${state} cp=${cp.checkpoint_id} batch=BATCH-001 risk=${unresolved.length ? 'blocked' : 'low'}]`,
    current_state: state, selected_candidate_id: pkg.selected_candidate_id, last_verified_checkpoint: cp, max_actions_per_turn: 5,
    active_warnings: [], unresolved_evidence: unresolved
  };
}

function completionStatus() {
  return {
    schema: 'ev4-completion-status@1.0.0', reference_paradigm_lock_present: false, scope_excludes_responsive: true,
    claim_scope: 'section', production_ready: false, evidence: {},
    states: { scaffold_built: true, structure_built: true, content_filled: true, desktop_layout_established: true, desktop_reference_paradigm_matched: false, desktop_visual_parity_checked: false, tablet_checked: false, mobile_checked: false, accessibility_checked: false, browser_checked: false, export_checked: false, final_frontend_QA_checked: false }
  };
}

function completionGate(pkg) {
  const proof = { status: 'not_applicable', evidence_refs: [] };
  return {
    schema: 'ev4-completion-gate@0.1.0', gate_id: 'GATE-PERSONAL-001', selected_candidate_id: pkg.selected_candidate_id,
    source_package_ref: 'builder-input.json', layout_check_ref: 'not-required-personal-fixture', production_ready_allowed: false,
    production_ready_claim: false,
    proofs: { layout_verified: proof, frontend_verified: proof, responsive_verified: proof, accessibility_verified: proof, browser_verified: proof, export_verified: proof, final_qa_verified: proof },
    required_next_action: 'keep_production_ready_false', reason: 'Builder completion only.'
  };
}

try {
  const pkg = packageFixture();
  const input = writeJson('builder-input.json', pkg);
  const sourceBefore = fs.readFileSync(input);
  const intake = path.join(temp, 'builder-intake-authorization.json');
  run(['intake', '--input', input, '--output', intake, '--session-id', 'BSESSION-TEST-001']);
  run(['verify-capsule', '--input', input, '--capsule', intake]);
  if (!sourceBefore.equals(fs.readFileSync(input))) throw new Error('Inspector modified source input.');

  const byteMutated = path.join(temp, 'byte-mutated.json');
  fs.writeFileSync(byteMutated, `${fs.readFileSync(input, 'utf8')} `);
  run(['verify-capsule', '--input', byteMutated, '--capsule', intake], 1);

  const editedCapsule = JSON.parse(fs.readFileSync(intake, 'utf8'));
  editedCapsule.selected_candidate_id = 'HAND-EDITED';
  const editedCapsulePath = writeJson('edited-capsule.json', editedCapsule);
  run(['verify-capsule', '--input', input, '--capsule', editedCapsulePath], 1);

  const wrongSchema = writeJson('wrong-schema.json', { ...pkg, schema: 'wrong@1' });
  run(['intake', '--input', wrongSchema, '--output', path.join(temp, 'wrong-schema-result.json')], 1);
  const semantic = writeJson('semantic-invalid.json', { ...pkg, selected_candidate_locked: false });
  run(['intake', '--input', semantic, '--output', path.join(temp, 'semantic-result.json')], 1);
  const lineage = writeJson('lineage-invalid.json', { ...pkg, source_payload_ledger: [...pkg.source_payload_ledger, { payload_name: 'Kernel_Decision_Lineage', schema: 'ev4-kernel-decision-lineage@1.0.0', status: 'available' }] });
  run(['intake', '--input', lineage, '--output', path.join(temp, 'lineage-result.json')], 1);
  const staleAuthPkg = JSON.parse(JSON.stringify(pkg));
  staleAuthPkg.input_authorization = { decision: 'approved', eligible_workflow_mode: 'APPROVED_HANDOFF_MODE', eligible_runtime_state: 'BUILD_ACTIVE', package_digest: { algorithm: 'sha256', scope: 'canonical_package_without_digest', value: '0'.repeat(64) }, blocking_diagnostics: [], visible_flags: [] };
  run(['intake', '--input', writeJson('stale-auth.json', staleAuthPkg), '--output', path.join(temp, 'stale-auth-result.json')], 1);
  run(['intake', '--input', writeJson('receipt.json', { schema_version: 2, status: 'accepted' }), '--output', path.join(temp, 'receipt-result.json')], 1);
  run(['intake', '--input', writeJson('raw-envelope.json', { final_stage_bundle: {}, downstream_artifact: {} }), '--output', path.join(temp, 'envelope-result.json')], 1);
  const existing = path.join(temp, 'existing.json'); fs.writeFileSync(existing, 'SENTINEL');
  run(['intake', '--input', input, '--output', existing], 1);
  if (fs.readFileSync(existing, 'utf8') !== 'SENTINEL') throw new Error('Existing output was overwritten without --replace.');

  const cpActive = writeJson('checkpoint-active.json', checkpoint(pkg, 'BUILD_ACTIVE'));
  const ssActive = writeJson('session-active.json', session(pkg, read(cpActive), 'BUILD_ACTIVE'));
  const stateActive = path.join(temp, 'state-active.json');
  run(['snapshot', '--input', input, '--capsule', intake, '--session-state', ssActive, '--checkpoint', cpActive, '--event', 'intake_authorized', '--output', stateActive]);

  const cpPausedObj = checkpoint(pkg, 'PAUSED');
  const cpPaused = writeJson('checkpoint-paused.json', cpPausedObj);
  const ssPaused = writeJson('session-paused.json', session(pkg, cpPausedObj, 'PAUSED'));
  const statePaused = path.join(temp, 'state-paused.json');
  run(['snapshot', '--input', input, '--capsule', intake, '--session-state', ssPaused, '--checkpoint', cpPaused, '--event', 'pause', '--previous-state-capsule', stateActive, '--previous-resumable-state', 'BUILD_ACTIVE', '--output', statePaused]);
  run(['resume', '--input', input, '--capsule', intake, '--state-capsule', statePaused, '--session-state', ssPaused, '--checkpoint', cpPaused, '--output', path.join(temp, 'resume.json')]);

  const staleCheckpoint = JSON.parse(fs.readFileSync(cpPaused, 'utf8')); staleCheckpoint.checkpoint_id = 'STALE';
  const staleCheckpointPath = writeJson('checkpoint-stale.json', staleCheckpoint);
  run(['resume', '--input', input, '--capsule', intake, '--state-capsule', statePaused, '--session-state', ssPaused, '--checkpoint', staleCheckpointPath, '--output', path.join(temp, 'resume-stale.json')], 1);

  const illegal = validatePersonalTransition(JSON.parse(fs.readFileSync(stateActive, 'utf8')), { ...JSON.parse(fs.readFileSync(stateActive, 'utf8')), runtime_state: 'COMPLETED' }, 'completion_accepted', { completionAuthorized: false });
  if (!illegal.some((item) => item.code === 'BINS-TRN-011')) throw new Error('Illegal completion transition was not blocked.');
  const repeated = validatePersonalTransition(JSON.parse(fs.readFileSync(stateActive, 'utf8')), JSON.parse(fs.readFileSync(stateActive, 'utf8')), 'repeated_start');
  if (repeated.length > 0) throw new Error(`Repeated start did not preserve state: ${JSON.stringify(repeated)}`);
  const uninitializedResume = validatePersonalTransition(null, { ...JSON.parse(fs.readFileSync(stateActive, 'utf8')), event: 'resume' }, 'resume');
  if (uninitializedResume.length === 0) throw new Error('Resume initialized a new session.');

  const cpCompleteObj = checkpoint(pkg, 'BUILD_ACTIVE', true);
  const cpComplete = writeJson('checkpoint-complete-active.json', cpCompleteObj);
  const ssCompleteActive = writeJson('session-complete-active.json', session(pkg, cpCompleteObj, 'BUILD_ACTIVE'));
  const beforeComplete = path.join(temp, 'state-before-completion.json');
  run(['snapshot', '--input', input, '--capsule', intake, '--session-state', ssCompleteActive, '--checkpoint', cpComplete, '--event', 'intake_authorized', '--output', beforeComplete]);

  const cpFinalObj = checkpoint(pkg, 'COMPLETED', true);
  const cpFinal = writeJson('checkpoint-final.json', cpFinalObj);
  const ssFinal = writeJson('session-final.json', session(pkg, cpFinalObj, 'COMPLETED'));
  const finalState = path.join(temp, 'state-final.json');
  run(['snapshot', '--input', input, '--capsule', intake, '--session-state', ssFinal, '--checkpoint', cpFinal, '--event', 'completion_accepted', '--previous-state-capsule', beforeComplete, '--completion-authorized', '--output', finalState]);
  const status = writeJson('completion-status.json', completionStatus());
  const gate = writeJson('completion-gate.json', completionGate(pkg));
  const completionOutput = path.join(temp, 'completion-authorization.json');
  run(['completion', '--input', input, '--capsule', intake, '--previous-state-capsule', beforeComplete, '--state-capsule', finalState, '--session-state', ssFinal, '--checkpoint', cpFinal, '--completion-status', status, '--completion-gate', gate, '--output', completionOutput]);
  const acceptedCompletion = JSON.parse(fs.readFileSync(completionOutput, 'utf8'));
  if (acceptedCompletion.responsive_complete !== false || acceptedCompletion.production_ready !== false) throw new Error('Builder completion leaked downstream readiness claims.');

  const incompleteCpObj = checkpoint(pkg, 'COMPLETED', false);
  const incompleteCp = writeJson('checkpoint-incomplete.json', incompleteCpObj);
  const incompleteSession = writeJson('session-incomplete.json', session(pkg, incompleteCpObj, 'COMPLETED'));
  run(['completion', '--input', input, '--capsule', intake, '--previous-state-capsule', beforeComplete, '--state-capsule', finalState, '--session-state', incompleteSession, '--checkpoint', incompleteCp, '--completion-status', status, '--completion-gate', gate, '--output', path.join(temp, 'completion-blocked.json')], 1);

  console.log('Builder Inspector integration and transition tests passed.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
