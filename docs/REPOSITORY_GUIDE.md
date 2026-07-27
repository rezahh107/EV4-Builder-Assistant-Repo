# REPOSITORY_GUIDE — EV4 Builder Assistant

Version: 0.3.6
Status: active_current_runtime
Date: 2026-07-27

---

## Purpose

This guide describes the current repository architecture and maintenance path. It follows the active Runtime authority on `main`; historical patch reports and planning files are context only and must not override the current authority files, Runtime code, Schemas, validators, or tests.

## Authority Order

Read these sources before changing Runtime behavior:

1. `runtime/personal-runtime-authority.v1.json`
2. `runtime/state-transitions.v1.json`
3. `PROJECT_INSTRUCTIONS.md`
4. `AGENTS.md`
5. relevant `schemas/`
6. relevant Runtime implementation under `scripts/lib/runtime/`
7. semantic validators and regression tests
8. `scripts/validate.mjs`

`runtime/personal-runtime-authority.v1.json` is the machine-readable repository boundary. It defines a personal single-operator Runtime focused on functional correctness. It explicitly keeps industrial governance outside active Runtime authorization.

## System Role

```text
EV4 Architect
= decides what should be built.

EV4 Builder Assistant
= executes an accepted Builder package through bounded, confirmable Runtime transitions.

EV4 Responsive Architect
= remains a separate downstream concern after real implementation evidence exists.
```

Builder Assistant must not redesign the selected architecture, change `selected_candidate_id`, replace decision lineage, widen class scope, fabricate evidence, or claim Responsive or production completion.

## Canonical Runtime

```text
explicit operator source
→ stable Run root
→ exact internal source snapshot
→ immutable generations/000001
→ atomic CURRENT.json
→ acquire .mutation-lock
→ load active generation after lock
→ derive complete expected successor
→ publish or reconcile exact immutable N+1
→ atomically replace CURRENT.json
→ validate the active Run
→ release lock
```

The full product flow is:

```text
real-intake
→ emit-batch
→ WAITING_FOR_CONFIRMATION
→ confirm-batch
→ BUILD_ACTIVE
→ attach-evidence
→ real-completion
→ COMPLETED
```

### Storage authority

```text
<run-directory>/
├── source/
├── evidence/
├── generations/000001/
├── generations/000002/...
├── transitions/
├── outputs/
├── CURRENT.json
└── .mutation-lock/
```

`CURRENT.json` is the sole active State selector. Published generations are immutable. Every mutation acquires `.mutation-lock` before reading State. Lock contention fails closed as `RUN_BUSY_OR_STALE_LOCK`.

A future generation is never authoritative because it has the highest number or passes Schema validation. The same canonical transition may finalize only a byte-identical expected N+1, including every operation-specific artifact. Conflicting, incomplete, or ambiguous future generations leave `CURRENT.json` unchanged.

If `CURRENT.json` already advanced but the caller did not receive success, rerunning the exact command reconstructs and compares the committed transition. Exact equality returns `replayed_existing_transition: true` without creating or rewriting a generation.

## Canonical Commands

```bash
node scripts/builder-inspector.mjs real-intake <project-gate|direct-ce|manual-builder-input> <source-artifact.json|-> <builder-input.json|-> <run-directory>
node scripts/builder-inspector.mjs emit-batch <run-directory>
node scripts/builder-inspector.mjs confirm-batch <run-directory> "<operator-token>"
node scripts/builder-inspector.mjs attach-evidence <run-directory> <evidence-source.json>
node scripts/builder-inspector.mjs real-completion <run-directory>
```

`recover-run-lock` is an explicit recovery operation, not a normal state transition. It may remove only validated stale lock or temporary debris and cannot promote an orphan generation.

## Explicit Source Modes

```yaml
project-gate:
  sourceArtifactFile: required
  builderInputFile: required
direct-ce:
  sourceArtifactFile: required
  builderInputFile: forbidden
manual-builder-input:
  sourceArtifactFile: forbidden
  builderInputFile: required
```

Intake reads selected external bytes once and writes internal snapshots under the stable Run root. Later commands use only those internal snapshots. Changing an external file after Intake cannot alter the Run; a different source requires a new Run.

## Runtime Truthfulness Boundaries

The Runtime preserves:

- exact source mode and content binding;
- Package, Candidate, Batch, Action, and decision-lineage continuity;
- lock-before-State ordering;
- immutable complete generations;
- canonical Checkpoint ancestry;
- zero-blocker emission;
- `WAITING_FOR_CONFIRMATION`-only Confirmation;
- exact verified Action-specific Evidence;
- Runtime-derived Completion Status and Completion Gate;
- `responsive_complete: false`;
- `production_ready: false`.

Historical bypass records are inert evidence. Legacy entrypoints return `BUILDER-LEGACY-AUTHORITY-INACTIVE` and cannot mutate or complete a Run.

## File Families

```text
PROJECT_INSTRUCTIONS.md       compact always-on Builder behavior
AGENTS.md                     repository maintenance rules
runtime/                      machine-readable authority, transitions, and project-pack source
core/                         active behavioral documentation
schemas/                      public and internal carrier contracts
scripts/builder-inspector.mjs canonical command interface
scripts/lib/runtime/          active Runtime implementation
scripts/validate.mjs          canonical validation task and shard registry
tests/                        valid, invalid, concurrency, crash, and replay coverage
docs/                         current explanatory and operating documentation
patch-reports/                historical implementation records
planning/ and governance/     historical/non-runtime process context
dist/chatgpt-project/         deterministic generated deployable pack
.github/workflows/            normal repository CI
```

Generated files under `dist/chatgpt-project/` must be produced and verified through `scripts/build-project-pack.mjs`; they are not hand-maintained authority.

## Validation Architecture

Local complete validation:

```bash
npm ci
npm run validate
```

`scripts/validate.mjs` owns canonical task identity, order, command arguments, and shard assignment. Local `npm run validate` executes the complete canonical inventory in order.

GitHub Actions uses:

```text
discover validation shards
→ validation / <shard-id>
→ validate
```

The `discover` job verifies the tested SHA and emits a matrix from `node scripts/validate.mjs --list-shards`. Every shard checks out that same SHA and runs its canonical task subset. The final required job remains named `validate` and succeeds only when discovery and every shard succeed.

Focused maintenance commands:

```bash
node scripts/validate.mjs --verify-partition
node scripts/validate.mjs --list-shards
node scripts/validate.mjs --plan
node scripts/validate.mjs --shard <shard-id>
node scripts/test-validation-sharding.mjs
node scripts/test-builder-run-concurrency.mjs
node scripts/test-builder-run-crash-recovery.mjs
node scripts/validate-canonical-run-artifacts.mjs <run-directory>
```

See `docs/CI_VALIDATION_RUNBOOK.md` for exact interpretation and failure triage.

## Current Delivery State

PR `#66` was merged into `main` on 2026-07-27.

```yaml
merged_pr_head: e3eb26277a5e49a68c3b6a9ed452d5c794f2f13f
merge_commit: 05db0e210220a60c85d1faca073642da57941970
exact_pr_head_ci:
  workflow: Schema validation
  run_id: 30250938148
  result: success
```

The active Runtime truth spine, lock/recovery behavior, deterministic successor reconciliation, committed replay, and dynamic canonical validation shards are therefore part of `main`.

Repository authority states:

```yaml
independent_review_required: false
pr_inspector_required: false
exact_head_runtime_authority: false
maintenance_authorities:
  - normal_ci
  - owner_review_and_merge
```

Exact-SHA CI is retained as maintenance correctness evidence. It is not Runtime authorization and does not add an external governance dependency.

## Current Limits

The repository does not claim:

- real Elementor execution evidence;
- Responsive completion;
- Builder-to-Responsive export;
- deployment;
- production readiness;
- signatures, PKI, remote attestation, distributed locking, or multi-tenant authority.

Do not add a database, service layer, daemon, event bus, generalized workflow platform, authentication system, or industrial governance mechanism unless the repository authority is deliberately changed first.

## Next Product Milestone

Use the current generated ChatGPT Project pack and execute the first real Elementor Builder session. Record exact UI evidence, Action results, Checkpoints, and observed blockers. That evidence may improve Builder guidance, but it still cannot independently claim Responsive or production readiness.
