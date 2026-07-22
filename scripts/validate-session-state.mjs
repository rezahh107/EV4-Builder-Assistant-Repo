#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { isAllowedCombination } from './lib/runtime-transaction-engine.mjs';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/validate-session-state.mjs <session_state.json>');
  process.exit(2);
}

const session = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
const errors = [];
const fail = (code, message) => errors.push({ code, message });
const normalizeAbsent = (value) => value ?? null;
const displayCandidate = (value) => value ?? '<absent>';

function failIfCandidateMismatch(code, leftLabel, leftValue, rightLabel, rightValue) {
  if (normalizeAbsent(leftValue) !== normalizeAbsent(rightValue)) {
    fail(code, `${leftLabel} ${displayCandidate(leftValue)} must equal ${rightLabel} ${displayCandidate(rightValue)}.`);
  }
}

if (session.runtime_state && session.current_state && session.runtime_state !== session.current_state) {
  fail('EV4-SESSION-002', `current_state ${session.current_state} must equal runtime_state ${session.runtime_state}.`);
}
if (session.workflow_mode && session.runtime_state && !isAllowedCombination(session.workflow_mode, session.runtime_state)) {
  fail('EV4-SESSION-010', `${session.workflow_mode} cannot use runtime_state ${session.runtime_state} under runtime/state-transitions.v1.json.`);
}
if (session.runtime_state === 'CORRECTION' && !session.repair_packet) {
  fail('EV4-SESSION-003', 'runtime_state CORRECTION requires repair_packet.');
}

const selectedCandidate = session.selected_candidate_id;
const checkpoint = session.last_verified_checkpoint;
const repairPacket = session.repair_packet;

if (checkpoint) failIfCandidateMismatch('EV4-SESSION-004', 'last_verified_checkpoint.selected_candidate_id', checkpoint.selected_candidate_id, 'session.selected_candidate_id', selectedCandidate);
if (repairPacket) failIfCandidateMismatch('EV4-SESSION-005', 'repair_packet.selected_candidate_id', repairPacket.selected_candidate_id, 'session.selected_candidate_id', selectedCandidate);
if (repairPacket?.last_safe_checkpoint) failIfCandidateMismatch('EV4-SESSION-006', 'repair_packet.last_safe_checkpoint.selected_candidate_id', repairPacket.last_safe_checkpoint.selected_candidate_id, 'session.selected_candidate_id', selectedCandidate);

const activeRuntimeStates = new Set(['BUILD_ACTIVE', 'WAITING_FOR_CONFIRMATION', 'EVIDENCE_REQUIRED', 'CORRECTION', 'COMPLETED']);
if (checkpoint?.schema === 'ev4-builder-checkpoint@0.1.0' && activeRuntimeStates.has(session.runtime_state)) {
  fail('EV4-SESSION-007', `Legacy checkpoint schema ${checkpoint.schema} cannot be used as last_verified_checkpoint in active runtime_state ${session.runtime_state}.`);
}
if (repairPacket && session.runtime_state !== 'CORRECTION') fail('EV4-SESSION-008', `repair_packet may only be active when runtime_state is CORRECTION; received ${session.runtime_state}.`);
if (repairPacket && repairPacket.runtime_state !== 'CORRECTION') fail('EV4-SESSION-009', `repair_packet.runtime_state must be CORRECTION; received ${repairPacket.runtime_state}.`);

if (session.runtime_state === 'PAUSED') {
  if (!session.session_id || !session.package_digest || !session.resume_target) {
    fail('EV4-SESSION-011', 'PAUSED requires session_id, package_digest, and resume_target.');
  } else if (!isAllowedCombination(session.resume_target.workflow_mode, session.resume_target.runtime_state)) {
    fail('EV4-SESSION-012', 'resume_target must be a legal mode/state combination from runtime/state-transitions.v1.json.');
  }
}

if (checkpoint?.schema === 'ev4-builder-checkpoint@0.2.0') {
  if (session.session_id && checkpoint.session_id && session.session_id !== checkpoint.session_id) fail('EV4-SESSION-016', 'session_id must match last_verified_checkpoint.session_id.');
  if (session.package_digest && checkpoint.package_digest && session.package_digest !== checkpoint.package_digest) fail('EV4-SESSION-017', 'package_digest must match last_verified_checkpoint.package_digest.');
  if (session.source_file_sha256 && checkpoint.source_file_sha256 && session.source_file_sha256 !== checkpoint.source_file_sha256) fail('EV4-SESSION-019', 'source_file_sha256 must match last_verified_checkpoint.source_file_sha256.');
  if (session.workflow_mode && checkpoint.workflow_mode && session.workflow_mode !== checkpoint.workflow_mode) fail('EV4-SESSION-020', 'workflow_mode must match last_verified_checkpoint.workflow_mode.');
  if (session.runtime_state && checkpoint.runtime_state && session.runtime_state !== checkpoint.runtime_state) fail('EV4-SESSION-021', 'runtime_state must match last_verified_checkpoint.runtime_state.');
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
