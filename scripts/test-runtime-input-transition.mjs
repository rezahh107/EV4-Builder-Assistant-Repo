import fs from 'node:fs';
import { clone, SOURCE_FIXTURE } from './test-runtime-engine-support.mjs';
import { createGuardRegistry, evaluateTransition, loadTransitionAuthority, verifyBuilderInput, verifyCapsuleAgainstInput } from './lib/runtime-transaction-engine.mjs';

export function testInputAndTransitions(h) {
  const { capsule, verification, expectBlocked, expectPassed, expectCli, source, capsuleFile, writeJson } = h;
  expectPassed('valid Capsule binding', verifyCapsuleAgainstInput(capsule, verification));
  for (const [label, field, value] of [
    ['fabricated Capsule', 'source_file_sha256', '0'.repeat(64)], ['edited Capsule', 'canonical_package_digest', '1'.repeat(64)],
    ['substituted candidate', 'selected_candidate_id', 'FOREIGN'], ['substituted Builder Context Schema', 'builder_context_schema', 'ev4-builder-context-package@9.9.9']
  ]) { const x = clone(capsule); x[field] = value; expectBlocked(label, () => verifyCapsuleAgainstInput(x, verification)); }
  expectBlocked('Capsule from another Builder Input', () => verifyCapsuleAgainstInput(capsule, { ...verification, source_file_sha256: '2'.repeat(64), canonical_package_digest: '3'.repeat(64) }));
  const invalidInput = writeJson('invalid-input.json', { schema: 'ev4-builder-context-package@9.9.9' });
  expectBlocked('accepted Capsule with invalid Builder Input', () => verifyCapsuleAgainstInput(capsule, verifyBuilderInput(invalidInput)));
  fs.appendFileSync(source, ' ');
  expectCli('stale Capsule after byte mutation', ['verify-capsule', source, capsuleFile], 1, 'blocked');
  fs.copyFileSync(SOURCE_FIXTURE, source);

  const authority = loadTransitionAuthority();
  const completeGuards = Object.fromEntries(authority.transitions.find((x) => x.id === 'complete-builder').guards.map((x) => [x, true]));
  expectBlocked('unknown transition', () => evaluateTransition(authority, 'UNKNOWN', { session: h.session, guardFacts: completeGuards }));
  const missingRegistry = createGuardRegistry(); delete missingRegistry.builder_input_verified;
  expectBlocked('missing guard evaluator', () => loadTransitionAuthority({ guardRegistry: missingRegistry }));
  const failedGuard = { ...completeGuards, required_actions_complete: false };
  expectBlocked('failed guard', () => evaluateTransition(authority, 'complete-builder', { session: h.session, guardFacts: failedGuard }));
  const illegalAuthority = clone(authority);
  illegalAuthority.transitions = clone(authority.transitions);
  illegalAuthority.transitions.find((x) => x.id === 'complete-builder').to = { workflow_mode: 'START_INTAKE_MODE', runtime_state: 'COMPLETED' };
  expectBlocked('illegal target mode/state', () => evaluateTransition(illegalAuthority, 'complete-builder', { session: h.session, guardFacts: completeGuards }));

  for (const [mode, state] of [
    ['START_INTAKE_MODE', 'INTAKE_WAITING'], ['START_INTAKE_MODE', 'INTAKE_VALIDATING'],
    ['FRESH_IMAGE_MODE_LIMITED', 'BUILD_ACTIVE'], ['APPROVED_HANDOFF_MODE', 'EVIDENCE_REQUIRED'],
    ['APPROVED_HANDOFF_MODE', 'CORRECTION'], ['APPROVED_HANDOFF_MODE', 'REVIEW_ONLY'],
    ['APPROVED_HANDOFF_MODE', 'PAUSED'], ['APPROVED_HANDOFF_MODE', 'WAITING_FOR_CONFIRMATION'],
    ['APPROVED_HANDOFF_MODE', 'COMPLETED']
  ]) expectBlocked(`Completion source ${mode}/${state}`, () => evaluateTransition(authority, 'complete-builder', { session: { ...h.session, workflow_mode: mode, runtime_state: state }, guardFacts: completeGuards }));

  const resumeGuards = Object.fromEntries(authority.transitions.find((x) => x.id === 'resume').guards.map((x) => [x, true]));
  expectBlocked('Resume non-PAUSED source', () => evaluateTransition(authority, 'resume', { session: h.session, guardFacts: resumeGuards }));
  expectBlocked('Resume missing target', () => evaluateTransition(authority, 'resume', { session: { ...h.pausedSession, resume_target: undefined }, guardFacts: resumeGuards }));
  expectBlocked('Resume illegal target', () => evaluateTransition(authority, 'resume', { session: { ...h.pausedSession, resume_target: { workflow_mode: 'START_INTAKE_MODE', runtime_state: 'BUILD_ACTIVE' } }, guardFacts: resumeGuards }));
  expectBlocked('Resume to COMPLETED', () => evaluateTransition(authority, 'resume', { session: { ...h.pausedSession, resume_target: { workflow_mode: 'APPROVED_HANDOFF_MODE', runtime_state: 'COMPLETED' } }, guardFacts: resumeGuards }));
  for (const guard of ['prior_initialized_state_exists', 'session_id_matches', 'package_digest_matches', 'source_file_sha256_matches', 'candidate_matches', 'checkpoint_valid', 'unresolved_blockers_preserved']) {
    expectBlocked(`Resume failed ${guard}`, () => evaluateTransition(authority, 'resume', { session: h.pausedSession, guardFacts: { ...resumeGuards, [guard]: false } }));
  }
}
