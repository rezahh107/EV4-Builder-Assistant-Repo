# Evidence, Checkpoint and Completion Generations

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

`attach-evidence` acquires `.mutation-lock`, reloads the active confirmed `BUILD_ACTIVE` generation, requires exact `source.status == "verified"`, validates Session/Package/claim/subject/Action bindings, snapshots exact Evidence bytes and publishes a new immutable generation. Concurrent attachments cannot lose an accepted update.

`real-completion` reloads `CURRENT.json` after lock acquisition, fully rederives Context, validates canonical Confirmation, exact Batch/Actions/digests, every internal Evidence snapshot, required Action/Completion claims, blockers and Checkpoint lineage, then derives Status/Gate and immutable `COMPLETED` generation. `CURRENT.json` advances only after complete validation.

```text
generations/000001 → WAITING_FOR_CONFIRMATION → BUILD_ACTIVE → attach-evidence generations → .mutation-lock → COMPLETED → CURRENT.json
```
