# Internal Evidence and Atomic Completion

```yaml
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
responsive_complete: false
production_ready: false
```

```bash
node scripts/builder-inspector.mjs attach-evidence <run-directory> <evidence-source.json>
```

Evidence attachment reads external bytes once, copies them under `evidence/`, computes SHA-256 and requires exact `source.status == "verified"`. It validates Schema, Evidence type, Session, Package, claim IDs/classes and subject and atomically updates Session, Checkpoint, manifest and attachment result.

For `required_action_execution`:

```text
source.action_id is an active Action ID
assertion.subject_ref == source.action_id
source.subject_ref == source.action_id
record supports the exact assertion
source binds the exact assertion
```

Generic `builder-output` does not prove Action execution. Completion reads only internal Evidence snapshots and rejects snapshot-byte or ledger drift.

```bash
node scripts/builder-inspector.mjs real-completion <run-directory>
```

Before Completion, Runtime validates manifest and snapshot SHA, fully rederives Context, compares Package, Candidate, Batch, Action IDs/digests and Confirmation binding, validates active Session/Checkpoint and sequence, verifies canonical Confirmation, exact confirmed Batch, all internal Evidence, every required Action and Completion claim, and zero active blockers.

Runtime derives Completion Status, Completion Gate, terminal Session and terminal Checkpoint and atomically publishes transition and output artifacts. Caller-authored Status or Gate booleans are not consumed.

```yaml
runtime_state: COMPLETED
builder_build_complete: true
responsive_complete: false
production_ready: false
```

Failed Completion leaves the active Run unchanged. Existing Completion transition directories are never overwritten and repeated Completion cannot create competing terminal Checkpoints.
