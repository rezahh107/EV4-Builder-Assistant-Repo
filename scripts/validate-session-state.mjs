#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/validate-session-state.mjs <session_state.json>');
  process.exit(2);
}

const session = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
const transitions = JSON.parse(fs.readFileSync(path.resolve('runtime/state-transitions.v1.json'), 'utf8'));
const errors = [];

function fail(code, message) {
  errors.push({ code, message });
}

function normalizeAbsent(value) {
  return value ?? null;
}

function displayCandidate(value) {
  return value ?? '<absent>';
}

function failIfCandidateMismatch(code, leftLabel, leftValue, rightLabel, rightValue) {
  if (normalizeAbsent(leftValue) !== normalizeAbsent(rightValue)) {
    fail(code, `${leftLabel} ${displayCandidate(leftValue)} must equal ${rightLabel} ${displayCandidate(rightValue)}.`);
  }
}

if (transitions.schema !== 'ev4-builder-state-transitions@1.0.0') {
  fail('EV4-SESSION-000', 'Canonical transition table is missing or unsupported.');
}

const CANONICAL_RUNTIME_STATES = new Set(transitions.runtime_states || []);
const ALLOWED_BY_MODE = Object.fromEntries(
  Object.entries(transitions.allowed_combinations || {}).map(([mode, states]) => [mode, new Set(states)])
);
const ACTIVE_RUNTIME_STATES = new Set(['BUILD_ACTIVE', 'WAITING_FOR_CONFIRMATION', 'EVIDENCE_REQUIRED', 'CORRECTION', 'COMPLETED']);

if (session.current_state && !CANONICAL_RUNTIME_STATES.has(session.current_state)) {
  fail('EV4-SESSION-001', `current_state ${session.current_state} is not a canonical runtime_state.`);
}

if (session.runtime_state && session.current_state && session.runtime_state !== session.current_state) {
  fail('EV4-SESSION-002', `current_state ${session.current_state} must equal runtime_state ${session.runtime_state}.`);
}

if (session.workflow_mode && session.runtime_state) {
  const allowed = ALLOWED_BY_MODE[session.workflow_mode];
  if (!allowed || !allowed.has(session.runtime_state)) {
    fail('EV4-SESSION-010', `${session.workflow_mode} cannot use runtime_state ${session.runtime_state}.`);
  }
}

if (session.runtime_state === 'CORRECTION' && !session.repair_packet) {
  fail('EV4-SESSION-003', 'runtime_state CORRECTION requires repair_packet.');
}

const selectedCandidate = session.selected_candidate_id;
const checkpoint = session.last_verified_checkpoint;
const repairPacket = session.repair_packet;

if (checkpoint) {
  failIfCandidateMismatch('EV4-SESSION-004', 'last_verified_checkpoint.selected_candidate_id', checkpoint.selected_candidate_id, 'session.selected_candidate_id', selectedCandidate);
}

if (repairPacket) {
  failIfCandidateMismatch('EV4-SESSION-005', 'repair_packet.selected_candidate_id', repairPacket.selected_candidate_id, 'session.selected_candidate_id', selectedCandidate);
}

if (repairPacket?.last_safe_checkpoint) {
  failIfCandidateMismatch('EV4-SESSION-006', 'repair_packet.last_safe_checkpoint.selected_candidate_id', repairPacket.last_safe_checkpoint.selected_candidate_id, 'session.selected_candidate_id', selectedCandidate);
}

if (checkpoint?.schema === 'ev4-builder-checkpoint@0.1.0' && ACTIVE_RUNTIME_STATES.has(session.runtime_state)) {
  fail('EV4-SESSION-007', `Legacy checkpoint schema ${checkpoint.schema} cannot be used as last_verified_checkpoint in active runtime_state ${session.runtime_state}.`);
}

if (repairPacket && session.runtime_state !== 'CORRECTION') {
  fail('EV4-SESSION-008', `repair_packet may only be active when runtime_state is CORRECTION; received ${session.runtime_state}.`);
}

if (repairPacket && repairPacket.runtime_state !== 'CORRECTION') {
  fail('EV4-SESSION-009', `repair_packet.runtime_state must be CORRECTION; received ${repairPacket.runtime_state}.`);
}

if (session.runtime_state === 'PAUSED') {
  if (!session.session_id || !session.package_digest || !session.resume_target) {
    fail('EV4-SESSION-011', 'PAUSED requires session_id, package_digest, and resume_target.');
  } else {
    const targetStates = ALLOWED_BY_MODE[session.resume_target.workflow_mode];
    if (!targetStates?.has(session.resume_target.runtime_state) || session.resume_target.runtime_state === 'COMPLETED') {
      fail('EV4-SESSION-012', 'resume_target must be a legal non-COMPLETED state from the canonical transition table.');
    }
  }
}

if (session.runtime_state === 'COMPLETED') {
  if (session.workflow_mode !== 'APPROVED_HANDOFF_MODE') fail('EV4-SESSION-013', 'COMPLETED is allowed only in APPROVED_HANDOFF_MODE.');
  if (!session.session_id || !session.package_digest) fail('EV4-SESSION-014', 'COMPLETED requires session_id and package_digest.');
  if ((session.unresolved_evidence || []).length > 0) fail('EV4-SESSION-015', 'COMPLETED cannot preserve unresolved blocking evidence.');
}

if (checkpoint?.schema === 'ev4-builder-checkpoint@0.2.0') {
  if (session.session_id && checkpoint.session_id && session.session_id !== checkpoint.session_id) fail('EV4-SESSION-016', 'session_id must match last_verified_checkpoint.session_id.');
  if (session.package_digest && checkpoint.package_digest && session.package_digest !== checkpoint.package_digest) fail('EV4-SESSION-017', 'package_digest must match last_verified_checkpoint.package_digest.');
  const checkpointBlockers = checkpoint.unresolved_blockers || [];
  const sessionBlockers = session.unresolved_evidence || [];
  for (const blocker of checkpointBlockers) {
    if (!sessionBlockers.includes(blocker)) fail('EV4-SESSION-018', `Unresolved blocker ${blocker} disappeared from Session State.`);
  }
}

if (errors.length > 0) {
  console.error(`Session-state cross-field validation failed for ${filePath}:`);
  for (const error of errors) console.error(`- ${error.code}: ${error.message}`);
  process.exit(1);
}

console.log(`Session-state cross-field validation passed: ${filePath}`);
