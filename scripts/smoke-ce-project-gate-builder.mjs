#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-c2b-smoke-'));
const commands = [];

function run(command, args, label, expectedExit = 0) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: false
  });
  commands.push({ label, command: [command, ...args].join(' '), exit_code: result.status ?? 1 });
  if (result.status !== expectedExit) {
    throw new Error(`${label} expected exit ${expectedExit}, received ${result.status}.\n${result.stderr || result.stdout || ''}`);
  }
  return result;
}

try {
  run(process.execPath, ['scripts/validate-ce-to-builder-contract-gate.mjs'], 'Builder-owned CE to Builder Contract Gate fixtures');
  run(process.execPath, ['scripts/validate-ce-builder-package-adapter.mjs'], 'Builder-owned CE package adapter fixtures');

  const builderInput = 'tests/valid/runtime-transaction/carriers/builder_context_package.json';
  const capsule = path.join(temp, 'intake-result.json');
  run(process.execPath, ['scripts/builder-inspector.mjs', 'intake', builderInput, capsule], 'Project Gate builder-input fixture intake');
  const intake = JSON.parse(fs.readFileSync(capsule, 'utf8'));
  if (intake.status !== 'accepted' || intake.builder_context_schema !== 'ev4-builder-context-package@1.0.0') {
    throw new Error('Builder Inspector did not accept the official nontrivial Builder input fixture.');
  }

  const receipt = path.join(temp, 'project-gate-c2b-receipt.json');
  const receiptResult = path.join(temp, 'receipt-intake-result.json');
  fs.writeFileSync(receipt, `${JSON.stringify({
    schema: 'ev4-project-gate-c2b-receipt@1.0.0',
    source_file_sha256: intake.source_file_sha256,
    canonical_package_digest: intake.canonical_package_digest
  }, null, 2)}\n`);
  run(process.execPath, ['scripts/builder-inspector.mjs', 'intake', receipt, receiptResult], 'Receipt-only intake remains non-semantic', 1);
  const blockedReceipt = JSON.parse(fs.readFileSync(receiptResult, 'utf8'));
  if (blockedReceipt.status !== 'blocked') throw new Error('Receipt-only intake unexpectedly passed.');

  console.log(JSON.stringify({
    schema: 'ev4-ce-project-gate-builder-smoke@1.0.0',
    status: 'passed',
    evidence_classification: 'fixture_based',
    builder_context_schema: intake.builder_context_schema,
    selected_candidate_id: intake.selected_candidate_id,
    package_digest_consistent: true,
    receipt_remains_non_semantic: true,
    manual_nested_extraction_required: false,
    commands
  }, null, 2));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
