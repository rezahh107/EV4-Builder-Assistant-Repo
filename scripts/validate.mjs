#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const transactionFixture = 'tests/valid/runtime-transaction/complete-transaction.json';

export const requiredShardIds = Object.freeze([
  'contracts-and-static',
  'runtime-core',
  'runtime-reconciliation',
  'atomic-run-bundle',
  'committed-replay-exactness',
  'run-concurrency',
  'run-crash-recovery',
  'nested-lock-publication',
  'lock-restore-no-clobber',
  'coordinated-final-repair',
  'project-pack-determinism',
  'ce-project-gate-smoke',
  'runtime-transaction',
  'runtime-transaction-state'
]);

export const canonicalShardTaskContracts = Object.freeze({
  transaction: Object.freeze({
    id: 'node:scripts/validate-builder-runtime-transaction.mjs',
    executable: 'node',
    args: Object.freeze([
      'scripts/validate-builder-runtime-transaction.mjs',
      transactionFixture,
      '--self-test'
    ]),
    shard: 'runtime-transaction'
  }),
  transactionState: Object.freeze({
    id: 'node:scripts/validate-builder-runtime-transaction-state.mjs',
    executable: 'node',
    args: Object.freeze([
      'scripts/validate-builder-runtime-transaction-state.mjs',
      transactionFixture
    ]),
    shard: 'runtime-transaction-state'
  })
});

let nextOrder = 0;
function npmTask(script, shard = 'contracts-and-static') {
  return Object.freeze({
    id: `npm:${script}`,
    order: nextOrder++,
    kind: 'npm',
    executable: 'npm',
    args: Object.freeze(['run', script]),
    label: `npm run ${script}`,
    shard
  });
}
function nodeTask(check, shard, args = [check]) {
  return Object.freeze({
    id: `node:${check}`,
    order: nextOrder++,
    kind: 'node',
    executable: 'node',
    args: Object.freeze(args),
    label: `node ${args.join(' ')}`,
    shard
  });
}

export const canonicalTasks = Object.freeze([
  npmTask('validate:version-consistency'),
  npmTask('validate:schema-registry'),
  npmTask('build:project-pack'),
  npmTask('validate:builder-context-package'),
  npmTask('validate:cross-field'),
  npmTask('validate:reference-paradigm'),
  npmTask('validate:golden-reference'),
  npmTask('validate:spatial-lexicon'),
  npmTask('validate:build-intent-template'),
  npmTask('validate:build-intent-brief'),
  npmTask('validate:experience-intent'),
  npmTask('validate:action-batch'),
  npmTask('validate:unit-policy'),
  npmTask('validate:evidence-claims'),
  npmTask('validate:completion-status'),
  npmTask('validate:repair-packet'),
  npmTask('validate:visual-parity'),
  npmTask('validate:asset-generation'),
  npmTask('validate:ui-confidence'),
  npmTask('validate:user-facing-wording'),
  npmTask('validate:checkpoint'),
  npmTask('validate:intake-result'),
  npmTask('validate:session-state'),
  npmTask('validate:layout-check'),
  npmTask('validate:completion-gate'),
  npmTask('validate:unit-strategy'),
  npmTask('validate:batch-compaction'),
  npmTask('validate:cognitive-mode-hint'),
  npmTask('validate:runtime-behavior'),
  npmTask('validate:builder-lineage-sequence'),

  nodeTask('scripts/validate-builder-bootstrap.mjs', 'contracts-and-static'),
  nodeTask('scripts/validate-ce-builder-transformation-registry.mjs', 'contracts-and-static'),
  nodeTask('scripts/validate-ce-reference-map-adapter.mjs', 'contracts-and-static'),
  nodeTask('scripts/validate-ce-to-builder-contract-gate.mjs', 'contracts-and-static'),
  nodeTask('scripts/validate-ce-builder-package-adapter.mjs', 'contracts-and-static'),
  nodeTask('scripts/validate-real-elementor-execution-evidence.mjs', 'contracts-and-static'),
  nodeTask('scripts/validate-role-alignment-intake.mjs', 'contracts-and-static'),
  nodeTask('scripts/validate-builder-producer-adoption.mjs', 'contracts-and-static'),
  nodeTask('scripts/validate-builder-context-decision-lineage.mjs', 'contracts-and-static'),
  nodeTask('scripts/validate-decision-escape-routes.mjs', 'contracts-and-static'),
  nodeTask('scripts/validate-kernel-decision-receipts.mjs', 'contracts-and-static'),
  nodeTask('scripts/validate-lean-runtime.mjs', 'runtime-core'),
  nodeTask('scripts/validate-canonical-run-artifacts.mjs', 'runtime-core'),
  nodeTask('scripts/test-builder-historical-bypass-records.mjs', 'runtime-core'),
  nodeTask('scripts/test-builder-authority-bypasses.mjs', 'runtime-core'),
  nodeTask('scripts/test-builder-truth-spine.mjs', 'runtime-core'),
  nodeTask('scripts/test-builder-explicit-source-modes.mjs', 'runtime-core'),
  nodeTask('scripts/test-builder-functional-correctness.mjs', 'runtime-core'),
  nodeTask('scripts/test-builder-atomic-run-bundle.mjs', 'atomic-run-bundle'),
  nodeTask('scripts/test-builder-successor-reconciliation.mjs', 'runtime-reconciliation'),
  nodeTask('scripts/test-builder-transition-planners.mjs', 'runtime-reconciliation'),
  nodeTask('scripts/test-builder-single-replay-authority.mjs', 'runtime-reconciliation'),
  nodeTask('scripts/test-builder-committed-replay-exactness.mjs', 'committed-replay-exactness'),
  nodeTask('scripts/test-builder-committed-replay-semantic-fields.mjs', 'runtime-reconciliation'),
  nodeTask('scripts/test-builder-run-concurrency.mjs', 'run-concurrency'),
  nodeTask('scripts/test-builder-run-crash-recovery.mjs', 'run-crash-recovery'),
  nodeTask('scripts/test-builder-nested-lock-publication.mjs', 'nested-lock-publication'),
  nodeTask('scripts/test-builder-lock-restore-no-clobber.mjs', 'lock-restore-no-clobber'),
  nodeTask('scripts/test-builder-coordinated-final-repair.mjs', 'coordinated-final-repair'),
  nodeTask('scripts/test-project-pack-determinism.mjs', 'project-pack-determinism'),
  nodeTask('scripts/smoke-ce-project-gate-builder.mjs', 'ce-project-gate-smoke'),
  nodeTask(
    'scripts/validate-builder-runtime-transaction.mjs',
    'runtime-transaction',
    ['scripts/validate-builder-runtime-transaction.mjs', transactionFixture, '--self-test']
  ),
  nodeTask(
    'scripts/validate-builder-runtime-transaction-state.mjs',
    'runtime-transaction-state',
    ['scripts/validate-builder-runtime-transaction-state.mjs', transactionFixture]
  ),
  nodeTask('scripts/test-validation-sharding.mjs', 'contracts-and-static')
]);

export function buildPartition(tasks = canonicalTasks, requiredShards = requiredShardIds) {
  const partition = requiredShards.map((id) => ({ id, taskIds: [] }));
  const byId = new Map(partition.map((shard) => [shard.id, shard]));
  for (const task of tasks) {
    if (!byId.has(task.shard)) {
      const shard = { id: task.shard, taskIds: [task.id] };
      partition.push(shard);
      byId.set(task.shard, shard);
    } else byId.get(task.shard).taskIds.push(task.id);
  }
  return partition;
}

export function validatePartition({
  tasks = canonicalTasks,
  requiredShards = requiredShardIds,
  partition = buildPartition(tasks, requiredShards)
} = {}) {
  const diagnostics = [];
  const taskIdCounts = new Map();
  for (const task of tasks) taskIdCounts.set(task.id, (taskIdCounts.get(task.id) || 0) + 1);
  for (const [taskId, count] of taskIdCounts) {
    if (count > 1) diagnostics.push(`DUPLICATE_CANONICAL_TASK:${taskId}`);
  }

  const knownTaskIds = new Set(tasks.map((task) => task.id));
  const knownShardIds = new Set(requiredShards);
  const seenShardIds = new Set();
  const taskAssignments = new Map();

  for (const shard of partition) {
    if (seenShardIds.has(shard.id)) diagnostics.push(`DUPLICATE_SHARD:${shard.id}`);
    seenShardIds.add(shard.id);
    if (!knownShardIds.has(shard.id)) diagnostics.push(`UNKNOWN_SHARD:${shard.id}`);
    if (!Array.isArray(shard.taskIds) || shard.taskIds.length === 0) diagnostics.push(`EMPTY_REQUIRED_SHARD:${shard.id}`);
    for (const taskId of shard.taskIds || []) {
      if (!knownTaskIds.has(taskId)) diagnostics.push(`UNKNOWN_TASK_REFERENCE:${taskId}`);
      const assigned = taskAssignments.get(taskId) || [];
      assigned.push(shard.id);
      taskAssignments.set(taskId, assigned);
    }
  }

  for (const shardId of requiredShards) {
    if (!seenShardIds.has(shardId)) diagnostics.push(`MISSING_REQUIRED_SHARD:${shardId}`);
  }
  for (const task of tasks) {
    const assignments = taskAssignments.get(task.id) || [];
    if (assignments.length === 0) diagnostics.push(`MISSING_TASK:${task.id}`);
    if (assignments.length > 1) diagnostics.push(`TASK_ASSIGNED_TO_MULTIPLE_SHARDS:${task.id}`);
  }

  if (diagnostics.length > 0) {
    const error = new Error(`Validation partition is invalid:\n- ${diagnostics.join('\n- ')}`);
    error.code = 'INVALID_VALIDATION_PARTITION';
    error.diagnostics = diagnostics;
    throw error;
  }

  return {
    taskCount: tasks.length,
    shardCount: requiredShards.length,
    missingTasks: 0,
    duplicateTasks: 0,
    unknownTasks: 0
  };
}

function workflowJobBlock(workflowText, jobId) {
  const escaped = jobId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = workflowText.match(new RegExp(`(?:^|\\n)  ${escaped}:\\n([\\s\\S]*?)(?=\\n  [A-Za-z0-9_-]+:\\n|$)`));
  return match?.[1] || '';
}

function executableWorkflowText(workflowText) {
  return workflowText
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

function sameArray(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export function getCanonicalTaskIdentity(taskId, {
  tasks = canonicalTasks,
  requiredShards = requiredShardIds,
  partition = buildPartition(tasks, requiredShards)
} = {}) {
  const matches = tasks.filter((task) => task.id === taskId);
  const assignments = partition.flatMap((shard) => (shard.taskIds || []).filter((id) => id === taskId).map(() => shard.id));
  return {
    count: matches.length,
    task: matches.length === 1 ? {
      id: matches[0].id,
      executable: matches[0].executable,
      args: [...matches[0].args],
      shard: matches[0].shard
    } : null,
    assignments
  };
}

export function validateShardExecutionContract({
  tasks = canonicalTasks,
  requiredShards = requiredShardIds,
  partition = buildPartition(tasks, requiredShards),
  workflowText
} = {}) {
  const diagnostics = [];
  try {
    validatePartition({ tasks, requiredShards, partition });
  } catch (error) {
    diagnostics.push(...(error?.diagnostics || [`PARTITION_VALIDATION_FAILED:${error?.message || 'unknown'}`]));
  }

  for (const expected of Object.values(canonicalShardTaskContracts)) {
    const identity = getCanonicalTaskIdentity(expected.id, { tasks, requiredShards, partition });
    if (identity.count !== 1) diagnostics.push(`CANONICAL_TASK_COUNT:${expected.id}:${identity.count}`);
    if (
      !identity.task ||
      identity.task.executable !== expected.executable ||
      !sameArray(identity.task.args, expected.args) ||
      identity.task.shard !== expected.shard
    ) diagnostics.push(`CANONICAL_TASK_IDENTITY_MISMATCH:${expected.id}`);
    if (identity.assignments.length !== 1 || identity.assignments[0] !== expected.shard) {
      diagnostics.push(`CANONICAL_TASK_ASSIGNMENT_MISMATCH:${expected.id}`);
    }
  }

  if (typeof workflowText !== 'string') diagnostics.push('WORKFLOW_TEXT_REQUIRED');
  else {
    const executableText = executableWorkflowText(workflowText);
    const discover = workflowJobBlock(executableText, 'discover');
    const shardJob = workflowJobBlock(executableText, 'validation_shard');
    const finalJob = workflowJobBlock(executableText, 'validate');

    if (!/node\s+scripts\/validate\.mjs\s+--list-shards\b/.test(discover)) diagnostics.push('WORKFLOW_LIST_SHARDS_MISSING');
    if (!/matrix:\s*\$\{\{\s*fromJSON\(needs\.discover\.outputs\.matrix\)\s*\}\}/.test(shardJob)) diagnostics.push('WORKFLOW_MATRIX_CONSUMPTION_MISSING');
    if (!/node\s+scripts\/validate\.mjs\s+--shard\s+["']?\$\{\{\s*matrix\.shard\s*\}\}["']?/.test(shardJob)) diagnostics.push('WORKFLOW_SHARD_EXECUTION_MISSING');
    if (
      !/EXPECTED_SHA:\s*\$\{\{\s*needs\.discover\.outputs\.expected_sha\s*\}\}/.test(shardJob) ||
      !/EVENT_SHA:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/.test(shardJob) ||
      !/ACTUAL_SHA="\$\(git rev-parse HEAD\)"/.test(shardJob) ||
      !/test "\$EXPECTED_SHA" = "\$EVENT_SHA"/.test(shardJob) ||
      !/test "\$ACTUAL_SHA" = "\$EXPECTED_SHA"/.test(shardJob)
    ) diagnostics.push('WORKFLOW_EXACT_HEAD_CHECK_MISSING');
    if (!/if:\s*always\(\)/.test(finalJob) || !/needs:\s*\[discover,\s*validation_shard\]/.test(finalJob)) {
      diagnostics.push('WORKFLOW_FINAL_DEPENDENCIES_MISSING');
    }
    if (
      !/DISCOVERY_RESULT:\s*\$\{\{\s*needs\.discover\.result\s*\}\}/.test(finalJob) ||
      !/SHARD_RESULT:\s*\$\{\{\s*needs\.validation_shard\.result\s*\}\}/.test(finalJob) ||
      !/test "\$DISCOVERY_RESULT" = "success"/.test(finalJob) ||
      !/test "\$SHARD_RESULT" = "success"/.test(finalJob)
    ) diagnostics.push('WORKFLOW_FINAL_AGGREGATION_MISSING');

    if (/\bnpm\s+run\s+validate\b/.test(executableText)) diagnostics.push('WORKFLOW_MONOLITHIC_EXECUTION_PRESENT');
    if (/\bnode\s+scripts\/validate-builder-runtime-transaction(?:-state)?\.mjs\b/.test(executableText)) {
      diagnostics.push('WORKFLOW_DUPLICATE_TRANSACTION_EXECUTION_PRESENT');
    }
  }

  if (diagnostics.length > 0) {
    const error = new Error(`Shard execution contract is invalid:\n- ${diagnostics.join('\n- ')}`);
    error.code = 'INVALID_SHARD_EXECUTION_CONTRACT';
    error.diagnostics = diagnostics;
    throw error;
  }

  return {
    taskCount: tasks.length,
    shardCount: requiredShards.length,
    transactionTaskId: canonicalShardTaskContracts.transaction.id,
    transactionStateTaskId: canonicalShardTaskContracts.transactionState.id
  };
}

export function getExecutionPlan(shardId = null) {
  validatePartition();
  if (shardId !== null && !requiredShardIds.includes(shardId)) {
    const error = new Error(`UNKNOWN_SHARD:${shardId}`);
    error.code = 'UNKNOWN_SHARD';
    throw error;
  }
  return canonicalTasks
    .filter((task) => shardId === null || task.shard === shardId)
    .map((task) => ({
      id: task.id,
      order: task.order,
      shard: task.shard,
      kind: task.kind,
      executable: task.executable,
      args: [...task.args],
      label: task.label
    }));
}

function writeOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value).replace(/[\r\n]+/g, ' ')}\n`);
  }
}

function failureDetail(result) {
  const lines = `${result.stderr || ''}\n${result.stdout || ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.find((line) => line.startsWith('- ')) ||
    lines.find((line) => /failed|missing|mismatch|unexpectedly passed/i.test(line)) ||
    lines.at(-1) ||
    'no diagnostic output'
  ).replace(/[^\x20-\x7E]/g, '?').slice(0, 220);
}

function runTask(task, shardId) {
  const command = task.kind === 'npm' ? npmCommand : process.execPath;
  const label = `[${shardId}] ${task.label}`;
  console.log(`\n==> ${label}`);
  const result = spawnSync(command, [...task.args], {
    encoding: 'utf8',
    maxBuffer: 96 * 1024 * 1024,
    env: process.env
  });
  if (result.error || result.status !== 0) {
    writeOutput('failed_check', `${label} :: ${result.error?.message || failureDetail(result)}`);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    console.error(`${label}: failed with exit code ${result.status ?? 1}.`);
    process.exit(result.status ?? 1);
  }
  console.log(`${label}: passed.`);
}

function printUsage() {
  console.log('Usage:');
  console.log('  node scripts/validate.mjs');
  console.log('  node scripts/validate.mjs --list-shards');
  console.log('  node scripts/validate.mjs --plan [--shard <id>]');
  console.log('  node scripts/validate.mjs --verify-partition');
  console.log('  node scripts/validate.mjs --shard <id>');
}

export function main(argv = process.argv.slice(2)) {
  let shardId = null;
  let operation = 'run';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--list-shards') operation = 'list-shards';
    else if (arg === '--plan') operation = 'plan';
    else if (arg === '--verify-partition') operation = 'verify-partition';
    else if (arg === '--shard') {
      shardId = argv[index + 1];
      index += 1;
      if (!shardId) throw new Error('Missing shard ID after --shard.');
    } else if (arg === '--help' || arg === '-h') operation = 'help';
    else throw new Error(`Unknown argument: ${arg}`);
  }

  const summary = validatePartition();
  if (shardId !== null && !requiredShardIds.includes(shardId)) throw new Error(`UNKNOWN_SHARD:${shardId}`);

  if (operation === 'help') return printUsage();
  if (operation === 'list-shards') {
    console.log(JSON.stringify({ shard: requiredShardIds }));
    return;
  }
  if (operation === 'plan') {
    console.log(JSON.stringify({ tasks: getExecutionPlan(shardId) }, null, 2));
    return;
  }
  if (operation === 'verify-partition') {
    console.log(JSON.stringify({
      task_count: summary.taskCount,
      shard_count: summary.shardCount,
      missing_tasks: summary.missingTasks,
      duplicate_tasks: summary.duplicateTasks,
      unknown_tasks: summary.unknownTasks
    }));
    return;
  }

  const plan = getExecutionPlan(shardId);
  const activeShard = shardId || 'full';
  for (const task of plan) runTask(task, activeShard);
}

const directInvocation = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (directInvocation) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exit(1);
  }
}
