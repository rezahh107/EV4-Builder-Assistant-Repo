#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const schemaPath = 'schemas/real-elementor-execution-evidence.schema.json';
const validFiles = [
  'examples/smart-home-connector/real_elementor_execution_evidence.template.json'
];
const invalidFiles = [
  'tests/invalid/real_elementor_execution_evidence_claim_without_proof.json'
];

function run(command, args, label) {
  console.log('\n==> ' + label);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) {
    console.error('Failed to execute ' + command + ': ' + result.error.message);
    process.exit(1);
  }
  return result.status ?? 1;
}

function npxCommand() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function ajvValidate(file) {
  return run(npxCommand(), ['--yes', 'ajv-cli@5', 'validate', '--spec=draft2020', '--strict=false', '-s', schemaPath, '-d', file], 'ajv validate ' + file);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function validateSemantics(doc) {
  const diagnostics = [];
  const evidenceByRef = new Map((doc.evidence_items || []).map((item) => [item.evidence_ref, item]));
  const proofs = doc.verification_summary || {};

  if (doc.execution_status !== 'completed' && doc.production_ready_claim === true) {
    diagnostics.push('production_ready_claim must remain false until execution_status is completed.');
  }

  if (doc.production_ready_claim === true) {
    if (doc.required_next_action !== 'claim_production_ready') {
      diagnostics.push('production_ready_claim=true requires required_next_action=claim_production_ready.');
    }
    for (const [name, proof] of Object.entries(proofs)) {
      if (proof.status !== 'confirmed') {
        diagnostics.push(`${name} must be confirmed before production_ready_claim=true.`);
        continue;
      }
      if (!Array.isArray(proof.evidence_refs) || proof.evidence_refs.length === 0) {
        diagnostics.push(`${name} requires at least one evidence_ref before production_ready_claim=true.`);
        continue;
      }
      for (const ref of proof.evidence_refs) {
        const item = evidenceByRef.get(ref);
        if (!item || item.status !== 'confirmed') diagnostics.push(`${name} references missing or unconfirmed evidence item: ${ref}.`);
      }
    }
  }

  if (doc.repair_packet_required === true) {
    if (!doc.repair_packet_ref) diagnostics.push('repair_packet_required=true requires repair_packet_ref.');
    if (doc.required_next_action !== 'create_repair_packet') diagnostics.push('repair_packet_required=true requires required_next_action=create_repair_packet.');
  }

  if (doc.execution_status === 'not_started' && doc.required_next_action !== 'collect_real_ui_evidence') {
    diagnostics.push('execution_status=not_started requires required_next_action=collect_real_ui_evidence.');
  }

  return diagnostics;
}

let failed = false;

for (const file of validFiles) {
  if (!fs.existsSync(file)) {
    console.error('Missing valid real execution fixture: ' + file);
    failed = true;
    continue;
  }
  if (ajvValidate(file) !== 0) {
    failed = true;
    continue;
  }
  const diagnostics = validateSemantics(readJson(file));
  if (diagnostics.length > 0) {
    console.error('Valid real execution fixture failed semantic validation: ' + file);
    for (const diagnostic of diagnostics) console.error('- ' + diagnostic);
    failed = true;
  } else {
    console.log('Valid real execution fixture passed: ' + file);
  }
}

for (const file of invalidFiles) {
  if (!fs.existsSync(file)) {
    console.error('Missing invalid real execution fixture: ' + file);
    failed = true;
    continue;
  }
  const schemaStatus = ajvValidate(file);
  let semanticFailed = false;
  if (schemaStatus === 0) {
    const diagnostics = validateSemantics(readJson(file));
    semanticFailed = diagnostics.length > 0;
    if (semanticFailed) {
      console.log('Invalid real execution fixture correctly failed semantic validation: ' + file);
      for (const diagnostic of diagnostics) console.log('- ' + diagnostic);
    }
  }
  if (schemaStatus === 0 && !semanticFailed) {
    console.error('Invalid real execution fixture unexpectedly passed: ' + file);
    failed = true;
  } else if (schemaStatus !== 0) {
    console.log('Invalid real execution fixture correctly failed schema validation: ' + file);
  }
}

if (failed) process.exit(1);
console.log('Real Elementor execution evidence validation passed.');
