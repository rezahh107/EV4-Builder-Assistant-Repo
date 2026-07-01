#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const scripts = [
  'validate:version-consistency',
  'validate:schema-registry',
  'build:project-pack',
  'validate:builder-context-package',
  'validate:cross-field',
  'validate:reference-paradigm',
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
  'validate:cognitive-mode-hint'
];

const nodeChecks = [
  'scripts/validate-ce-reference-map-adapter.mjs',
  'scripts/validate-ce-builder-package-adapter.mjs',
  'scripts/validate-real-elementor-execution-evidence.mjs'
];

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, label) {
  console.log('\n==> ' + label);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) {
    console.error('Failed to execute ' + command + ': ' + result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

for (const script of scripts) {
  run(npmCommand, ['run', script], 'npm run ' + script);
}

for (const check of nodeChecks) {
  run(process.execPath, [check], 'node ' + check);
}
