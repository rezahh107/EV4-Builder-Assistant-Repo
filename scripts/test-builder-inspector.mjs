#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const INSPECTOR = path.join(ROOT, 'scripts', 'builder-inspector.mjs');
const VALID_SOURCE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'builder_context_package.json');
const VALID_INITIAL_SESSION = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'session_state_initial.json');
const VALID_INITIAL_CHECKPOINT = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'checkpoint_initial.json');
const VALID_FINAL_SESSION = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'session_state_final.json');
const VALID_FINAL_CHECKPOINT = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'checkpoint_final.json');
const VALID_COMPLETION_STATUS = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'completion_status.json');
const VALID_COMPLETION_GATE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'completion_gate.json');
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-builder-inspector-'));
const failures = [];

function fail(message) {
  failures.push(message);
}

function writeJson(name, value) {
  const file = path.join(temp, name);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function copy(name, source) {
  const target = path.join(temp, name);
  fs.copyFileSync(source, target);
  return target;
}

function run(args) {
  return spawnSync(process.execPath, [INSPECTOR, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: false
  });
}

function expectStatus(label, result, expectedExit, outputFile, expectedStatus) {
  if (result.status !== expectedExit) {
    fail(`${label}: expected exit ${expectedExit}, received ${result.status}. ${result.stderr || result.stdout}`);
    return null;
  }
  const output = outputFile ? readJson(outputFile) : JSON.parse(result.stdout);
  if (output.status !== expectedStatus) fail(`${label}: expected status ${expectedStatus}, received ${output.status}.`);
  return output;
}

function validateIntakeSchema(file, label) {
  const result = spawnSync(NPX, [
    '--yes', 'ajv-cli@5', 'validate', '--spec=draft2020', '--strict=false',
    '-s', 'schemas/builder-intake-result.v1.schema.json', '-d', file
  ], { cwd: ROOT, encoding: 'utf8', shell: false });
  if (result.status !== 0) fail(`${label}: intake result schema validation failed. ${result.stderr || result.stdout}`);
}

try {
  const source = copy('builder-input.json', VALID_SOURCE);
  const sourceBefore = fs.readFileSync(source);
  const capsule = path.join(temp, 'intake-result.json');
  const validIntake = expectStatus('valid intake', run(['intake', source, capsule]), 0, capsule, 'accepted');
  validateIntakeSchema(capsule, 'valid intake');
  if (!Buffer.from(sourceBefore).equals(fs.readFileSync(source))) fail('valid intake modified source bytes.');
  if (fs.readdirSync(temp).some((name) => name.includes('.tmp-'))) fail('atomic publication left a temporary output behind.');
  if (validIntake?.source_file_unchanged !== true || validIntake?.publication?.atomic !== true) fail('valid intake did not report immutable source and atomic publication.');

  expectStatus('valid capsule', run(['verify-capsule', source, capsule]), 0, null, 'accepted');

  const malformed = path.join(temp, 'malformed.json');
  fs.writeFileSync(malformed, '{bad json\n');
  const malformedResult = path.join(temp, 'malformed-result.json');
  expectStatus('malformed JSON', run(['intake', malformed, malformedResult]), 1, malformedResult, 'blocked');
  validateIntakeSchema(malformedResult, 'malformed JSON');

  const original = readJson(VALID_SOURCE);
  const wrongSchema = writeJson('wrong-schema.json', { schema: 'ev4-project-gate-result@1.0.0', result: original });
  expectStatus('raw Project Gate envelope', run(['intake', wrongSchema, path.join(temp, 'wrong-schema-result.json')]), 1, path.join(temp, 'wrong-schema-result.json'), 'blocked');

  const receiptOnly = writeJson('receipt-only.json', { schema: 'ev4-project-gate-c2b-receipt@1.0.0', package_digest: original.input_authorization.package_digest.value });
  expectStatus('receipt-only intake', run(['intake', receiptOnly, path.join(temp, 'receipt-result.json')]), 1, path.join(temp, 'receipt-result.json'), 'blocked');

  const candidateMismatch = structuredClone(original);
  candidateMismatch.selected_candidate_id = 'MISMATCHED-CANDIDATE';
  expectStatus('candidate mismatch', run(['intake', writeJson('candidate-mismatch.json', candidateMismatch), path.join(temp, 'candidate-result.json')]), 1, path.join(temp, 'candidate-result.json'), 'blocked');

  const lineageMismatch = structuredClone(original);
  lineageMismatch.decision_lineage = [];
  expectStatus('lineage mismatch', run(['intake', writeJson('lineage-mismatch.json', lineageMismatch), path.join(temp, 'lineage-result.json')]), 1, path.join(temp, 'lineage-result.json'), 'blocked');

  const mutatedSource = copy('mutated-source.json', VALID_SOURCE);
  const mutatedCapsule = path.join(temp, 'mutated-capsule.json');
  expectStatus('mutated source initial intake', run(['intake', mutatedSource, mutatedCapsule]), 0, mutatedCapsule, 'accepted');
  fs.appendFileSync(mutatedSource, ' ');
  expectStatus('stale capsule after source-byte mutation', run(['verify-capsule', mutatedSource, mutatedCapsule]), 1, null, 'blocked');

  const checkpointInitial = readJson(VALID_INITIAL_CHECKPOINT);
  const pausedSession = readJson(VALID_INITIAL_SESSION);
  pausedSession.runtime_state = 'PAUSED';
  pausedSession.current_state = 'PAUSED';
  pausedSession.resume_target = {
    workflow_mode: 'APPROVED_HANDOFF_MODE',
    runtime_state: 'WAITING_FOR_CONFIRMATION'
  };
  const pausedFile = writeJson('paused-session.json', pausedSession);
  const checkpointInitialFile = writeJson('checkpoint-initial.json', checkpointInitial);
  expectStatus('valid resume', run(['resume', capsule, pausedFile, checkpointInitialFile, path.join(temp, 'resume-result.json')]), 0, path.join(temp, 'resume-result.json'), 'accepted');

  const noPriorState = structuredClone(pausedSession);
  delete noPriorState.session_id;
  delete noPriorState.resume_target;
  expectStatus('resume without prior state', run(['resume', capsule, writeJson('no-prior-state.json', noPriorState), checkpointInitialFile, path.join(temp, 'no-prior-result.json')]), 1, path.join(temp, 'no-prior-result.json'), 'blocked');

  const wrongPackage = structuredClone(pausedSession);
  wrongPackage.package_digest = '0'.repeat(64);
  expectStatus('resume package mismatch', run(['resume', capsule, writeJson('wrong-package-session.json', wrongPackage), checkpointInitialFile, path.join(temp, 'wrong-package-result.json')]), 1, path.join(temp, 'wrong-package-result.json'), 'blocked');

  const droppedBlocker = structuredClone(pausedSession);
  droppedBlocker.unresolved_evidence = [];
  expectStatus('resume dropped blocker', run(['resume', capsule, writeJson('dropped-blocker-session.json', droppedBlocker), checkpointInitialFile, path.join(temp, 'dropped-blocker-result.json')]), 1, path.join(temp, 'dropped-blocker-result.json'), 'blocked');

  const finalSession = copy('session-final.json', VALID_FINAL_SESSION);
  const finalCheckpoint = copy('checkpoint-final.json', VALID_FINAL_CHECKPOINT);
  const completionOutput = path.join(temp, 'completion-result.json');
  const completion = expectStatus(
    'valid completion',
    run(['completion', capsule, finalSession, finalCheckpoint, VALID_COMPLETION_STATUS, VALID_COMPLETION_GATE, completionOutput]),
    0,
    completionOutput,
    'accepted'
  );
  if (completion?.builder_build_complete !== true || completion?.responsive_complete !== false || completion?.production_ready !== false) {
    fail('valid completion did not preserve Builder-only scope.');
  }

  const incompleteCheckpoint = readJson(VALID_FINAL_CHECKPOINT);
  incompleteCheckpoint.confirmed_action_ids = [];
  incompleteCheckpoint.unconfirmed_action_ids = ['BATCH-001-A01'];
  const incompleteSession = readJson(VALID_FINAL_SESSION);
  incompleteSession.last_verified_checkpoint = incompleteCheckpoint;
  expectStatus(
    'incomplete actions block completion',
    run(['completion', capsule, writeJson('incomplete-session.json', incompleteSession), writeJson('incomplete-checkpoint.json', incompleteCheckpoint), VALID_COMPLETION_STATUS, VALID_COMPLETION_GATE, path.join(temp, 'incomplete-completion.json')]),
    1,
    path.join(temp, 'incomplete-completion.json'),
    'blocked'
  );

  const unresolvedCheckpoint = readJson(VALID_FINAL_CHECKPOINT);
  unresolvedCheckpoint.unresolved_blockers = ['BLOCKER-001'];
  const unresolvedSession = readJson(VALID_FINAL_SESSION);
  unresolvedSession.last_verified_checkpoint = unresolvedCheckpoint;
  unresolvedSession.unresolved_evidence = ['BLOCKER-001'];
  expectStatus(
    'unresolved blocker blocks completion',
    run(['completion', capsule, writeJson('unresolved-session.json', unresolvedSession), writeJson('unresolved-checkpoint.json', unresolvedCheckpoint), VALID_COMPLETION_STATUS, VALID_COMPLETION_GATE, path.join(temp, 'unresolved-completion.json')]),
    1,
    path.join(temp, 'unresolved-completion.json'),
    'blocked'
  );

  const nonCompletedSession = readJson(VALID_FINAL_SESSION);
  nonCompletedSession.runtime_state = 'BUILD_ACTIVE';
  nonCompletedSession.current_state = 'BUILD_ACTIVE';
  nonCompletedSession.last_verified_checkpoint.runtime_state = 'BUILD_ACTIVE';
  const nonCompletedCheckpoint = structuredClone(nonCompletedSession.last_verified_checkpoint);
  expectStatus(
    'non-COMPLETED state blocks completion',
    run(['completion', capsule, writeJson('non-completed-session.json', nonCompletedSession), writeJson('non-completed-checkpoint.json', nonCompletedCheckpoint), VALID_COMPLETION_STATUS, VALID_COMPLETION_GATE, path.join(temp, 'non-completed-result.json')]),
    1,
    path.join(temp, 'non-completed-result.json'),
    'blocked'
  );

  const detachedText = writeJson('detached-success-text.json', { success: true, message: 'Builder completed' });
  expectStatus('detached success text cannot complete', run(['completion', capsule, detachedText, finalCheckpoint, VALID_COMPLETION_STATUS, VALID_COMPLETION_GATE, path.join(temp, 'detached-result.json')]), 1, path.join(temp, 'detached-result.json'), 'blocked');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error('Builder Inspector tests failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Builder Inspector intake, capsule, resume, and completion tests passed.');
