#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const scripts = [
  'validate:version-consistency','validate:schema-registry','build:project-pack','validate:builder-context-package','validate:cross-field','validate:reference-paradigm','validate:golden-reference','validate:spatial-lexicon','validate:build-intent-template','validate:build-intent-brief','validate:experience-intent','validate:action-batch','validate:unit-policy','validate:evidence-claims','validate:completion-status','validate:repair-packet','validate:visual-parity','validate:asset-generation','validate:ui-confidence','validate:user-facing-wording','validate:checkpoint','validate:intake-result','validate:session-state','validate:layout-check','validate:completion-gate','validate:unit-strategy','validate:batch-compaction','validate:cognitive-mode-hint','validate:runtime-behavior','validate:builder-lineage-sequence'
];
const nodeChecks = [
  'scripts/validate-builder-bootstrap.mjs','scripts/validate-builder-personal-bootstrap.mjs','scripts/validate-builder-personal-contracts.mjs','scripts/test-builder-inspector.mjs','scripts/test-project-pack-determinism.mjs','scripts/validate-ce-builder-transformation-registry.mjs','scripts/validate-ce-reference-map-adapter.mjs','scripts/validate-ce-to-builder-contract-gate.mjs','scripts/validate-ce-builder-package-adapter.mjs','scripts/validate-real-elementor-execution-evidence.mjs','scripts/validate-role-alignment-intake.mjs','scripts/validate-builder-producer-adoption.mjs','scripts/validate-builder-context-decision-lineage.mjs','scripts/validate-decision-escape-routes.mjs','scripts/validate-kernel-decision-receipts.mjs','scripts/validate-pr-template-hygiene.mjs','scripts/validate-governance-progress-evidence.mjs','scripts/validate-governance-authorities.mjs','scripts/validate-governance-sequence.mjs','scripts/validate-builder-runtime-transaction.mjs','scripts/validate-builder-runtime-transaction-state.mjs'
];
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const transactionFixture = 'tests/valid/runtime-transaction/complete-transaction.json';
function writeOutput(name, value) { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value).replace(/[\r\n]+/g, ' ')}\n`); }
function failureDetail(result) {
  const lines = `${result.stderr || ''}\n${result.stdout || ''}`.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return (lines.find((line) => line.startsWith('- ')) || lines.find((line) => /failed|missing|mismatch|unexpectedly passed/i.test(line)) || lines.at(-1) || 'no diagnostic output').replace(/[^\x20-\x7E]/g, '?').slice(0, 180);
}
function run(command, args, label) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.error) { writeOutput('failed_check', `${label} :: ${result.error.message}`); console.error(`Failed to execute ${command}: ${result.error.message}`); process.exit(1); }
  if (result.status !== 0) {
    writeOutput('failed_check', `${label} :: ${failureDetail(result)}`);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    console.error(`${label}: failed with exit code ${result.status ?? 1}.`);
    process.exit(result.status ?? 1);
  }
  console.log(`${label}: passed.`);
}
for (const script of scripts) run(npmCommand, ['run', script], `npm run ${script}`);
for (const check of nodeChecks) {
  let args;
  if (check === 'scripts/validate-builder-runtime-transaction.mjs') args = [check, transactionFixture, '--self-test'];
  else if (check === 'scripts/validate-builder-runtime-transaction-state.mjs') args = [check, transactionFixture];
  else if (check === 'scripts/validate-governance-sequence.mjs' || check === 'scripts/validate-governance-progress-evidence.mjs') args = [check, '--mode=fixtures'];
  else args = [check];
  run(process.execPath, args, `node ${args.join(' ')}`);
}
