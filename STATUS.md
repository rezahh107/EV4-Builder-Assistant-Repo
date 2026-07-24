# STATUS — EV4 Builder Assistant Repo

Version: 0.3.6

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
pull_request: 66
feature_branch: fix/lean-builder-truth-spine
repair_state: implemented_pending_rereview
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
merge_performed: false
approval_performed: false
deployment_performed: false
external_repositories_modified: false
```

## Active Runtime Architecture

```text
explicit operator source
→ stable Run root creation
→ internal source snapshot
→ immutable generations/000001
→ atomic CURRENT.json
→ local .mutation-lock
→ State load after lock
→ immutable WAITING_FOR_CONFIRMATION generation
→ atomic CURRENT.json update
→ immutable confirmed BUILD_ACTIVE generation
→ attach-evidence generations
→ immutable terminal generation
→ atomic CURRENT.json update
→ COMPLETED
```

Implemented scope includes concurrent Intake protection, immediate `RUN_BUSY_OR_STALE_LOCK`, immutable complete State generations, atomic same-filesystem `CURRENT.json` replacement, exact expected-successor derivation, byte-level generation and auxiliary-artifact reconciliation, exact same-transition orphan finalization, post-commit replay, explicit conflict/ambiguity diagnostics, orphan generation inspection, bounded stale-lock/temp cleanup, independent publication validation, child-process concurrency tests, crash-boundary tests, inert historical bypass records and repository-wide Legacy authority rejection.

`CURRENT.json` remains the sole authority. No future generation is promoted by number or Schema validity alone. Exact N+1 may be finalized only by retrying the same canonical command with matching inputs; differing, incomplete or multiple future generations leave `CURRENT.json` unchanged. An exact already-committed transition replays its accepted result without producing another generation.

The canonical real commands remain `real-intake`, `emit-batch`, `confirm-batch`, `attach-evidence`, and `real-completion`. Compatibility operations cannot mutate canonical Run State or claim Builder Completion.

Exact-head GitHub Actions evidence must be regenerated after all code and documentation commits. A fresh independent review remains mandatory; no review finding is declared finally closed.
