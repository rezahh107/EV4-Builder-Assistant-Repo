# STATUS — EV4 Builder Assistant Repo

Version: 0.3.6
Status: active_on_main
Date: 2026-07-27

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
active_branch: main
merged_pull_request: 66
merged_pr_head: e3eb26277a5e49a68c3b6a9ed452d5c794f2f13f
merge_commit: 05db0e210220a60c85d1faca073642da57941970
repair_state: merged_active_on_main
documentation_state: synchronized_with_runtime_authority
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
run_root_replacement: forbidden
active_generation_mutation: forbidden
mutation_without_run_lock: forbidden
state_load_before_lock: forbidden
current_pointer_to_partial_generation: forbidden
lost_update: forbidden
responsive_complete: false
production_ready: false
merge_performed: true
deployment_performed: false
external_repositories_modified: false
independent_review_required: false
pr_inspector_required: false
exact_head_runtime_authority: false
```

## Active Runtime Architecture

```text
explicit operator source
→ stable Run root creation
→ byte-preserving internal source snapshot
→ immutable generations/000001
→ atomic CURRENT.json
→ acquire local .mutation-lock
→ load active generation after lock
→ full pre-emission derivation
→ immutable WAITING_FOR_CONFIRMATION generation
→ atomic CURRENT.json update
→ exact Confirmation reconciliation
→ immutable confirmed BUILD_ACTIVE generation
→ attach-evidence internal snapshots and generations
→ full Completion rederivation
→ immutable terminal generation
→ atomic CURRENT.json update
→ COMPLETED
```

`CURRENT.json` is the sole active State selector. Published generations are immutable. Every mutation acquires `.mutation-lock` before reading State. A future generation is not authority merely because it exists or has the highest number.

The same canonical transition may finalize only an exact byte-identical expected N+1, including all operation-specific artifacts. A different, incomplete, or ambiguous future generation blocks without changing authority. Repeating an exact transition after commit returns the committed result with `replayed_existing_transition: true` and creates no additional generation.

## Canonical Commands

```bash
node scripts/builder-inspector.mjs real-intake <project-gate|direct-ce|manual-builder-input> <source-artifact.json|-> <builder-input.json|-> <run-directory>
node scripts/builder-inspector.mjs emit-batch <run-directory>
node scripts/builder-inspector.mjs confirm-batch <run-directory> "<operator-token>"
node scripts/builder-inspector.mjs attach-evidence <run-directory> <evidence-source.json>
node scripts/builder-inspector.mjs real-completion <run-directory>
```

Compatibility operations and historical bypass records cannot mutate canonical Run State or claim Builder Completion. Active Legacy entrypoints return `BUILDER-LEGACY-AUTHORITY-INACTIVE`.

## Validation Evidence

The merged PR Head `e3eb26277a5e49a68c3b6a9ed452d5c794f2f13f` completed `Schema validation` run `30250938148` successfully before merge. The workflow used the canonical dynamic shard registry, exact-SHA checkout for every shard, and the required final `validate` aggregate.

This CI evidence is maintenance evidence. It is not Runtime authorization. Repository authority explicitly keeps `independent_review_required: false`, `pr_inspector_required: false`, and `exact_head_runtime_authority: false`.

## Remaining Product Boundary

The Runtime truth spine, concurrency protection, crash recovery, replay, deterministic completion, and canonical validation sharding are active on `main`. Real Elementor execution evidence, Responsive completion, Builder-to-Responsive delivery, deployment, and production readiness remain outside the proven scope.
