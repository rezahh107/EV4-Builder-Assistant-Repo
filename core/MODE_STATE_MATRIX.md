# core/MODE_STATE_MATRIX

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
canonical_input_schema: ev4-builder-context-package@1.0.0
canonical_input_filename_hint: builder-input.json
canonical_transition_table: runtime/state-transitions.v1.json
canonical_real_runtime_module: scripts/lib/runtime/canonical-run-runtime.mjs
runtime_owned_atomic_run_bundle: true
internal_source_snapshot: true
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
responsive_complete: false
production_ready: false
```

`شروع` creates fresh Intake only without an active Run. `استارت` is PAUSED-only compatibility Resume. The only real operational API after `real-intake` is the **Atomic Run Bundle** directory with its **internal source snapshot**.

## Canonical flow

```text
explicit operator source
→ atomic real-intake Run Bundle
→ internal source snapshot
→ Runtime-owned Session and Checkpoint
→ pre-emission full re-derivation
→ zero-blocker gate
→ atomic emit-batch
→ WAITING_FOR_CONFIRMATION
→ lightweight Confirmation reconciliation
→ atomic confirm-batch
→ BUILD_ACTIVE
→ internal Evidence snapshots through attach-evidence
→ full Completion re-derivation
→ atomic real-completion
→ COMPLETED
```

## Real transition matrix

| Command | Input authority | Required predecessor | Resulting State | Atomic outputs |
|---|---|---|---|---|
| `real-intake` | explicit source mode + exact source files + empty Run path | no Run | `BUILD_ACTIVE` | manifest, snapshots, Context, Session, Checkpoint, Intake Result |
| `emit-batch` | Run directory | `BUILD_ACTIVE`, fully rederived Context, zero blockers | `WAITING_FOR_CONFIRMATION` | transition Session, Checkpoint, Result + active pointers |
| `confirm-batch` | Run directory + exact token | exact emitted `WAITING_FOR_CONFIRMATION`, zero blockers | `BUILD_ACTIVE` | Session, Checkpoint, Receipt, Result + active pointers |
| `attach-evidence` | Run directory + one external Evidence source | confirmed `BUILD_ACTIVE` | `BUILD_ACTIVE` | internal Evidence snapshot, Session, Checkpoint, Result + pointers |
| `real-completion` | Run directory | confirmed `BUILD_ACTIVE`, complete internal Evidence, zero blockers | `COMPLETED` | Session, Checkpoint, Status, Gate, Result + pointers |

## Invariants

- Runtime generates `run_id`, `session_id`, initial Checkpoint ID and all initial State.
- initial sequence is `1` with `parent_checkpoint_id: null`; every later sequence requires a non-empty predecessor ID.
- source snapshot SHA and Context digest must match the manifest.
- Session embeds the exact current Checkpoint.
- Package, Candidate, Batch, Action IDs and Action-body digests remain continuous.
- before `emit-batch` and `real-completion`, Context is fully rederived from internal source bytes.
- Confirmation uses lightweight internal reconciliation and never caller-authored confirmed arrays or Receipt authority.
- Evidence status must be exact `verified`; Action execution Evidence must be Action-specific.
- active blockers include Session unresolved Evidence, Checkpoint blockers and unresolved assertions.
- transition directories cannot be overwritten; failed temporary directories are removed; manifest pointers update last.
- original external source and Evidence paths are never operational dependencies after snapshotting.
- `intake` and `completion` are fixture/compatibility-only aliases.

```yaml
truthful_terminal_state: COMPLETED
builder_build_complete: true
responsive_complete: false
production_ready: false
```
