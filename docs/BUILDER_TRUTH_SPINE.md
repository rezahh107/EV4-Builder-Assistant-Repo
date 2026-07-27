# Builder Truth Spine — Stable Run Generations

```yaml
repository_profile: personal_single_operator
runtime_owned_atomic_run_bundle: true
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
```

## Authoritative Storage

```text
<run-directory>/
├── source/
├── evidence/
├── generations/000001/
│   ├── run-manifest.json
│   ├── runtime-context.json
│   ├── session-state.json
│   └── checkpoint.json
├── generations/000002/...
├── transitions/
├── outputs/
├── CURRENT.json
└── .mutation-lock/
```

The Run root remains stable. Published generations are immutable. `CURRENT.json` is the sole active State selector and is replaced atomically only after the complete successor generation validates. A crash before the pointer rename leaves the predecessor active; a crash after it leaves the complete successor active. Unselected generations are orphans, not authority.

## Canonical Transaction

```text
acquire .mutation-lock
→ load CURRENT.json
→ validate active generation
→ derive the exact expected successor and all auxiliary artifacts
→ inspect future generation state
→ publish a new complete successor or reconcile exact N+1
→ atomically replace CURRENT.json
→ validate the newly active Run
→ release lock in finally
```

### Interrupted publication

The numerically highest or merely Schema-valid generation is never promoted. When exactly one adjacent N+1 exists, the same canonical transition rederives its expected successor from the active predecessor and exact command arguments. Reconciliation compares the final bytes of `runtime-context.json`, `session-state.json`, `checkpoint.json`, `run-manifest.json` and every operation-specific artifact. Only an exact match may advance `CURRENT.json`; the published generation and artifacts are not rewritten.

A different N+1 returns `RUN_UNCOMMITTED_SUCCESSOR_CONFLICT`. An incomplete or corrupt N+1 returns `RUN_UNCOMMITTED_SUCCESSOR_INCOMPLETE`. Multiple or non-adjacent future generations return `RUN_AMBIGUOUS_FUTURE_GENERATIONS`. All cases leave `CURRENT.json` unchanged.

`recover-run-lock` removes only validated non-authoritative `.tmp-*` debris and the explicit stale lock. It does not promote, modify or delete a published orphan generation. The original canonical command must be rerun to reconcile commit intent.

### Post-commit replay

When `CURRENT.json` advanced but the process terminated before returning success, rerunning the exact command loads the active Manifest’s exact N-1 predecessor, validates its recorded Checkpoint binding, and runs the same pure operation planner used by normal publication. The expected-successor materializer then reconstructs the complete generation, Result, auxiliary artifacts and `CURRENT.json` bytes.

Replay succeeds only when every reconstructed byte equals the committed byte. It returns `replayed_existing_transition: true`, `publication_recovery: post_commit_replay`, `state_modified: false`, `generation_created: false`, `generation_reused: true` and `current_pointer_advanced: false`; no canonical artifact is rewritten.

Any generation, Result, Receipt, Evidence snapshot, Completion Status, Completion Gate or `CURRENT.json` mismatch returns `RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT` with one bounded mismatch location. The Runtime does not repair the committed transaction, select another predecessor, advance or roll back `CURRENT.json`, or create a replacement generation. A different Confirmation token is a replay conflict. Different Evidence bytes are a distinct Evidence command input and are never accepted as replay of the committed attachment.

The independent canonical Run validator uses the same planners and expected-successor materializer. It validates persisted replay inputs before reconstruction and rejects missing, malformed, Schema-invalid and Schema-valid-but-noncanonical committed artifacts.

The real flow is `real-intake → emit-batch → WAITING_FOR_CONFIRMATION → confirm-batch → BUILD_ACTIVE → attach-evidence → real-completion → COMPLETED`. Every transition preserves exact source, Context, Package, Candidate, Batch, Action ID/digest, Checkpoint lineage and blocker bindings.

Historical bypass records are inert records only. They import no active Runtime implementation and cannot mutate or complete a Run. Legacy truth-spine exports return `BUILDER-LEGACY-AUTHORITY-INACTIVE`; separate canonical regression tests prove all seven historical bypass classes remain rejected.
