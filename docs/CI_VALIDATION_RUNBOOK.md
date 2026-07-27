# CI_VALIDATION_RUNBOOK — EV4 Builder Assistant

Version: 0.3.0
Status: active
Date: 2026-07-27

---

## Purpose

This runbook explains how to execute and interpret repository validation.

`scripts/validate.mjs` is the single authority for validation task identity, canonical order, command arguments, and shard assignment. Local `npm run validate` executes the complete canonical task inventory in order. GitHub Actions discovers the required shard matrix from that same registry and executes every required shard against one exact commit.

## Workflow

```text
.github/workflows/schema-validation.yml
```

Workflow name:

```text
Schema validation
```

Triggers:

```text
pull_request
push to main
```

### Required execution layers

```text
discover validation shards
→ validation / <shard-id> matrix
→ validate
```

- `discover` checks out `${{ github.event.pull_request.head.sha || github.sha }}` and verifies the actual checkout SHA.
- `discover` runs `node scripts/validate.mjs --verify-partition` and emits the matrix from `node scripts/validate.mjs --list-shards`.
- Every `validation / <shard-id>` job checks out and verifies the same exact SHA.
- Every shard runs `npm ci` and then `node scripts/validate.mjs --shard "${{ matrix.shard }}"`.
- Matrix `fail-fast` is disabled so all failures remain visible, but no shard is optional.
- The final required job is named `validate`, runs with `if: always()`, and succeeds only when discovery and the full shard matrix succeed.
- A failed, cancelled, skipped, or missing shard is incomplete evidence and cannot produce a successful final aggregate.

## Canonical Shards

The current required shard IDs are:

```text
contracts-and-static
runtime-core
runtime-reconciliation
atomic-run-bundle
committed-replay-exactness
run-concurrency
run-crash-recovery
nested-lock-publication
lock-restore-no-clobber
coordinated-final-repair
project-pack-determinism
ce-project-gate-smoke
runtime-transaction
runtime-transaction-state
```

Expected job names are:

```text
discover validation shards
validation / contracts-and-static
validation / runtime-core
validation / runtime-reconciliation
validation / atomic-run-bundle
validation / committed-replay-exactness
validation / run-concurrency
validation / run-crash-recovery
validation / nested-lock-publication
validation / lock-restore-no-clobber
validation / coordinated-final-repair
validation / project-pack-determinism
validation / ce-project-gate-smoke
validation / runtime-transaction
validation / runtime-transaction-state
validate
```

The shard list is generated from `scripts/validate.mjs`; the workflow does not own a second hard-coded task inventory.

## Local Execution

Complete local validation:

```bash
npm ci
npm run validate
```

Focused inspection:

```bash
node scripts/validate.mjs --verify-partition
node scripts/validate.mjs --list-shards
node scripts/validate.mjs --plan
node scripts/validate.mjs --plan --shard <shard-id>
node scripts/validate.mjs --shard <shard-id>
```

Sharding contract tests:

```bash
node --check scripts/validate.mjs
node --check scripts/test-validation-sharding.mjs
node scripts/test-validation-sharding.mjs
node scripts/test-validation-sharding.mjs inventory
node scripts/test-validation-sharding.mjs plans
node scripts/test-validation-sharding.mjs partitionMutations
node scripts/test-validation-sharding.mjs canonicalIdentities
node scripts/test-validation-sharding.mjs sharedContractMutations
node scripts/test-validation-sharding.mjs workflow
```

`npm run validate` remains the complete local interface. A single shard is a diagnostic or CI orchestration interface, not a reduced substitute for full validation.

## Shared Shard Execution Contract

`canonicalShardTaskContracts` in `scripts/validate.mjs` pins the exact canonical identity of the transaction tasks:

```text
node:scripts/validate-builder-runtime-transaction.mjs
  executable: node
  args:
    - scripts/validate-builder-runtime-transaction.mjs
    - tests/valid/runtime-transaction/complete-transaction.json
    - --self-test
  shard: runtime-transaction

node:scripts/validate-builder-runtime-transaction-state.mjs
  executable: node
  args:
    - scripts/validate-builder-runtime-transaction-state.mjs
    - tests/valid/runtime-transaction/complete-transaction.json
  shard: runtime-transaction-state
```

`validateShardExecutionContract()` verifies:

- each canonical transaction task exists exactly once;
- executable, exact arguments, and shard assignment match the canonical contract;
- each task is assigned once to the correct partition;
- the workflow discovers shards from the registry;
- the workflow consumes the dynamic matrix;
- each matrix job executes `--shard ${{ matrix.shard }}`;
- each shard verifies the exact tested SHA;
- the final `validate` job requires discovery and the complete shard matrix.

Legacy workflow comments or command strings are not accepted as execution evidence.

## What A Pass Means

A successful final `Schema validation / validate` result means:

```text
- discovery verified the tested commit;
- the canonical task partition was complete and non-duplicated;
- every required shard checked out the same exact commit;
- every canonical task was represented exactly once in the full CI plan;
- every required shard succeeded;
- the final aggregate succeeded.
```

A successful individual shard is partial evidence only.

## What A Pass Does Not Mean

A passing workflow does not prove:

```text
- real Elementor UI controls exist;
- live Elementor rendering matches a reference;
- Responsive behavior is correct;
- SVG/assets are final for production;
- real Elementor export JSON / EDIS is valid;
- deployment occurred;
- production readiness;
- Runtime authorization from GitHub state.
```

Exact-SHA CI is maintenance correctness evidence. Repository authority explicitly states:

```yaml
independent_review_required: false
pr_inspector_required: false
exact_head_runtime_authority: false
```

No PR status, reviewer identity, workflow label, or commit identity becomes Builder Runtime authorization.

## Failure Triage

### Discovery fails

Likely causes:

```text
checked-out SHA mismatch
invalid canonical task registry
missing, duplicated, empty, or unknown task/shard assignment
invalid matrix output
shared workflow contract drift
```

Run:

```bash
node scripts/validate.mjs --verify-partition
node scripts/validate.mjs --list-shards
node scripts/validate.mjs --plan
node scripts/test-validation-sharding.mjs
```

### A validation shard fails

The job name identifies the bounded shard. The runner logs the exact canonical command label before execution.

Run only that shard locally:

```bash
node scripts/validate.mjs --shard <shard-id>
```

Do not delete, skip, duplicate, make optional, or move a failing canonical task merely to obtain a green workflow.

### `runtime-transaction` fails

Inspect both the transaction semantics and the shared shard execution contract. Common causes include:

```text
missing canonical transaction task
wrong transaction fixture
missing --self-test
wrong shard assignment
dynamic matrix or exact-SHA workflow drift
final aggregate no longer requiring every shard
```

### Final `validate` fails

Inspect `discovery_result` and `validation_shards_result`. The final job intentionally fails when discovery or any matrix member did not succeed.

### Schema or fixture failure

Update a fixture only when the authoritative Schema and semantic rules support that change. Do not weaken a validator solely to make CI pass.

## Delivery Rule

For code-changing PRs, do not report complete repository validation until the final `Schema validation / validate` job succeeds on the exact resulting PR Head.

Repository merge authority is owner review and merge. A fresh PR Inspector or independent external review is not required by the active repository authority. CI remains normal maintenance evidence and does not become Runtime authorization.

For a docs-only commit, state its validation status truthfully. The push workflow still runs on `main`; do not claim that run passed until its visible conclusion is `success`.
