# State, CURRENT Pointer, Lock and Recovery

```yaml
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

`CURRENT.json` is the sole active generation selector. Canonical mutations create `.mutation-lock` before loading State, then read and validate the selected immutable generation. Contention returns `RUN_BUSY_OR_STALE_LOCK` without a State change. Locks never expire automatically; explicit `recover-run-lock` validates the active Run and rejects recovery when a temporary pointer exists.

```text
generations/000001
→ CURRENT.json
→ .mutation-lock
→ successor generation
→ atomic CURRENT.json update
→ WAITING_FOR_CONFIRMATION / BUILD_ACTIVE / attach-evidence / COMPLETED
```

`inspect-run-generations` reports active, valid orphan, invalid and temporary generations. It never promotes the highest generation. Legacy Resume is compatibility-only and cannot mutate canonical Run authority.
