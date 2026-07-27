# core/MODE_STATE_MATRIX

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
canonical_input_schema: ev4-builder-context-package@1.0.0
canonical_input_filename_hint: builder-input.json
canonical_transition_table: runtime/state-transitions.v1.json
active_runtime_module: scripts/lib/runtime/canonical-run-runtime.mjs
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

This is an operator summary, not a competing State Machine.

```text
stable Run root
→ generations/000001 BUILD_ACTIVE
→ CURRENT.json
→ .mutation-lock
→ emit-batch
→ immutable WAITING_FOR_CONFIRMATION generation
→ CURRENT.json
→ confirm-batch
→ immutable BUILD_ACTIVE generation
→ attach-evidence generations
→ real-completion
→ immutable COMPLETED generation
→ CURRENT.json
```

Operational invariants:

- `CURRENT.json` is the sole active generation selector;
- State is loaded only after `.mutation-lock` is acquired;
- lock contention returns `RUN_BUSY_OR_STALE_LOCK` and changes no State;
- published generations are immutable and complete;
- Action emission requires full internal-source rederivation and zero blockers;
- Confirmation requires exact WAITING generation, Batch, Action digests and token;
- Evidence attachment requires exact verified status and Action-specific binding;
- Completion requires canonical Confirmation, complete internal Evidence, zero blockers and Runtime-derived Status/Gate;
- orphan generations remain non-authoritative;
- compatibility Resume and fixture Completion have no real Run authority;
- Responsive completion and production readiness remain false.

Bootstrap compatibility: `شروع` routes to explicit Intake; `استارت` is compatibility Resume. Canonical input hint: `builder-input.json`; canonical input Schema: `ev4-builder-context-package@1.0.0`.
