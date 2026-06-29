#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/validate-completion-gate.mjs <completion-gate.json>');
  process.exit(2);
}

const gate = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
const errors = [];

function fail(id, message) {
  errors.push({ id, message });
}

if (gate.schema !== 'ev4-completion-gate@0.1.0') fail('EV4-COMPLETE-001', 'schema must be ev4-completion-gate@0.1.0.');

const requiredProofNames = [
  'layout_verified',
  'frontend_verified',
  'responsive_verified',
  'accessibility_verified',
  'browser_verified',
  'export_verified',
  'final_qa_verified'
];

const proofs = gate.proofs || {};
const incompleteProofs = [];

for (const proofName of requiredProofNames) {
  const proof = proofs[proofName];
  if (!proof) {
    incompleteProofs.push(proofName);
    continue;
  }
  const hasEvidence = Array.isArray(proof.evidence_refs) && proof.evidence_refs.length > 0;
  if (proof.status !== 'confirmed' || !hasEvidence) incompleteProofs.push(proofName);
}

if (gate.production_ready_allowed === true) {
  if (gate.production_ready_claim !== true) fail('EV4-COMPLETE-002', 'production_ready_allowed true requires production_ready_claim true.');
  if (gate.required_next_action !== 'claim_production_ready') fail('EV4-COMPLETE-003', 'production_ready_allowed true requires required_next_action claim_production_ready.');
  if (incompleteProofs.length > 0) fail('EV4-COMPLETE-004', `production_ready_allowed true requires confirmed proof evidence for: ${incompleteProofs.join(', ')}.`);
}

if (gate.production_ready_claim === true) {
  if (gate.production_ready_allowed !== true) fail('EV4-COMPLETE-005', 'production_ready_claim true requires production_ready_allowed true.');
  if (gate.required_next_action !== 'claim_production_ready') fail('EV4-COMPLETE-006', 'production_ready_claim true requires required_next_action claim_production_ready.');
  if (incompleteProofs.length > 0) fail('EV4-COMPLETE-007', `production_ready_claim true requires all proof categories confirmed with evidence: ${incompleteProofs.join(', ')}.`);
}

if (gate.production_ready_allowed === false) {
  if (gate.production_ready_claim !== false) fail('EV4-COMPLETE-008', 'production_ready_allowed false requires production_ready_claim false.');
  if (gate.required_next_action === 'claim_production_ready') fail('EV4-COMPLETE-009', 'production_ready_allowed false must not claim production ready.');
}

if (incompleteProofs.length > 0 && gate.required_next_action === 'claim_production_ready') {
  fail('EV4-COMPLETE-010', 'Missing or unverified proof categories must not claim production ready.');
}

if (errors.length > 0) {
  console.error(`Completion gate validation failed for ${filePath}:`);
  for (const error of errors) console.error(`- ${error.id}: ${error.message}`);
  process.exit(1);
}

console.log(`Completion gate validation passed: ${filePath}`);
