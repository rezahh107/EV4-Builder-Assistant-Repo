#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const INSPECTOR = path.join(ROOT, 'scripts', 'builder-inspector.mjs');
const SOURCE_FIXTURE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'builder_context_package.json');
const INITIAL_SESSION_FIXTURE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'session_state_initial.json');
const INITIAL_CHECKPOINT_FIXTURE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'checkpoint_initial.json');
const FINAL_SESSION_FIXTURE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'session_state_final.json');
const FINAL_CHECKPOINT_FIXTURE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'checkpoint_final.json');
const COMPLETION_STATUS_FIXTURE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'completion_status.json');
const COMPLETION_GATE_FIXTURE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'completion_gate.json');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-builder-transition-'));
const failures = [];

const fail = (message) => failures.push(message);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (name, value) => {
  const file = path.join(temp, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
};
const copy = (name, source) => {
  const target = path.join(temp, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return target;
};
const run = (args) => spawnSync(process.execPath, [INSPECTOR, ...args], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
  shell: false
});
const parseStdout = (result) => {
  try { return JSON.parse(result.stdout); } catch { return null; }
};

function expect(label, result, expectedExit, expectedStatus) {
  if (result.status !== expectedExit) {
    fail(`${label}: expected exit ${expectedExit}, received ${result.status}. ${result.stderr || result.stdout}`);
    return null;
  }
  const output = parseStdout(result);
  if (!output) fail(`${label}: stdout was not machine-readable JSON.`);
  else if (output.status !== expectedStatus) fail(`${label}: expected status ${expectedStatus}, received ${output.status}.`);
  return output;
}

function expectBlockedNoPublication(label, args, outputDirectory) {
  const result = expect(label, run(args), 1, 'blocked');
  if (fs.existsSync(outputDirectory)) fail(`${label}: failed transition published an output directory.`);
  const prefix = `${path.basename(outputDirectory)}.tmp-`;
  if (fs.readdirSync(path.dirname(outputDirectory)).some((name) => name.startsWith(prefix))) {
    fail(`${label}: failed transition left a temporary directory.`);
  }
  return result;
}

function prepareBuildActivePredecessor() {
  const checkpoint = readJson(FINAL_CHECKPOINT_FIXTURE);
  checkpoint.runtime_state = 'BUILD_ACTIVE';
  checkpoint.checkpoint_id = 'BUILDER-TRX-CP-001';
  checkpoint.checkpoint_sequence = 2;
  checkpoint.parent_checkpoint_id = 'BUILDER-TRX-CP-000';
  checkpoint.confirmed_action_ids = ['BATCH-001-A01'];
  checkpoint.unconfirmed_action_ids = [];
  checkpoint.unresolved_blockers = [];

  const session = readJson(FINAL_SESSION_FIXTURE);
  session.workflow_mode = 'APPROVED_HANDOFF_MODE';
  session.runtime_state = 'BUILD_ACTIVE';
  session.current_state = 'BUILD_ACTIVE';
  session.last_verified_checkpoint = checkpoint;
  session.unresolved_evidence = [];
  delete session.resume_target;
  return { session, checkpoint };
}

function boundGate(checkpoint, session) {
  const gate = readJson(COMPLETION_GATE_FIXTURE);
  gate.package_digest = session.package_digest;
  gate.session_id = session.session_id;
  gate.checkpoint_id = checkpoint.checkpoint_id;
  gate.checkpoint_sequence = checkpoint.checkpoint_sequence;
  return gate;
}

function completionArgs(source, capsule, sessionFile, checkpointFile, statusFile, gateFile, outputDirectory) {
  return ['completion', source, capsule, sessionFile, checkpointFile, statusFile, gateFile, outputDirectory];
}

try {
  const source = copy('builder-input.json', SOURCE_FIXTURE);
  const capsule = path.join(temp, 'builder-intake-result.json');
  expect('valid intake', run(['intake', source, capsule]), 0, 'accepted');
  expect('valid capsule verification', run(['verify-capsule', source, capsule]), 0, 'accepted');

  const { session, checkpoint } = prepareBuildActivePredecessor();
  const sessionFile = writeJson('completion/session-active.json', session);
  const checkpointFile = writeJson('completion/checkpoint-active.json', checkpoint);
  const gateFile = writeJson('completion/gate-bound.json', boundGate(checkpoint, session));
  const completionOutput = path.join(temp, 'completion-success');
  const completion = expect('BUILD_ACTIVE completion', run(completionArgs(source, capsule, sessionFile, checkpointFile, COMPLETION_STATUS_FIXTURE, gateFile, completionOutput)), 0, 'accepted');
  if (completion?.source?.runtime_state !== 'BUILD_ACTIVE' || completion?.target?.runtime_state !== 'COMPLETED') fail('Completion did not prove BUILD_ACTIVE → COMPLETED.');
  const completedSession = readJson(path.join(completionOutput, 'session-state.json'));
  const completedCheckpoint = readJson(path.join(completionOutput, 'checkpoint.json'));
  if (completedSession.runtime_state !== 'COMPLETED' || completedCheckpoint.runtime_state !== 'COMPLETED') fail('Completion did not generate terminal carriers.');
  if (completedCheckpoint.parent_checkpoint_id !== checkpoint.checkpoint_id || completedCheckpoint.checkpoint_sequence !== checkpoint.checkpoint_sequence + 1) fail('Generated Completion Checkpoint does not preserve parent/sequence continuity.');
  if (completion?.responsive_complete !== false || completion?.production_ready !== false) fail('Completion overclaimed Responsive or production authority.');
  if (fs.readdirSync(temp).some((name) => name.includes('.tmp-'))) fail('Successful publication left a temporary directory.');

  const pausedSession = readJson(INITIAL_SESSION_FIXTURE);
  const pausedCheckpoint = readJson(INITIAL_CHECKPOINT_FIXTURE);
  pausedSession.runtime_state = 'PAUSED';
  pausedSession.current_state = 'PAUSED';
  pausedSession.resume_target = { workflow_mode: pausedCheckpoint.workflow_mode, runtime_state: pausedCheckpoint.runtime_state };
  pausedSession.last_verified_checkpoint = pausedCheckpoint;
  const pausedFile = writeJson('resume/session-paused.json', pausedSession);
  const pausedCheckpointFile = writeJson('resume/checkpoint.json', pausedCheckpoint);
  const resumeOutput = path.join(temp, 'resume-success');
  const resume = expect('valid Resume', run(['resume', source, capsule, pausedFile, pausedCheckpointFile, resumeOutput]), 0, 'accepted');
  if (resume?.source?.runtime_state !== 'PAUSED' || resume?.target?.runtime_state !== pausedCheckpoint.runtime_state) fail('Resume did not restore the recorded target.');
  if (readJson(path.join(resumeOutput, 'session-state.json')).runtime_state !== pausedCheckpoint.runtime_state) fail('Resume did not generate the restored Session State.');

  const fabricatedCapsule = writeJson('mutations/fabricated-capsule.json', {
    schema: 'ev4-builder-intake-result@1.0.0',
    status: 'accepted',
    source_file_sha256: '0'.repeat(64),
    canonical_package_digest: session.package_digest,
    selected_candidate_id: session.selected_candidate_id,
    builder_context_schema: 'ev4-builder-context-package@1.0.0'
  });
  expectBlockedNoPublication('fabricated Capsule', completionArgs(source, fabricatedCapsule, sessionFile, checkpointFile, COMPLETION_STATUS_FIXTURE, gateFile, path.join(temp, 'blocked-fabricated')), path.join(temp, 'blocked-fabricated'));

  const editedCapsule = readJson(capsule);
  editedCapsule.selected_candidate_id = 'FOREIGN-CANDIDATE';
  const editedCapsuleFile = writeJson('mutations/edited-capsule.json', editedCapsule);
  expectBlockedNoPublication('edited Capsule', completionArgs(source, editedCapsuleFile, sessionFile, checkpointFile, COMPLETION_STATUS_FIXTURE, gateFile, path.join(temp, 'blocked-edited')), path.join(temp, 'blocked-edited'));

  const whitespaceSource = copy('mutations/whitespace-builder-input.json', SOURCE_FIXTURE);
  const whitespaceCapsule = path.join(temp, 'mutations/whitespace-capsule.json');
  fs.appendFileSync(whitespaceSource, ' ');
  expect('foreign byte-equivalent intake', run(['intake', whitespaceSource, whitespaceCapsule]), 0, 'accepted');
  expectBlockedNoPublication('foreign source-byte Capsule', completionArgs(source, whitespaceCapsule, sessionFile, checkpointFile, COMPLETION_STATUS_FIXTURE, gateFile, path.join(temp, 'blocked-foreign-capsule')), path.join(temp, 'blocked-foreign-capsule'));

  const staleSource = copy('mutations/stale-source.json', SOURCE_FIXTURE);
  const staleCapsule = path.join(temp, 'mutations/stale-capsule.json');
  expect('stale source initial intake', run(['intake', staleSource, staleCapsule]), 0, 'accepted');
  fs.appendFileSync(staleSource, '\n');
  expectBlockedNoPublication('stale Capsule after source mutation', completionArgs(staleSource, staleCapsule, sessionFile, checkpointFile, COMPLETION_STATUS_FIXTURE, gateFile, path.join(temp, 'blocked-stale')), path.join(temp, 'blocked-stale'));

  for (const [label, mutate] of [
    ['already COMPLETED Session State', (s) => { s.runtime_state = 'COMPLETED'; s.current_state = 'COMPLETED'; }],
    ['already COMPLETED Checkpoint', (s, c) => { c.runtime_state = 'COMPLETED'; s.last_verified_checkpoint = c; }],
    ['WAITING_FOR_CONFIRMATION source', (s, c) => { s.runtime_state = s.current_state = c.runtime_state = 'WAITING_FOR_CONFIRMATION'; }],
    ['PAUSED source', (s) => { s.runtime_state = s.current_state = 'PAUSED'; s.resume_target = { workflow_mode: 'APPROVED_HANDOFF_MODE', runtime_state: 'BUILD_ACTIVE' }; }],
    ['EVIDENCE_REQUIRED source', (s, c) => { s.runtime_state = s.current_state = c.runtime_state = 'EVIDENCE_REQUIRED'; }],
    ['REVIEW_ONLY source', (s, c) => { s.runtime_state = s.current_state = c.runtime_state = 'REVIEW_ONLY'; }],
    ['intake source', (s, c) => { s.workflow_mode = c.workflow_mode = 'START_INTAKE_MODE'; s.runtime_state = s.current_state = c.runtime_state = 'INTAKE_WAITING'; }],
    ['fresh-image source', (s, c) => { s.workflow_mode = c.workflow_mode = 'FRESH_IMAGE_MODE_LIMITED'; }]
  ]) {
    const current = prepareBuildActivePredecessor();
    mutate(current.session, current.checkpoint);
    current.session.last_verified_checkpoint = current.checkpoint;
    const slug = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    expectBlockedNoPublication(label, completionArgs(
      source,
      capsule,
      writeJson(`mutations/${slug}-session.json`, current.session),
      writeJson(`mutations/${slug}-checkpoint.json`, current.checkpoint),
      COMPLETION_STATUS_FIXTURE,
      writeJson(`mutations/${slug}-gate.json`, boundGate(current.checkpoint, current.session)),
      path.join(temp, `blocked-${slug}`)
    ), path.join(temp, `blocked-${slug}`));
  }

  const correction = prepareBuildActivePredecessor();
  correction.session.runtime_state = correction.session.current_state = correction.checkpoint.runtime_state = 'CORRECTION';
  correction.session.last_verified_checkpoint = correction.checkpoint;
  expectBlockedNoPublication('CORRECTION source', completionArgs(source, capsule, writeJson('mutations/correction-session.json', correction.session), writeJson('mutations/correction-checkpoint.json', correction.checkpoint), COMPLETION_STATUS_FIXTURE, writeJson('mutations/correction-gate.json', boundGate(correction.checkpoint, correction.session)), path.join(temp, 'blocked-correction')), path.join(temp, 'blocked-correction'));

  const badSequence = prepareBuildActivePredecessor();
  badSequence.checkpoint.parent_checkpoint_id = null;
  badSequence.session.last_verified_checkpoint = badSequence.checkpoint;
  expectBlockedNoPublication('invalid Checkpoint parent/sequence', completionArgs(source, capsule, writeJson('mutations/bad-sequence-session.json', badSequence.session), writeJson('mutations/bad-sequence-checkpoint.json', badSequence.checkpoint), COMPLETION_STATUS_FIXTURE, writeJson('mutations/bad-sequence-gate.json', boundGate(badSequence.checkpoint, badSequence.session)), path.join(temp, 'blocked-sequence')), path.join(temp, 'blocked-sequence'));

  for (const [label, mutate] of [
    ['required Action deleted', (c) => { c.confirmed_action_ids = []; c.unconfirmed_action_ids = []; }],
    ['required Action Batch omitted', (c) => { c.batch_id = 'BATCH-FOREIGN'; }],
    ['foreign Action ID', (c) => { c.confirmed_action_ids = ['BATCH-FOREIGN-A01']; }],
    ['conflicting Action disposition', (c) => { c.unconfirmed_action_ids = ['BATCH-001-A01']; }],
    ['duplicate Action disposition', (c) => { c.confirmed_action_ids = ['BATCH-001-A01', 'BATCH-001-A01']; }]
  ]) {
    const current = prepareBuildActivePredecessor();
    mutate(current.checkpoint);
    current.session.last_verified_checkpoint = current.checkpoint;
    const slug = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    expectBlockedNoPublication(label, completionArgs(source, capsule, writeJson(`mutations/${slug}-session.json`, current.session), writeJson(`mutations/${slug}-checkpoint.json`, current.checkpoint), COMPLETION_STATUS_FIXTURE, writeJson(`mutations/${slug}-gate.json`, boundGate(current.checkpoint, current.session)), path.join(temp, `blocked-${slug}`)), path.join(temp, `blocked-${slug}`));
  }

  for (const [label, field, value] of [
    ['Gate wrong candidate', 'selected_candidate_id', 'FOREIGN-CANDIDATE'],
    ['Gate wrong package', 'package_digest', '0'.repeat(64)],
    ['Gate wrong Session', 'session_id', 'SESSION-FOREIGN'],
    ['Gate stale Checkpoint', 'checkpoint_id', 'CHECKPOINT-FOREIGN'],
    ['Gate stale sequence', 'checkpoint_sequence', 999]
  ]) {
    const gate = boundGate(checkpoint, session);
    gate[field] = value;
    const slug = label.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    expectBlockedNoPublication(label, completionArgs(source, capsule, sessionFile, checkpointFile, COMPLETION_STATUS_FIXTURE, writeJson(`mutations/${slug}.json`, gate), path.join(temp, `blocked-${slug}`)), path.join(temp, `blocked-${slug}`));
  }

  const incompleteStatus = readJson(COMPLETION_STATUS_FIXTURE);
  incompleteStatus.states.structure_built = false;
  expectBlockedNoPublication('Schema-valid semantically incomplete Completion Status', completionArgs(source, capsule, sessionFile, checkpointFile, writeJson('mutations/incomplete-status.json', incompleteStatus), gateFile, path.join(temp, 'blocked-status')), path.join(temp, 'blocked-status'));

  const wrongPackageSession = structuredClone(pausedSession);
  wrongPackageSession.package_digest = '0'.repeat(64);
  expectBlockedNoPublication('Resume package mismatch', ['resume', source, capsule, writeJson('mutations/resume-wrong-package.json', wrongPackageSession), pausedCheckpointFile, path.join(temp, 'blocked-resume-package')], path.join(temp, 'blocked-resume-package'));

  const droppedBlockerSession = structuredClone(pausedSession);
  droppedBlockerSession.unresolved_evidence = [];
  expectBlockedNoPublication('Resume disappeared blocker', ['resume', source, capsule, writeJson('mutations/resume-dropped-blocker.json', droppedBlockerSession), pausedCheckpointFile, path.join(temp, 'blocked-resume-blocker')], path.join(temp, 'blocked-resume-blocker'));

  const nonPaused = structuredClone(pausedSession);
  nonPaused.runtime_state = nonPaused.current_state = 'BUILD_ACTIVE';
  delete nonPaused.resume_target;
  expectBlockedNoPublication('Resume non-PAUSED source', ['resume', source, capsule, writeJson('mutations/resume-non-paused.json', nonPaused), pausedCheckpointFile, path.join(temp, 'blocked-resume-non-paused')], path.join(temp, 'blocked-resume-non-paused'));

  const noTarget = structuredClone(pausedSession);
  delete noTarget.resume_target;
  expectBlockedNoPublication('Resume missing target', ['resume', source, capsule, writeJson('mutations/resume-no-target.json', noTarget), pausedCheckpointFile, path.join(temp, 'blocked-resume-no-target')], path.join(temp, 'blocked-resume-no-target'));

  const resumeCompleted = structuredClone(pausedSession);
  resumeCompleted.resume_target = { workflow_mode: 'APPROVED_HANDOFF_MODE', runtime_state: 'COMPLETED' };
  expectBlockedNoPublication('Resume to COMPLETED', ['resume', source, capsule, writeJson('mutations/resume-completed.json', resumeCompleted), pausedCheckpointFile, path.join(temp, 'blocked-resume-completed')], path.join(temp, 'blocked-resume-completed'));

  const oldResumeInvocation = run(['resume', capsule, pausedFile, pausedCheckpointFile, path.join(temp, 'blocked-resume-no-input')]);
  if (oldResumeInvocation.status === 0) fail('Resume without actual Builder Input unexpectedly succeeded.');

  const replayOutput = path.join(temp, 'completion-replay');
  expectBlockedNoPublication('terminal carrier cannot replay Completion', completionArgs(source, capsule, path.join(completionOutput, 'session-state.json'), path.join(completionOutput, 'checkpoint.json'), COMPLETION_STATUS_FIXTURE, gateFile, replayOutput), replayOutput);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error('Builder Inspector bounded transition tests failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Builder Inspector bounded Resume/Completion transition and mutation tests passed.');
