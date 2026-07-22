import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { computeCanonicalDigest } from './lib/canonical-builder-package.mjs';

export const ROOT = process.cwd();
export const INSPECTOR = path.join(ROOT, 'scripts', 'builder-inspector.mjs');
export const SOURCE_FIXTURE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'builder_context_package.json');
export const clone = (value) => structuredClone(value);

export function createHarness() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-runtime-engine-'));
  const failures = [];
  const writeJson = (name, value) => {
    const file = path.join(temp, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    return file;
  };
  const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const run = (args, env = {}) => spawnSync(process.execPath, [INSPECTOR, ...args], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, shell: false,
    env: { ...process.env, ...env }
  });
  const fail = (message) => failures.push(message);
  const expectCli = (label, args, expectedExit, expectedStatus = null, env = {}) => {
    const result = run(args, env);
    if (result.status !== expectedExit) {
      fail(`${label}: expected exit ${expectedExit}, received ${result.status}. ${result.stderr || result.stdout}`);
      return null;
    }
    let parsed = null;
    try { parsed = JSON.parse(result.stdout); } catch { fail(`${label}: output is not machine-readable JSON.`); }
    if (expectedStatus && parsed?.status !== expectedStatus) fail(`${label}: expected ${expectedStatus}, received ${parsed?.status}.`);
    return parsed;
  };
  const expectBlocked = (label, fn) => {
    try {
      const value = fn();
      if (value?.passed === false || value?.status === 'blocked') return;
      fail(`${label}: unexpectedly passed.`);
    } catch (error) {
      if (!(error instanceof Error)) fail(`${label}: threw a non-Error value.`);
    }
  };
  const expectPassed = (label, value) => {
    if (value?.passed !== true) fail(`${label}: expected passed=true. ${JSON.stringify(value?.diagnostics || [])}`);
  };

  const source = path.join(temp, 'builder-input.json');
  fs.copyFileSync(SOURCE_FIXTURE, source);
  const capsuleFile = path.join(temp, 'builder-intake-result.json');
  const intake = expectCli('valid intake', ['intake', source, capsuleFile], 0, 'accepted');
  if (!intake) throw new Error('Cannot create Runtime Engine test harness.');
  const capsule = readJson(capsuleFile);
  const verification = {
    passed: true,
    package: readJson(source),
    source_file_sha256: capsule.source_file_sha256,
    canonical_package_digest: capsule.canonical_package_digest,
    selected_candidate_id: capsule.selected_candidate_id,
    builder_context_schema: capsule.builder_context_schema,
    diagnostics: []
  };
  const evidenceLedger = [{
    evidence_id: 'EV-BATCH-001-A01', evidence_type: 'export_json',
    source_ref: 'tests/valid/runtime-transaction/carriers/execution-trace.json',
    captured_at: '2026-07-22T00:01:00Z', content_sha256: 'e'.repeat(64),
    supports_claim_ids: ['ASSERT-BATCH-001-A01'], status: 'available'
  }];
  const ledger = {
    schema: 'ev4-builder-action-ledger@1.0.0', ledger_id: 'LEDGER-SESSION-001', ledger_sequence: 1,
    session_id: 'SESSION-001', package_digest: verification.canonical_package_digest,
    source_file_sha256: verification.source_file_sha256, selected_candidate_id: verification.selected_candidate_id,
    checkpoint_sequence: 1, expected_batch_ids: ['BATCH-001'], expected_required_action_ids: ['BATCH-001-A01'],
    batches: [{ batch_id: 'BATCH-001', required_action_ids: ['BATCH-001-A01'] }],
    actions: [{ action_id: 'BATCH-001-A01', batch_id: 'BATCH-001', status: 'confirmed', confirmation_ref: 'CONFIRM-BATCH-001' }]
  };
  const checkpoint = {
    schema: 'ev4-builder-checkpoint@0.2.0', checkpoint_id: 'ENGINE-CP-001', checkpoint_sequence: 1,
    parent_checkpoint_id: null, session_id: 'SESSION-001', package_id: 'builder-input.json',
    package_sha256: verification.canonical_package_digest, package_digest: verification.canonical_package_digest,
    source_file_sha256: verification.source_file_sha256, selected_candidate_id: verification.selected_candidate_id,
    workflow_mode: 'APPROVED_HANDOFF_MODE', runtime_state: 'BUILD_ACTIVE', batch_id: 'BATCH-001',
    confirmed_action_ids: ['BATCH-001-A01'], unconfirmed_action_ids: [], unresolved_blockers: [],
    action_ledger_id: ledger.ledger_id, action_ledger_sequence: ledger.ledger_sequence,
    action_ledger_digest: computeCanonicalDigest(ledger), evidence_ledger_digest: computeCanonicalDigest(evidenceLedger),
    assertions: [{ assertion_id: 'ASSERT-BATCH-001-A01', subject_ref: 'BATCH-001-A01', claim: 'Root Container exists.', status: 'confirmed', evidence_refs: ['EV-BATCH-001-A01'] }],
    evidence_ledger: evidenceLedger,
    retry_policy: { max_retry_per_action: 3, retry_1: 'clarify_instruction', retry_2: 'request_targeted_screenshot', retry_3: 'enter_CORRECTION' },
    created_at: '2026-07-22T00:01:00Z', created_from: 'export_json'
  };
  const session = {
    schema: 'ev4-builder-session-state@0.1.0', session_id: checkpoint.session_id,
    package_digest: checkpoint.package_digest, source_file_sha256: checkpoint.source_file_sha256,
    workflow_mode: checkpoint.workflow_mode, runtime_state: checkpoint.runtime_state, current_state: checkpoint.runtime_state,
    selected_candidate_id: checkpoint.selected_candidate_id, last_verified_checkpoint: clone(checkpoint),
    max_actions_per_turn: 5, unresolved_evidence: []
  };
  const status = {
    schema: 'ev4-completion-status@1.0.0', completion_scope: 'desktop_builder_complete',
    reference_paradigm_lock_present: false, scope_excludes_responsive: true, responsive_complete: false,
    claim_scope: 'desktop', production_ready: false,
    evidence: { layout: true, frontend: false, responsive: false, accessibility: false, browser: false, export: true, final_qa: false },
    states: { scaffold_built: true, structure_built: true, content_filled: true, desktop_layout_established: true,
      desktop_reference_paradigm_matched: false, desktop_visual_parity_checked: false, tablet_checked: false,
      mobile_checked: false, accessibility_checked: false, browser_checked: false, export_checked: true,
      final_frontend_QA_checked: false }
  };
  const gate = {
    schema: 'ev4-completion-gate@0.2.0', gate_id: 'ENGINE-GATE-001', session_id: checkpoint.session_id,
    package_digest: verification.canonical_package_digest, source_file_sha256: verification.source_file_sha256,
    selected_candidate_id: verification.selected_candidate_id, checkpoint_id: checkpoint.checkpoint_id,
    checkpoint_sequence: checkpoint.checkpoint_sequence, action_ledger_id: ledger.ledger_id,
    action_ledger_digest: computeCanonicalDigest(ledger), completion_scope: status.completion_scope,
    evidence_ledger_digest: computeCanonicalDigest(evidenceLedger), source_package_ref: 'builder-input.json',
    layout_check_ref: 'EV-BATCH-001-A01', production_ready_allowed: false, production_ready_claim: false,
    proofs: {
      layout_verified: { status: 'confirmed', evidence_refs: ['EV-BATCH-001-A01'] },
      frontend_verified: { status: 'unverified', evidence_refs: [] }, responsive_verified: { status: 'unverified', evidence_refs: [] },
      accessibility_verified: { status: 'unverified', evidence_refs: [] }, browser_verified: { status: 'unverified', evidence_refs: [] },
      export_verified: { status: 'confirmed', evidence_refs: ['EV-BATCH-001-A01'] }, final_qa_verified: { status: 'unverified', evidence_refs: [] }
    }, required_next_action: 'keep_production_ready_false', reason: 'Bounded Builder completion only.'
  };
  const pausedCheckpoint = { ...clone(checkpoint), runtime_state: 'PAUSED' };
  const pausedSession = { ...clone(session), runtime_state: 'PAUSED', current_state: 'PAUSED', resume_target: { workflow_mode: 'APPROVED_HANDOFF_MODE', runtime_state: 'BUILD_ACTIVE' }, last_verified_checkpoint: clone(pausedCheckpoint) };
  return { temp, failures, fail, writeJson, readJson, expectCli, expectBlocked, expectPassed, source, capsuleFile, capsule, verification, evidenceLedger, ledger, checkpoint, session, status, gate, pausedCheckpoint, pausedSession };
}

export function finishHarness(h) {
  fs.rmSync(h.temp, { recursive: true, force: true });
  if (h.failures.length) throw new Error(h.failures.join('\n'));
}
