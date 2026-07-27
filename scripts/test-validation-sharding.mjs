#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  buildPartition,
  canonicalTasks,
  getExecutionPlan,
  requiredShardIds,
  validatePartition
} from './validate.mjs';

const startingHeadTaskIds = Object.freeze([
  'npm:validate:version-consistency',
  'npm:validate:schema-registry',
  'npm:build:project-pack',
  'npm:validate:builder-context-package',
  'npm:validate:cross-field',
  'npm:validate:reference-paradigm',
  'npm:validate:golden-reference',
  'npm:validate:spatial-lexicon',
  'npm:validate:build-intent-template',
  'npm:validate:build-intent-brief',
  'npm:validate:experience-intent',
  'npm:validate:action-batch',
  'npm:validate:unit-policy',
  'npm:validate:evidence-claims',
  'npm:validate:completion-status',
  'npm:validate:repair-packet',
  'npm:validate:visual-parity',
  'npm:validate:asset-generation',
  'npm:validate:ui-confidence',
  'npm:validate:user-facing-wording',
  'npm:validate:checkpoint',
  'npm:validate:intake-result',
  'npm:validate:session-state',
  'npm:validate:layout-check',
  'npm:validate:completion-gate',
  'npm:validate:unit-strategy',
  'npm:validate:batch-compaction',
  'npm:validate:cognitive-mode-hint',
  'npm:validate:runtime-behavior',
  'npm:validate:builder-lineage-sequence',
  'node:scripts/validate-builder-bootstrap.mjs',
  'node:scripts/validate-ce-builder-transformation-registry.mjs',
  'node:scripts/validate-ce-reference-map-adapter.mjs',
  'node:scripts/validate-ce-to-builder-contract-gate.mjs',
  'node:scripts/validate-ce-builder-package-adapter.mjs',
  'node:scripts/validate-real-elementor-execution-evidence.mjs',
  'node:scripts/validate-role-alignment-intake.mjs',
  'node:scripts/validate-builder-producer-adoption.mjs',
  'node:scripts/validate-builder-context-decision-lineage.mjs',
  'node:scripts/validate-decision-escape-routes.mjs',
  'node:scripts/validate-kernel-decision-receipts.mjs',
  'node:scripts/validate-lean-runtime.mjs',
  'node:scripts/validate-canonical-run-artifacts.mjs',
  'node:scripts/test-builder-historical-bypass-records.mjs',
  'node:scripts/test-builder-authority-bypasses.mjs',
  'node:scripts/test-builder-truth-spine.mjs',
  'node:scripts/test-builder-explicit-source-modes.mjs',
  'node:scripts/test-builder-functional-correctness.mjs',
  'node:scripts/test-builder-atomic-run-bundle.mjs',
  'node:scripts/test-builder-successor-reconciliation.mjs',
  'node:scripts/test-builder-transition-planners.mjs',
  'node:scripts/test-builder-single-replay-authority.mjs',
  'node:scripts/test-builder-committed-replay-exactness.mjs',
  'node:scripts/test-builder-committed-replay-semantic-fields.mjs',
  'node:scripts/test-builder-run-concurrency.mjs',
  'node:scripts/test-builder-run-crash-recovery.mjs',
  'node:scripts/test-builder-nested-lock-publication.mjs',
  'node:scripts/test-builder-lock-restore-no-clobber.mjs',
  'node:scripts/test-builder-coordinated-final-repair.mjs',
  'node:scripts/test-project-pack-determinism.mjs',
  'node:scripts/smoke-ce-project-gate-builder.mjs',
  'node:scripts/validate-builder-runtime-transaction.mjs',
  'node:scripts/validate-builder-runtime-transaction-state.mjs'
]);

const shardingTestId = 'node:scripts/test-validation-sharding.mjs';

function clonePartition(partition = buildPartition()) {
  return partition.map((shard) => ({ id: shard.id, taskIds: [...shard.taskIds] }));
}

function expectDiagnostic(name, mutate, expectedCode) {
  const partition = clonePartition();
  mutate(partition);
  assert.throws(
    () => validatePartition({ partition }),
    (error) => error?.diagnostics?.some((diagnostic) => diagnostic.startsWith(expectedCode)),
    `${name} must be rejected with ${expectedCode}`
  );
}

function testInventory() {
  const taskIds = canonicalTasks.map((task) => task.id);
  assert.deepEqual(taskIds.slice(0, startingHeadTaskIds.length), startingHeadTaskIds);
  assert.equal(taskIds.length, startingHeadTaskIds.length + 1);
  assert.equal(taskIds.at(-1), shardingTestId);
  const summary = validatePartition();
  console.log(JSON.stringify({
    missing_tasks: summary.missingTasks,
    duplicate_tasks: summary.duplicateTasks,
    unknown_tasks: summary.unknownTasks
  }));
}

function testPlans() {
  const fullPlan = getExecutionPlan();
  assert.deepEqual(fullPlan.map((task) => task.id), [...startingHeadTaskIds, shardingTestId]);
  const shardPlans = requiredShardIds.flatMap((shardId) => getExecutionPlan(shardId));
  assert.equal(shardPlans.length, fullPlan.length);
  assert.deepEqual(
    shardPlans.map((task) => task.id).sort(),
    fullPlan.map((task) => task.id).sort()
  );
  for (const shardId of requiredShardIds) {
    const shardPlan = getExecutionPlan(shardId);
    assert.ok(shardPlan.length > 0, `${shardId} must not be empty`);
    assert.ok(shardPlan.every((task) => task.shard === shardId));
  }
  console.log('PASS');
}

function testMutations() {
  expectDiagnostic('missing task', (partition) => {
    const shard = partition.find((entry) => entry.taskIds.includes(startingHeadTaskIds[0]));
    shard.taskIds = shard.taskIds.filter((taskId) => taskId !== startingHeadTaskIds[0]);
  }, 'MISSING_TASK:');

  expectDiagnostic('duplicate task', (partition) => {
    const source = partition.find((entry) => entry.taskIds.includes(startingHeadTaskIds[0]));
    const target = partition.find((entry) => entry.id !== source.id);
    target.taskIds.push(startingHeadTaskIds[0]);
  }, 'TASK_ASSIGNED_TO_MULTIPLE_SHARDS:');

  expectDiagnostic('unknown task reference', (partition) => {
    partition[0].taskIds.push('node:scripts/not-a-canonical-task.mjs');
  }, 'UNKNOWN_TASK_REFERENCE:');

  expectDiagnostic('unknown shard', (partition) => {
    partition.push({ id: 'unknown-required-shard', taskIds: [startingHeadTaskIds[0]] });
  }, 'UNKNOWN_SHARD:');

  expectDiagnostic('empty required shard', (partition) => {
    const shard = partition.find((entry) => entry.id === 'atomic-run-bundle');
    shard.taskIds = [];
  }, 'EMPTY_REQUIRED_SHARD:');

  const unknownShardRun = spawnSync(
    process.execPath,
    ['scripts/validate.mjs', '--shard', 'unknown-shard'],
    { cwd: new URL('..', import.meta.url), encoding: 'utf8' }
  );
  assert.notEqual(unknownShardRun.status, 0);
  assert.match(`${unknownShardRun.stdout}\n${unknownShardRun.stderr}`, /UNKNOWN_SHARD:unknown-shard/);

  console.log([
    'missing_task_rejected',
    'duplicate_task_rejected',
    'unknown_task_rejected',
    'unknown_shard_rejected',
    'empty_required_shard_rejected',
    'PASS'
  ].join('\n'));
}

function testWorkflow() {
  const workflow = fs.readFileSync(new URL('../.github/workflows/schema-validation.yml', import.meta.url), 'utf8');
  const checks = {
    dynamic_matrix_from_canonical_registry:
      /node scripts\/validate\.mjs --list-shards/.test(workflow) &&
      /matrix:\s*\$\{\{\s*fromJSON\(needs\.discover\.outputs\.matrix\)\s*\}\}/.test(workflow),
    hard_coded_task_inventory_in_workflow:
      startingHeadTaskIds.some((taskId) => workflow.includes(taskId.replace(/^npm:/, 'npm run ').replace(/^node:/, 'node '))),
    exact_head_verification_per_shard:
      /validation_shard:[\s\S]*EXPECTED_SHA:[\s\S]*git rev-parse HEAD[\s\S]*test "\$ACTUAL_SHA" = "\$EXPECTED_SHA"/.test(workflow),
    required_shard_continue_on_error: /continue-on-error\s*:\s*true/.test(workflow),
    final_job_name: /\n  validate:\n    name:[ \t]*validate[ \t]*\n/.test(workflow) ? 'validate' : null,
    final_job_requires_all_shards:
      /\n  validate:\n[\s\S]*?if:\s*always\(\)[\s\S]*?needs:\s*\[discover, validation_shard\][\s\S]*?DISCOVERY_RESULT[\s\S]*?SHARD_RESULT/.test(workflow)
  };

  assert.equal(checks.dynamic_matrix_from_canonical_registry, true);
  assert.equal(checks.hard_coded_task_inventory_in_workflow, false);
  assert.equal(checks.exact_head_verification_per_shard, true);
  assert.equal(checks.required_shard_continue_on_error, false);
  assert.equal(checks.final_job_name, 'validate');
  assert.equal(checks.final_job_requires_all_shards, true);
  assert.match(workflow, /fail-fast:\s*false/);
  assert.doesNotMatch(workflow, /npm run validate/);
  assert.match(workflow, /node scripts\/validate\.mjs --verify-partition/);

  console.log(JSON.stringify(checks));
}

const mode = process.argv[2] || 'all';
if (mode === 'inventory') testInventory();
else if (mode === 'plans') testPlans();
else if (mode === 'mutations') testMutations();
else if (mode === 'workflow') testWorkflow();
else if (mode === 'all') {
  testInventory();
  testPlans();
  testMutations();
  testWorkflow();
} else {
  throw new Error(`Unknown test mode: ${mode}`);
}
