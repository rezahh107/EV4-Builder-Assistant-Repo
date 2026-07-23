# core/MODE_STATE_MATRIX

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
canonical_input_schema: ev4-builder-context-package@1.0.0
canonical_input_filename_hint: builder-input.json
canonical_transition_table: runtime/state-transitions.v1.json
canonical_checkpoint_sequence_predicate: scripts/lib/checkpoint-sequence.mjs
active_runtime_module: scripts/lib/builder-functional-correctness.mjs
production_ready: false
```

This is an operator summary, not a competing state machine.

Bootstrap triggers:

- `شروع` creates fresh intake only when no active Run exists and preserves an existing initialized Run when repeated.
- `استارت` resumes only from a valid `PAUSED` state and cannot fabricate a Run.

```text
explicit operator source mode
→ real-intake
→ BUILD_ACTIVE
→ emit-batch
→ WAITING_FOR_CONFIRMATION
→ confirm-batch
→ BUILD_ACTIVE
→ verified Evidence
→ real-completion
→ COMPLETED
```

Operational invariants:

- explicit source mode and exact mode-specific arguments are mandatory;
- `intake` and `completion` are fixture/compatibility-only;
- Confirmation cannot start from BUILD_ACTIVE or pre-confirmed carriers;
- Confirmation outputs are derived and atomic;
- sequence 1 requires null parent; later sequences require a non-empty parent;
- Completion starts only from confirmed `APPROVED_HANDOFF_MODE / BUILD_ACTIVE`;
- Checkpoint, Receipt and Context bind the same Batch;
- Receipt binds the current confirmed Checkpoint identity and sequence;
- Evidence source status must equal `verified`;
- required Action execution Evidence is Action-specific;
- unresolved blockers cannot disappear;
- terminal carriers are derived and atomically published;
- `responsive_complete: false`;
- `production_ready: false`.
