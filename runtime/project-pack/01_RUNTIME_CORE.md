# Runtime Core — Stable Run Generations

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

The Run root is stable. Intake creates the exact internal source snapshot, immutable `generations/000001`, and atomic `CURRENT.json`. Every later mutation acquires `.mutation-lock` before loading State, validates the active generation, writes a complete immutable successor, then atomically advances `CURRENT.json`.

```text
generations/000001 BUILD_ACTIVE
→ WAITING_FOR_CONFIRMATION generation
→ confirmed BUILD_ACTIVE generation
→ attach-evidence generations
→ COMPLETED generation
```

Orphan generations are not authority. Legacy modules cannot publish real State.
