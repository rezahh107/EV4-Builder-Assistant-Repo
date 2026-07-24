# Builder Truth Spine — Atomic Run Bundle

```yaml
repository_profile: personal_single_operator
runtime_owned_atomic_run_bundle: true
internal_source_snapshot: true
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
origin_identity_independently_verified: false
responsive_complete: false
production_ready: false
```

The canonical implementation is `scripts/lib/runtime/canonical-run-runtime.mjs`. It alone may publish real Session, Checkpoint, Confirmation, Evidence or Completion State.

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

## Run ownership

`real-intake` byte-preserves selected source content, derives Context and generates `run_id`, `session_id`, initial Checkpoint and Session. Project Gate also snapshots its Receipt. Initial Checkpoint is sequence 1, null parent, `APPROVED_HANDOFF_MODE / BUILD_ACTIVE`, no confirmed Actions and the complete derived Action set unconfirmed.

`run-manifest.json` binds source snapshots, Context, active Session/Checkpoint, Package, Candidate, Batch, transitions, internal Evidence and outputs. It is a deterministic index, not origin attestation.

## Emit and blockers

Before `emit-batch`, Runtime verifies the internal snapshot SHA, reruns source-mode derivation and all Builder validators, rebuilds Context and compares Candidate, Package, Batch, Action IDs, Action-body digests and Confirmation binding.

`collectActiveBlockers(session, checkpoint)` includes Session unresolved Evidence, Checkpoint blockers and assertions marked `not_checked` or `insufficient_evidence`. Any blocker prevents Action emission.

Valid emit atomically creates the exact `WAITING_FOR_CONFIRMATION` Session, Checkpoint and Result and only then updates manifest pointers.

## Confirmation

`confirm-batch` reconciles manifest/snapshot hash, Context digest, emit result, exact WAITING Checkpoint, embedded Session, Batch, Action IDs/digests, exact token and zero blockers. It atomically derives `confirmation-receipt.json`, `confirmation-result.json`, `checkpoint.json` and `session-state.json`.

The Receipt binds Run, Context, Package, Candidate, Confirmation ID, operator token, Batch, exact Actions/digests and predecessor/resulting Checkpoints. It is never caller-authoritative.

## Internal Evidence

`attach-evidence` reads external Evidence once and byte-preserves it inside the Run. It requires exact `source.status == "verified"` and validates Schema, type, Session, Package, claims and subject.

For `required_action_execution`, `source.action_id`, `assertion.subject_ref` and `source.subject_ref` must be the same active Action ID. Generic `builder-output` cannot prove Action execution. Completion reads only internal Evidence snapshots.

## Completion

`real-completion` validates the manifest and internal snapshot, fully rederives Context, validates current State and canonical sequence, exact Confirmation/Batch/Actions/digests, all internal Evidence, every required Action and Completion claim, and zero blockers. Runtime derives terminal State, Completion Status and Gate atomically.

```yaml
runtime_state: COMPLETED
builder_build_complete: true
responsive_complete: false
production_ready: false
```

Transition directories are never overwritten; failed temporary publication is removed; active pointers update last; duplicate or repeated operations cannot create competing Checkpoints.

```bash
node scripts/builder-inspector.mjs real-intake <project-gate|direct-ce|manual-builder-input> <source-artifact.json|-> <builder-input.json|-> <run-directory>
node scripts/builder-inspector.mjs emit-batch <run-directory>
node scripts/builder-inspector.mjs confirm-batch <run-directory> "<operator-token>"
node scripts/builder-inspector.mjs attach-evidence <run-directory> <evidence-source.json>
node scripts/builder-inspector.mjs real-completion <run-directory>
```

`intake`, `completion`, old multi-carrier APIs and historical bypass reproductions are fixture/diagnostic-only.
