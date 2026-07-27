# Intake Inspector — Source Snapshot and Generation 000001

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

`real-intake` validates exact `project-gate`, `direct-ce`, or `manual-builder-input` arguments, reads selected bytes once, creates a unique sibling stage, snapshots source bytes, derives Context/Session/Checkpoint, validates immutable `generations/000001`, writes `CURRENT.json`, and atomically publishes the stable Run root only if absent.

Concurrent Intake produces one accepted Run and one `RUN_ALREADY_EXISTS` or busy result. A failing process removes only its own stage. Later `emit-batch`, `WAITING_FOR_CONFIRMATION`, `confirm-batch`, `attach-evidence`, and `COMPLETED` transitions use internal snapshots under `.mutation-lock`.
