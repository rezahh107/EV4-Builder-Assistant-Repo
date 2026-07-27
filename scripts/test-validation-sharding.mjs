#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { buildPartition, canonicalTasks, getExecutionPlan, requiredShardIds, validatePartition } from './validate.mjs';

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
const clonePartition = () => buildPartition().map((shard) => ({ id: shard.id, taskIds: [...shard.taskIds] }));

function expectDiagnostic(mutate, code) {
  const partition = clonePartition();
  mutate(partition);
  assert.throws(
    () => validatePartition({ partition }),
    (error) => error?.diagnostics?.some((diagnostic) => diagnostic.startsWith(code))
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

function mutations() {
  expectDiagnostic((p) => {
    const shard = p.find((entry) => entry.taskIds.includes(startingHeadTaskIds[0]));
    shard.taskIds = shard.taskIds.filter((id) => id !== startingHeadTaskIds[0]);
  }, 'MISSING_TASK:');
  expectDiagnostic((p) => {
    const source = p.find((entry) => entry.taskIds.includes(startingHeadTaskIds[0]));
    p.find((entry) => entry.id !== source.id).taskIds.push(startingHeadTaskIds[0]);
  }, 'TASK_ASSIGNED_TO_MULTIPLE_SHARDS:');
  expectDiagnostic((p) => p[0].taskIds.push('node:scripts/not-canonical.mjs'), 'UNKNOWN_TASK_REFERENCE:');
  expectDiagnostic((p) => p.push({ id: 'unknown-shard', taskIds: [startingHeadTaskIds[0]] }), 'UNKNOWN_SHARD:');
  expectDiagnostic((p) => { p.find((entry) => entry.id === 'atomic-run-bundle').taskIds = []; }, 'EMPTY_REQUIRED_SHARD:');

  const result = spawnSync(process.execPath, ['scripts/validate.mjs', '--shard', 'unknown-shard'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8'
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /UNKNOWN_SHARD:unknown-shard/);
  console.log('missing_task_rejected\nduplicate_task_rejected\nunknown_task_rejected\nunknown_shard_rejected\nempty_required_shard_rejected\nPASS');
}

function workflow() {
  const text = fs.readFileSync(new URL('../.github/workflows/schema-validation.yml', import.meta.url), 'utf8');
  const checks = {
    dynamic_matrix_from_canonical_registry: /node scripts\/validate\.mjs --list-shards/.test(text) && /fromJSON\(needs\.discover\.outputs\.matrix\)/.test(text),
    hard_coded_task_inventory_in_workflow: startingHeadTaskIds.some((id) => text.includes(id.replace(/^npm:/, 'npm run ').replace(/^node:/, 'node '))),
    exact_head_verification_per_shard: /validation_shard:[\s\S]*EXPECTED_SHA:[\s\S]*git rev-parse HEAD[\s\S]*test "\$ACTUAL_SHA" = "\$EXPECTED_SHA"/.test(text),
    required_shard_continue_on_error: /continue-on-error\s*:\s*true/.test(text),
    final_job_name: /\n  validate:\n    name:[ \t]*validate[ \t]*\n/.test(text) ? 'validate' : null,
    final_job_requires_all_shards: /\n  validate:\n[\s\S]*if:\s*always\(\)[\s\S]*needs:\s*\[discover, validation_shard\][\s\S]*DISCOVERY_RESULT[\s\S]*SHARD_RESULT/.test(text)
  };
  assert.deepEqual(checks, {
    dynamic_matrix_from_canonical_registry: true,
    hard_coded_task_inventory_in_workflow: false,
    exact_head_verification_per_shard: true,
    required_shard_continue_on_error: false,
    final_job_name: 'validate',
    final_job_requires_all_shards: true
  });
  assert.match(text, /fail-fast:\s*false/);
  assert.doesNotMatch(text, /npm run validate/);
  assert.match(text, /node scripts\/validate\.mjs --verify-partition/);
  console.log(JSON.stringify(checks));
}

const tests = { inventory, plans, mutations, workflow };
const mode = process.argv[2] || 'all';
if (mode === 'all') Object.values(tests).forEach((test) => test());
else if (tests[mode]) tests[mode]();
else throw new Error(`Unknown test mode: ${mode}`);
