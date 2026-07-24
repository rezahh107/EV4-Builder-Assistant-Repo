# Run State, Sequence, Blockers and Recovery

```yaml
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
responsive_complete: false
production_ready: false
```

The Atomic Run Bundle owns active Context, Session, Checkpoint and manifest pointers. Callers never select combinations of carriers.

Canonical Checkpoint predicate:

```text
sequence == 1  => parent_checkpoint_id == null
sequence > 1   => parent_checkpoint_id is a non-empty string
```

Session must embed the exact active Checkpoint. Manifest, Session, Checkpoint and Context must agree on State, Package, Candidate and Batch.

`collectActiveBlockers(session, checkpoint)` includes:

```text
session.unresolved_evidence
checkpoint.unresolved_blockers
assertions with status not_checked
assertions with status insufficient_evidence
```

The set is deduplicated deterministically. Blockers cannot disappear through carrier replacement and must remain continuous through Intake, emit-batch, confirm-batch, attach-evidence, compatibility Resume and real-completion.

Every transition uses a staged copy of the Run, validates all generated artifacts, then atomically replaces the active Run. Existing transition directories are not overwritten. Failed stages are removed. Active manifest pointers update only after validation. Repeated commands reject deterministically and cannot create competing Checkpoints.

`شروع` creates a new Run only when none exists. `استارت` remains PAUSED-only compatibility Resume and cannot fabricate initialization. Real commands after Intake accept only the Run directory.
