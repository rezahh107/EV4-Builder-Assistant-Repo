#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const scripts = [
  'validate:version-consistency',
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
  'validate:elementor-asset-generation',
  'validate:unit-strategy',
  'validate:batch-compaction',
  'validate:cognitive-mode-hint'
];

for (const script of scripts) {
  console.log(`\n==> npm run ${script}`);
  const result = spawnSync('npm', ['run', script], { stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
