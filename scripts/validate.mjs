#!/usr/bin/env node
import cp from 'node:child_process';

const npmScripts = [
  'validate:version-consistency',
  'validate:schema-registry',
  'build:project-pack',
  'validate:builder-context-package',
  'validate:cross-field',
  'validate:reference-paradigm',
  'validate:golden-reference',
  'validate:spatial-lexicon',
  'validate:build-intent-template',
  'validate:build-intent-brief',
  'validate:experience-intent',
  'validate:action-batch',
  'validate:unit-policy',
  'validate:evidence-claims',
  'validate:completion-status',
  'validate:repair-packet',
  'validate:visual-parity',
  'validate:asset-generation',
  'validate:ui-confidence',
  'validate:user-facing-wording',
  'validate:checkpoint',
  'validate:intake-result',
  'validate:session-state',
  'validate:layout-check',
  'validate:completion-gate',
  'validate:unit-strategy',
  'validate:batch-compaction',
  'validate:cognitive-mode-hint',
  'validate:runtime-behavior'
];

const nodeChecks = [
  'scripts/validate-ce-builder-transformation-registry.mjs',
  'scripts/validate-ce-reference-map-adapter.mjs',
  'scripts/validate-ce-to-builder-contract-gate.mjs',
  'scripts/validate-ce-builder-field-preservation-contract.mjs',
  'scripts/validate-ce-builder-package-adapter.mjs',
  'scripts/validate-real-elementor-execution-evidence.mjs',
  'scripts/validate-role-alignment-intake.mjs'
];

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function checked(command, args, label) {
  console.log('\n==> ' + label);
  const result = cp.spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) {
    console.error('Failed to execute ' + command + ': ' + result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

for (const script of npmScripts) checked(npmCommand, ['run', script], 'npm run ' + script);
for (const check of nodeChecks) checked(process.execPath, [check], 'node ' + check);
