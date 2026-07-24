# Action Batch and Confirmation Generations

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

`emit-batch` acquires `.mutation-lock`, reloads `CURRENT.json`, fully rederives Context from the internal snapshot, verifies zero blockers and publishes an immutable `WAITING_FOR_CONFIRMATION` generation. Only after generation validation does it atomically advance `CURRENT.json`.

`confirm-batch` reloads the exact WAITING generation after lock acquisition, validates emit result, Context, Package, Candidate, Batch, Action IDs/digests, token and blockers, then derives an immutable confirmed `BUILD_ACTIVE` generation plus Receipt/Result. Caller-authored Confirmation has no authority.

```text
generations/000001 → CURRENT.json → .mutation-lock → WAITING_FOR_CONFIRMATION → confirm-batch → BUILD_ACTIVE → attach-evidence → COMPLETED
```
