#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  buildPartition,
  canonicalPcvpParityWorkflowContract,
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
const pcvpTaskId = canonicalShardTaskContracts.pcvpFocused.id;
const shardingTestId = 'node:scripts/test-validation-sharding.mjs';
const expectedTaskIds = Object.freeze([...startingHeadTaskIds, pcvpTaskId, shardingTestId]);
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

function expectContractDiagnostic({ mutateTasks = null, mutatePartition = null, mutateWorkflow = null, code }) {
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

function replaceInParityJob(text, before, after) {
  const start = text.indexOf(`  ${canonicalPcvpParityWorkflowContract.jobId}:`);
  const end = text.indexOf('\n  validate:', start);
  assert.ok(start >= 0 && end > start);
  const block = text.slice(start, end);
  assert.ok(block.includes(before), `Parity job marker not found: ${before}`);
  return `${text.slice(0, start)}${block.replace(before, after)}${text.slice(end)}`;
}

function inventory() {
  const ids = canonicalTasks.map((task) => task.id);
  assert.deepEqual(ids, expectedTaskIds);
  const result = validatePartition();
  console.log(JSON.stringify({
    missing_tasks: result.missingTasks,
    duplicate_tasks: result.duplicateTasks,
    unknown_tasks: result.unknownTasks,
    pcvp_task_count: ids.filter((id) => id === pcvpTaskId).length
  }));
}

function plans() {
  const full = getExecutionPlan();
  assert.deepEqual(full.map((task) => task.id), expectedTaskIds);
  assert.equal(full.filter((task) => task.id === pcvpTaskId).length, 1);
  assert.equal(full.find((task) => task.id === pcvpTaskId)?.shard, 'contracts-and-static');
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

function assertCanonicalIdentity(contract) {
  const identity = getCanonicalTaskIdentity(contract.id);
  assert.deepEqual(identity, {
    count: 1,
    task: {
      id: contract.id,
      executable: contract.executable,
      args: [...contract.args],
      shard: contract.shard
    },
    assignments: [contract.shard]
  });
}

function canonicalIdentities() {
  assertCanonicalIdentity(canonicalShardTaskContracts.transaction);
  assertCanonicalIdentity(canonicalShardTaskContracts.transactionState);
  assertCanonicalIdentity(canonicalShardTaskContracts.pcvpFocused);
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
    mutateTasks: (tasks) => tasks.splice(tasks.findIndex((task) => task.id === pcvpTaskId), 1),
    code: `CANONICAL_TASK_COUNT:${pcvpTaskId}:0`
  });
  expectContractDiagnostic({
    mutateTasks: (tasks) => {
      const task = tasks.find((entry) => entry.id === pcvpTaskId);
      tasks.push({ ...task, args: [...task.args] });
    },
    code: `CANONICAL_TASK_COUNT:${pcvpTaskId}:2`
  });
  expectContractDiagnostic({
    mutatePartition: (partition) => partition.find((shard) => shard.id === 'runtime-core').taskIds.push(pcvpTaskId),
    code: `TASK_ASSIGNED_TO_MULTIPLE_SHARDS:${pcvpTaskId}`
  });
  expectContractDiagnostic({
    mutateTasks: (tasks) => { tasks.find((entry) => entry.id === pcvpTaskId).executable = 'npm'; },
    code: `CANONICAL_TASK_IDENTITY_MISMATCH:${pcvpTaskId}`
  });
  expectContractDiagnostic({
    mutateTasks: (tasks) => { tasks.find((entry) => entry.id === pcvpTaskId).args = ['tests/wrong-pcvp.test.mjs']; },
    code: `CANONICAL_TASK_IDENTITY_MISMATCH:${pcvpTaskId}`
  });
  expectContractDiagnostic({
    mutateTasks: (tasks) => { tasks.find((entry) => entry.id === pcvpTaskId).shard = 'runtime-core'; },
    code: `CANONICAL_TASK_IDENTITY_MISMATCH:${pcvpTaskId}`
  });
  expectContractDiagnostic({
    mutatePartition: (partition) => {
      const shard = partition.find((entry) => entry.taskIds.includes(pcvpTaskId));
      shard.taskIds = shard.taskIds.filter((id) => id !== pcvpTaskId);
    },
    code: `MISSING_TASK:${pcvpTaskId}`
  });
  expectContractDiagnostic({
    mutatePartition: (partition) => partition.find((shard) => shard.id === 'runtime-core').taskIds.push(transactionId),
    code: `TASK_ASSIGNED_TO_MULTIPLE_SHARDS:${transactionId}`
  });
  expectContractDiagnostic({
    mutateTasks: (tasks) => { tasks.find((entry) => entry.id === transactionId).args[1] = 'tests/valid/runtime-transaction/wrong.json'; },
    code: `CANONICAL_TASK_IDENTITY_MISMATCH:${transactionId}`
  });
  expectContractDiagnostic({
    mutateTasks: (tasks) => { tasks.find((entry) => entry.id === transactionId).args = tasks.find((entry) => entry.id === transactionId).args.filter((arg) => arg !== '--self-test'); },
    code: `CANONICAL_TASK_IDENTITY_MISMATCH:${transactionId}`
  });
  expectContractDiagnostic({
    mutateTasks: (tasks) => { tasks.find((entry) => entry.id === transactionId).shard = 'runtime-core'; },
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
    mutateWorkflow: (text) => text.replace(`  ${canonicalPcvpParityWorkflowContract.jobId}:`, '  pcvp_removed:'),
    code: 'WORKFLOW_PCVP_PARITY_JOB_MISSING'
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => replaceInParityJob(text, canonicalPcvpParityWorkflowContract.dependencyCommit, '1111111111111111111111111111111111111111'),
    code: 'WORKFLOW_PCVP_DEPENDENCY_IDENTITY_MISMATCH'
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => replaceInParityJob(text, 'test "$ACTUAL_SHA" = "$EXPECTED_SHA"', 'echo "$ACTUAL_SHA $EXPECTED_SHA"'),
    code: 'WORKFLOW_PCVP_BUILDER_EXACT_HEAD_CHECK_MISSING'
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => replaceInParityJob(text, 'test "$ACTUAL_DEPENDENCY_SHA" = "$EXPECTED_DEPENDENCY_SHA"', 'echo "$ACTUAL_DEPENDENCY_SHA $EXPECTED_DEPENDENCY_SHA"'),
    code: 'WORKFLOW_PCVP_DEPENDENCY_EXACT_HEAD_CHECK_MISSING'
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => text.replace('actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5', 'actions/checkout@v4'),
    code: 'WORKFLOW_MUTABLE_ACTION_REFERENCE'
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => replaceInParityJob(text, 'persist-credentials: false', 'persist-credentials: true'),
    code: 'WORKFLOW_PCVP_CHECKOUT_CREDENTIALS_NOT_DISABLED'
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => replaceInParityJob(text, `node ${canonicalPcvpParityWorkflowContract.harness}`, 'echo parity-skipped'),
    code: 'WORKFLOW_PCVP_PARITY_EXECUTION_MISSING'
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => text.replace('needs: [discover, validation_shard, pcvp_canonical_parity]', 'needs: [discover, validation_shard]'),
    code: 'WORKFLOW_FINAL_DEPENDENCIES_MISSING'
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => text.replace('test "$PCVP_PARITY_RESULT" = "success"', 'echo "$PCVP_PARITY_RESULT"'),
    code: 'WORKFLOW_FINAL_AGGREGATION_MISSING'
  });
  expectContractDiagnostic({
    mutateWorkflow: (text) => text
      .replace('node scripts/validate.mjs --shard "${{ matrix.shard }}"', 'echo "legacy markers only"')
      .concat('\n# npm run validate\n# node scripts/validate-builder-runtime-transaction.mjs tests/valid/runtime-transaction/complete-transaction.json --self-test\n# node scripts/validate-builder-runtime-transaction-state.mjs tests/valid/runtime-transaction/complete-transaction.json\n'),
    code: 'WORKFLOW_SHARD_EXECUTION_MISSING'
  });

  console.log('missing_pcvp_task_rejected\nduplicate_pcvp_task_rejected\nmultiple_pcvp_assignment_rejected\nwrong_pcvp_executable_rejected\nwrong_pcvp_arguments_rejected\nwrong_pcvp_shard_rejected\npcvp_removed_from_partition_rejected\nmissing_parity_job_rejected\ndependency_ref_drift_rejected\nbuilder_identity_check_removal_rejected\ndependency_identity_check_removal_rejected\nmutable_action_reference_rejected\npersisted_credentials_rejected\nmissing_parity_execution_rejected\nmissing_parity_dependency_rejected\nmissing_parity_aggregation_rejected\nPASS');
}

function workflow() {
  const result = validateShardExecutionContract({ workflowText });
  assert.equal(result.taskCount, canonicalTasks.length);
  assert.equal(result.shardCount, requiredShardIds.length);
  assert.equal(result.transactionTaskId, canonicalShardTaskContracts.transaction.id);
  assert.equal(result.transactionStateTaskId, canonicalShardTaskContracts.transactionState.id);
  assert.equal(result.pcvpFocusedTaskId, pcvpTaskId);
  assert.equal(result.pcvpParityJobId, canonicalPcvpParityWorkflowContract.jobId);
  console.log(JSON.stringify({
    dynamic_matrix_from_canonical_registry: true,
    exact_head_verification_per_shard: true,
    canonical_pcvp_task_registered_once: true,
    canonical_pcvp_parity_required: true,
    immutable_action_pins: true,
    checkout_credentials_persisted: false,
    final_job_requires_all_shards_and_parity: true,
    hard_coded_transaction_execution: false
  }));
}

const tests = { inventory, plans, partitionMutations, canonicalIdentities, sharedContractMutations, workflow };
const mode = process.argv[2] || 'all';
if (mode === 'all') Object.values(tests).forEach((test) => test());
else if (tests[mode]) tests[mode]();
else throw new Error(`Unknown test mode: ${mode}`);
