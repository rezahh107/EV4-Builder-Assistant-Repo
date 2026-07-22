import fs from 'node:fs';
import path from 'node:path';
import { clone } from './test-runtime-engine-support.mjs';
import { RuntimeTransactionError, publishAtomicDirectory } from './lib/runtime-transaction-engine.mjs';

export function testCliAndAtomicity(h) {
  const { writeJson, readJson, expectCli, expectBlocked, source, capsuleFile, temp } = h;
  const sessionFile = writeJson('session.json', h.session);
  const checkpointFile = writeJson('checkpoint.json', h.checkpoint);
  const ledgerFile = writeJson('action-ledger.json', h.ledger);
  const statusFile = writeJson('completion-status.json', h.status);
  const gateFile = writeJson('completion-gate.json', h.gate);
  const output = path.join(temp, 'completion-output');
  const result = expectCli('valid Engine Completion', ['completion', source, capsuleFile, sessionFile, checkpointFile, ledgerFile, statusFile, gateFile, output], 0, 'accepted');
  if (result?.builder_build_complete !== true || result?.responsive_complete !== false || result?.production_ready !== false) h.fail('Builder-only Completion boundary failed.');
  const completedSession = readJson(path.join(output, 'session-state.json'));
  const completedCheckpoint = readJson(path.join(output, 'checkpoint.json'));
  if (completedSession.runtime_state !== 'COMPLETED' || completedCheckpoint.parent_checkpoint_id !== h.checkpoint.checkpoint_id || completedCheckpoint.checkpoint_sequence !== 2) h.fail('Engine did not derive terminal carriers from predecessor.');
  expectCli('deterministic idempotent Completion', ['completion', source, capsuleFile, sessionFile, checkpointFile, ledgerFile, statusFile, gateFile, output], 0, 'accepted');
  expectCli('terminal Completion replay rejected', ['completion', source, capsuleFile, writeJson('terminal-session.json', completedSession), writeJson('terminal-checkpoint.json', completedCheckpoint), ledgerFile, statusFile, gateFile, path.join(temp, 'replay')], 1, 'blocked');

  const preauthSession = { ...clone(h.session), runtime_state: 'COMPLETED', current_state: 'COMPLETED' };
  const preauthCheckpoint = { ...clone(h.checkpoint), runtime_state: 'COMPLETED' };
  const preauthOutput = path.join(temp, 'preauth');
  expectCli('pre-authored COMPLETED rejected', ['completion', source, capsuleFile, writeJson('preauth-session.json', preauthSession), writeJson('preauth-checkpoint.json', preauthCheckpoint), ledgerFile, statusFile, gateFile, preauthOutput], 1, 'blocked');
  if (fs.existsSync(preauthOutput)) h.fail('pre-authored COMPLETED published outputs.');

  const parentBad = { ...clone(h.checkpoint), checkpoint_sequence: 2, parent_checkpoint_id: null };
  const parentSession = { ...clone(h.session), last_verified_checkpoint: clone(parentBad) };
  expectCli('Checkpoint parent mismatch', ['completion', source, capsuleFile, writeJson('parent-session.json', parentSession), writeJson('parent-cp.json', parentBad), ledgerFile, statusFile, gateFile, path.join(temp, 'parent-out')], 1, 'blocked');
  const sequenceBad = { ...clone(h.checkpoint), checkpoint_sequence: 2, parent_checkpoint_id: 'FOREIGN-CP' };
  const sequenceSession = { ...clone(h.session), last_verified_checkpoint: clone(sequenceBad) };
  expectCli('Checkpoint sequence mismatch', ['completion', source, capsuleFile, writeJson('sequence-session.json', sequenceSession), writeJson('sequence-cp.json', sequenceBad), ledgerFile, statusFile, gateFile, path.join(temp, 'sequence-out')], 1, 'blocked');

  const pausedSessionFile = writeJson('paused-session.json', h.pausedSession);
  const pausedCheckpointFile = writeJson('paused-checkpoint.json', h.pausedCheckpoint);
  expectCli('valid Resume with actual Builder Input', ['resume', source, capsuleFile, pausedSessionFile, pausedCheckpointFile, path.join(temp, 'resume-output')], 0, 'accepted');
  const resumeMutations = [
    ['wrong package', (s) => { s.package_digest = '0'.repeat(64); }],
    ['wrong candidate', (s) => { s.selected_candidate_id = 'FOREIGN'; }],
    ['wrong Session ID', (s) => { s.session_id = 'FOREIGN'; }],
    ['missing previous state', (s) => { delete s.resume_target; }],
    ['Resume to COMPLETED', (s) => { s.resume_target = { workflow_mode: 'APPROVED_HANDOFF_MODE', runtime_state: 'COMPLETED' }; }],
    ['disappeared blocker', (s) => { s.unresolved_evidence = []; s.last_verified_checkpoint.unresolved_blockers = ['BLOCKER-1']; }]
  ];
  for (const [label, mutate] of resumeMutations) {
    const s = clone(h.pausedSession); mutate(s);
    expectCli(`Resume ${label}`, ['resume', source, capsuleFile, writeJson(`resume-${label.replace(/\W+/g, '-')}.json`, s), pausedCheckpointFile, path.join(temp, `resume-${label.replace(/\W+/g, '-')}-out`)], 1, 'blocked');
  }
  const foreignCheckpoint = { ...clone(h.pausedCheckpoint), checkpoint_id: 'FOREIGN-CP' };
  expectCli('Resume foreign Checkpoint', ['resume', source, capsuleFile, pausedSessionFile, writeJson('foreign-cp.json', foreignCheckpoint), path.join(temp, 'foreign-cp-out')], 1, 'blocked');

  const values = { 'one.json': { a: 1 }, 'two.json': { b: 2 } };
  const atomicRoot = path.join(temp, 'atomic-success');
  const first = publishAtomicDirectory(atomicRoot, values, () => {});
  if (!first.atomic || first.idempotent) h.fail('new publication was not atomic.');
  if (!publishAtomicDirectory(atomicRoot, values, () => {}).idempotent) h.fail('repeat publication was not idempotent.');
  const validationTarget = path.join(temp, 'validation-failure');
  expectBlocked('validation failure publishes nothing', () => publishAtomicDirectory(validationTarget, values, () => { throw new RuntimeTransactionError('TEST', 'blocked'); }));
  if (fs.existsSync(validationTarget)) h.fail('validation failure published output.');
  const writeTarget = path.join(temp, 'write-failure');
  expectBlocked('simulated write failure publishes nothing', () => publishAtomicDirectory(writeTarget, values, () => {}, { failAfterWrites: 1 }));
  if (fs.existsSync(writeTarget)) h.fail('write failure published output.');
  if (fs.readdirSync(temp).some((name) => name.includes('.tmp-'))) h.fail('temporary publication file remains.');
  expectBlocked('different transaction cannot overwrite output', () => publishAtomicDirectory(atomicRoot, { 'one.json': { a: 9 } }, () => {}));
}
