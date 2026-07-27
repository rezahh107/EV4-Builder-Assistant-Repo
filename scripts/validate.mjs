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
  'runtime-tail'
]);

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
  nodeTask('scripts/test-project-pack-determinism.mjs', 'runtime-tail'),
  nodeTask('scripts/smoke-ce-project-gate-builder.mjs', 'runtime-tail'),
  nodeTask(
    'scripts/validate-builder-runtime-transaction.mjs',
    'runtime-tail',
    ['scripts/validate-builder-runtime-transaction.mjs', transactionFixture, '--self-test']
  ),
  nodeTask(
    'scripts/validate-builder-runtime-transaction-state.mjs',
    'runtime-tail',
    ['scripts/validate-builder-runtime-transaction-state.mjs', transactionFixture]
  ),
  nodeTask('scripts/test-validation-sharding.mjs', 'contracts-and-static')
]);

export function buildPartition(tasks = canonicalTasks) {
  const partition = requiredShardIds.map((id) => ({ id, taskIds: [] }));
  const byId = new Map(partition.map((shard) => [shard.id, shard]));
  for (const task of tasks) {
    if (!byId.has(task.shard)) partition.push({ id: task.shard, taskIds: [task.id] });
    else byId.get(task.shard).taskIds.push(task.id);
  }
  return partition;
}

export function validatePartition({
  tasks = canonicalTasks,
  requiredShards = requiredShardIds,
  partition = buildPartition(tasks)
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
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
}
