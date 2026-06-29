#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: node scripts/validate-session-state.mjs <session_state.json>');
  process.exit(2);
}

const session = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
const errors = [];

function fail(code, message) {
  errors.push({ code, message });
}

const CANONICAL_RUNTIME_STATES = new Set([
  'INTAKE_WAITING',
  'INTAKE_VALIDATING',
  'BUILD_ACTIVE',
  'WAITING_FOR_CONFIRMATION',
  'EVIDENCE_REQUIRED',
  'CORRECTION',
  'REVIEW_ONLY',
  'PAUSED',
  'COMPLETED'
]);

const ACTIVE_RUNTIME_STATES = new Set([
  'BUILD_ACTIVE',
  'WAITING_FOR_CONFIRMATION',
  'EVIDENCE_REQUIRED',
  'CORRECTION',
  'COMPLETED'
]);

if (session.current_state && !CANONICAL_RUNTIME_STATES.has(session.current_state)) {
  fail('EV4-SESSION-001', `current_state ${session.current_state} is not a canonical runtime_state.`);
}

if (session.runtime_state && session.current_state && session.runtime_state !== session.current_state) {
  fail('EV4-SESSION-002', `current_state ${session.current_state} must equal runtime_state ${session.runtime_state}.`);
}

if (session.runtime_state === 'CORRECTION' && !session.repair_packet) {
  fail('EV4-SESSION-003', 'runtime_state CORRECTION requires repair_packet.');
}

const selectedCandidate = session.selected_candidate_id;
const checkpoint = session.last_verified_checkpoint;
const repairPacket = session.repair_packet;

if (selectedCandidate && checkpoint?.selected_candidate_id && checkpoint.selected_candidate_id !== selectedCandidate) {
  fail('EV4-SESSION-004', `last_verified_checkpoint.selected_candidate_id ${checkpoint.selected_candidate_id} must equal session.selected_candidate_id ${selectedCandidate}.`);
}

if (selectedCandidate && repairPacket?.selected_candidate_id && repairPacket.selected_candidate_id !== selectedCandidate) {
  fail('EV4-SESSION-005', `repair_packet.selected_candidate_id ${repairPacket.selected_candidate_id} must equal session.selected_candidate_id ${selectedCandidate}.`);
}

if (selectedCandidate && repairPacket?.last_safe_checkpoint?.selected_candidate_id && repairPacket.last_safe_checkpoint.selected_candidate_id !== selectedCandidate) {
  fail('EV4-SESSION-006', `repair_packet.last_safe_checkpoint.selected_candidate_id ${repairPacket.last_safe_checkpoint.selected_candidate_id} must equal session.selected_candidate_id ${selectedCandidate}.`);
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

if (errors.length > 0) {
  console.error(`Session-state cross-field validation failed for ${filePath}:`);
  for (const error of errors) console.error(`- ${error.code}: ${error.message}`);
  process.exit(1);
}

console.log(`Session-state cross-field validation passed: ${filePath}`);
