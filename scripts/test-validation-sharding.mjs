#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  buildPartition,
  canonicalShardTaskContracts,
  canonicalTasks,
  getCanonicalTaskIdentity,
  getExecutionPlan,
  requiredShardIds,
  validatePartition,
  validateShardExecutionContract
} from './validate.mjs';

const baselineNpm = `
validate:version-consistency validate:schema-registry build:project-pack
validate:builder-context-package validate:cross-field validate:reference-paradigm
validate:golden-reference validate:spatial-lexicon validate:build-intent-template
validate:build-intent-brief validate:experience-intent validate:action-batch
validate:unit-policy validate:evidence-claims validate:completion-status
validate:repair-packet validate:visual-parity validate:asset-generation
validate:ui-confidence validate:user-facing-wording validate:checkpoint
validate:intake-result validate:session-state validate:layout-check
validate:completion-gate validate:unit-strategy validate:batch-compaction
validate:cognitive-mode-hint validate:runtime-behavior validate:builder-lineage-sequence
`.trim().split(/\s+/).map((name) => `npm:${name}`);

const baselineNode = `
scripts/validate-builder-bootstrap.mjs
scripts/validate-ce-builder-transformation-registry.mjs
scripts/validate-ce-reference-map-adapter.mjs
scripts/validate-ce-to-builder-contract-gate.mjs
scripts/validate-ce-builder-package-adapter.mjs
scripts/validate-real-elementor-execution-evidence.mjs
scripts/validate-role-alignment-intake.mjs
scripts/validate-builder-producer-adoption.mjs
scripts/validate-builder-context-decision-lineage.mjs
scripts/validate-decision-escape-routes.mjs
scripts/validate-kernel-decision-receipts.mjs
scripts/validate-lean-runtime.mjs
scripts/validate-canonical-run-artifacts.mjs
scripts/test-builder-historical-bypass-records.mjs
scripts/test-builder-authority-bypasses.mjs
scripts/test-builder-truth-spine.mjs
scripts/test-builder-explicit-source-modes.mjs
scripts/test-builder-functional-correctness.mjs
scripts/test-builder-atomic-run-bundle.mjs
scripts/test-builder-successor-reconciliation.mjs
scripts/test-builder-transition-planners.mjs
scripts/test-builder-single-replay-authority.mjs
scripts/test-builder-committed-replay-exactness.mjs
scripts/test-builder-committed-replay-semantic-fields.mjs
scripts/test-builder-run-concurrency.mjs
scripts/test-builder-run-crash-recovery.mjs
scripts/test-builder-nested-lock-publication.mjs
scripts/test-builder-lock-restore-no-clobber.mjs
scripts/test-builder-coordinated-final-repair.mjs
scripts/test-project-pack-determinism.mjs
scripts/smoke-ce-project-gate-builder.mjs
scripts/validate-builder-runtime-transaction.mjs
scripts/validate-builder-runtime-transaction-state.mjs
`.trim().split(/\s+/).map((name) => `node:${name}`);

const startingHeadTaskIds = Object.freeze([...baselineNpm, ...baselineNode]);
const shardingTestId = 'node:scripts/test-validation-sharding.mjs';
const workflowPath = new URL('../.github/workflows/schema-validation.yml', import.meta.url);
const workflowText = fs.readFileSync(workflowPath, 'utf8');
const cloneTasks = () => canonicalTasks.map((task) => ({ ...task, args: [...task.args] }));
const clonePartition = (tasks = canonicalTasks) => buildPartition(tasks).map((shard) => ({ id: shard.id, taskIds: [...shard.taskIds] }));

function expectPartitionDiagnostic(mutate, code) {
  const partition = clonePartition();
  mutate(partition);
  assert.throws(
    () => validatePartition({ partition }),
    (error) => error?.diagnostics?.some((diagnostic) => diagnostic.startsWith(code))
  );
}

function expectContractDiagnostic({
  mutateTasks = null,
  mutatePartition = null,
  mutateWorkflow = null,
  code
}) {
  const tasks = cloneTasks();
  if (mutateTasks) mutateTasks(tasks);
  const partition = clonePartition(tasks);
  if (mutatePartition) mutatePartition(partition, tasks);
  const text = mutateWorkflow ? mutateWorkflow(workflowText) : workflowText;
  assert.throws(
    () => validateShardExecutionContract({ tasks, requiredShards: requiredShardIds, partition, workflowText: text }),
    (error) => error?.diagnostics?.some((diagnostic) => diagnostic.startsWith(code)),
    `Expected shard-contract diagnostic ${code}`
  );
}

function inventory() {
  const ids = canonicalTasks.map((task) => task.id);
  assert.deepEqual(ids, [...startingHeadTaskIds, shardingTestId]);
  const result = validatePartition();
  console.log(JSON.stringify({ missing_tasks: result.missingTasks, duplicate_tasks: result.duplicateTasks, unknown_tasks: result.unknownTasks }));
}

function plans() {
  const full = getExecutionPlan();
  assert.deepEqual(full.map((task) => task.id), [...startingHeadTaskIds, shardingTestId]);
  assert.equal(full.find((task) => task.id === baselineNpm[0])?.kind, 'npm');
  assert.equal(full.find((task) => task.id === baselineNode[0])?.kind, 'node');
  const shards = requiredShardIds.flatMap((id) => getExecutionPlan(id));
  assert.equal(shards.length, full.length);
  assert.deepEqual(shards.map((task) => task.id).sort(), full.map((task) => task.id).sort());
  for (const id of requiredShardIds) {
    const plan = getExecutionPlan(id);
    assert.ok(plan.length > 0);
    assert.ok(plan.every((task) => task.shard === id));
  }
  console.log('PASS');
}

function partitionMutations() {
  expectPartitionDiagnostic((p) => {
    const shard = p.find((entry) => entry.taskIds.includes(startingHeadTaskIds[0]));
    shard.taskIds = shard.taskIds.filter((id) => id !== startingHeadTaskIds[0]);
  }, 'MISSING_TASK:');
  expectPartitionDiagnostic((p) => {
    const source = p.find((entry) => entry.taskIds.includes(startingHeadTaskIds[0]));
    p.find((entry) => entry.id !== source.id).taskIds.push(startingHeadTaskIds[0]);
  }, 'TASK_ASSIGNED_TO_MULTIPLE_SHARDS:');
  expectPartitionDiagnostic((p) => p[0].taskIds.push('node:scripts/not-canonical.mjs'), 'UNKNOWN_TASK_REFERENCE:');
  expectPartitionDiagnostic((p) => p.push({ id: 'unknown-shard', taskIds: [startingHeadTaskIds[0]] }), 'UNKNOWN_SHARD:');
  expectPartitionDiagnostic((p) => { p.find((entry) => entry.id === 'atomic-run-bundle').taskIds = []; }, 'EMPTY_REQUIRED_SHARD:');

  const result = spawnSync(process.execPath, ['scripts/validate.mjs', '--shard', 'unknown-shard'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8'
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /UNKNOWN_SHARD:unknown-shard/);
  console.log('missing_task_rejected\nduplicate_task_rejected\nunknown_task_rejected\nunknown_shard_rejected\nempty_required_shard_rejected\nPASS');
}

function canonicalIdentities() {
  const transaction = getCanonicalTaskIdentity(canonicalShardTaskContracts.transaction.id);
  assert.deepEqual(transaction, {
    count: 1,
    task: {
      id: canonicalShardTaskContracts.transaction.id,
      executable: 'node',
      args: [...canonicalShardTaskContracts.transaction.args],
      shard: 'runtime-transaction'
    },
    assignments: ['runtime-transaction']
  });
  const transactionState = getCanonicalTaskIdentity(canonicalShardTaskContracts.transactionState.id);
  assert.deepEqual(transactionState, {
    count: 1,
    task: {
      id: canonicalShardTaskContracts.transactionState.id,
      executable: 'node',
      args: [...canonicalShardTaskContracts.transactionState.args],
      shard: 'runtime-transaction-state'
    },
    assignments: ['runtime-transaction-state']
  });
  console.log('PASS');
}

function sharedContractMutations() {
  const transactionId = canonicalShardTaskContracts.transaction.id;
  const transactionStateId = canonicalShardTaskContracts.transactionState.id;

  expectContractDiagnostic({
    mutateTasks: (tasks) => tasks.splice(tasks.findIndex((task) => task.id === transactionId), 1),
    code: `CANONICAL_TASK_COUNT:${transactionId}:0`
  });
  expectContractDiagnostic({
    mutateTasks: (tasks) => tasks.splice(tasks.findIndex((task) => task.id === transactionStateId), 1),
    code: `CANONICAL_TASK_COUNT:${transactionStateId}:0`
  });
  expectContractDiagnostic({
    mutatePartition: (partition) => partition.find((shard) => shard.id === 'runtime-core').taskIds.push(transactionId),
    code: `TASK_ASSIGNED_TO_MULTIPLE_SHARDS:${transactionId}`
  });
  expectContractDiagnostic({
    mutateTasks: (tasks) => {
      const task = tasks.find((entry) => entry.id === transactionId);
      task.args[1] = 'tests/valid/runtime-transaction/wrong.json';
    },
    code: `CANONICAL_TASK_IDENTITY_MISMATCH:${transactionId}`
  });
  expectContractDiagnostic({
    mutateTasks: (tasks) => {
      const task = tasks.find((entry) => entry.id === transactionId);
      task.args = task.args.filter((arg) => arg !== '--self-test');
    },
    code: `CANONICAL_TASK_IDENTITY_MISMATCH:${transactionId}`
  });
  expectContractDiagnostic({
    mutateTasks: (tasks) => {
      tasks.find((entry) => entry.id === transactionId).shard = 'runtime-core';
    },
    code: `CANONICAL_TASK_IDENTITY_MISMATCH:${transactionId}`
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => text.replace('node scripts/validate.mjs --list-shards', 'node scripts/validate.mjs --plan'),
    code: 'WORKFLOW_LIST_SHARDS_MISSING'
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => text.replace('${{ fromJSON(needs.discover.outputs.matrix) }}', '${{ fromJSON(\'{"shard":["runtime-core"]}\') }}'),
    code: 'WORKFLOW_MATRIX_CONSUMPTION_MISSING'
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => text.replace('node scripts/validate.mjs --shard "${{ matrix.shard }}"', 'node scripts/validate.mjs --plan'),
    code: 'WORKFLOW_SHARD_EXECUTION_MISSING'
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => text.replaceAll('test "$ACTUAL_SHA" = "$EXPECTED_SHA"', 'echo "$ACTUAL_SHA $EXPECTED_SHA"'),
    code: 'WORKFLOW_EXACT_HEAD_CHECK_MISSING'
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => text.replace('test "$SHARD_RESULT" = "success"', 'echo "$SHARD_RESULT"'),
    code: 'WORKFLOW_FINAL_AGGREGATION_MISSING'
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => text
      .replace('node scripts/validate.mjs --shard "${{ matrix.shard }}"', 'echo "legacy markers only"')
      .concat('\n# npm run validate\n# Run Builder runtime transaction enforcement validation\n# node scripts/validate-builder-runtime-transaction.mjs tests/valid/runtime-transaction/complete-transaction.json --self-test\n# node scripts/validate-builder-runtime-transaction-state.mjs tests/valid/runtime-transaction/complete-transaction.json\n'),
    code: 'WORKFLOW_SHARD_EXECUTION_MISSING'
  });

  console.log('missing_transaction_task_rejected\nmissing_transaction_state_task_rejected\nduplicate_transaction_assignment_rejected\nwrong_transaction_fixture_rejected\nmissing_self_test_rejected\nwrong_transaction_shard_rejected\nremoved_list_shards_rejected\nremoved_matrix_consumption_rejected\nremoved_shard_execution_rejected\nremoved_exact_head_check_rejected\nremoved_final_aggregation_rejected\ninert_legacy_comments_rejected\nPASS');
}

function workflow() {
  const result = validateShardExecutionContract({ workflowText });
  assert.equal(result.taskCount, canonicalTasks.length);
  assert.equal(result.shardCount, requiredShardIds.length);
  assert.equal(result.transactionTaskId, canonicalShardTaskContracts.transaction.id);
  assert.equal(result.transactionStateTaskId, canonicalShardTaskContracts.transactionState.id);
  console.log(JSON.stringify({
    dynamic_matrix_from_canonical_registry: true,
    exact_head_verification_per_shard: true,
    final_job_requires_all_shards: true,
    hard_coded_transaction_execution: false
  }));
}

const tests = {
  inventory,
  plans,
  partitionMutations,
  canonicalIdentities,
  sharedContractMutations,
  workflow
};
const mode = process.argv[2] || 'all';
if (mode === 'all') Object.values(tests).forEach((test) => test());
else if (tests[mode]) tests[mode]();
else throw new Error(`Unknown test mode: ${mode}`);
