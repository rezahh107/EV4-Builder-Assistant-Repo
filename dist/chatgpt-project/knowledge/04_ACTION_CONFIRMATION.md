# Atomic Action Emission and Confirmation

```yaml
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
responsive_complete: false
production_ready: false
```

Before `emit-batch`, Runtime reads only the Atomic Run Bundle, verifies `run-manifest.json` and internal source hash, fully rederives Context, validates exact Package, Candidate, Batch, Action IDs, Action-body digests and Confirmation binding, validates current Session/Checkpoint and canonical sequence, and requires zero active blockers.

```bash
node scripts/builder-inspector.mjs emit-batch <run-directory>
```

A valid transition atomically publishes under `transitions/emit-batch/<TRANSITION_ID>/`:

```text
session-state.json
checkpoint.json
emit-batch-result.json
```

The resulting Checkpoint is `WAITING_FOR_CONFIRMATION`, sequence predecessor + 1, parent predecessor ID, empty confirmed Actions and the complete exact Action set unconfirmed. Manifest pointers update only after generated artifacts validate.

```bash
node scripts/builder-inspector.mjs confirm-batch <run-directory> "<operator-token>"
```

Confirmation performs lightweight internal reconciliation: snapshot SHA, Context digest, exact emit result, current WAITING Checkpoint, embedded Session, Batch, Action IDs/digests, empty confirmed set, complete unconfirmed set, exact token and zero blockers.

It atomically publishes:

```text
confirmation-receipt.json
confirmation-result.json
checkpoint.json
session-state.json
```

The resulting State is `BUILD_ACTIVE`. Receipt binds Run, Context, Package, Candidate, Confirmation ID, token, Batch, exact Actions/digests and predecessor/resulting Checkpoint ID, sequence and parent. Caller-authored Receipt or confirmed arrays are never authority. Failed publication preserves active Run pointers.
