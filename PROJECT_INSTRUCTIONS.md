# PROJECT_INSTRUCTIONS — EV4 Builder Assistant

Version: 0.3.6

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
industrial_governance: removed_from_active_system
security_posture: minimal_nonblocking
independent_review_required: false
pr_inspector_required: false
exact_head_runtime_authority: false
builder_to_responsive: out_of_scope
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
responsive_complete: false
production_ready: false
```

## Role

Act as the interactive Elementor Builder companion. Preserve the exact `selected_candidate_id`, decision lineage, permitted Action semantics, rendered text, Golden Reference, Build Intent Brief and تصویر ذهنی. Builder must not invent or paraphrase locked design intent.

Canonical Builder content uses `ev4-builder-context-package@1.0.0`; `builder-input.json` is only a conventional filename. `شروع` creates a new Run only when no active Run exists. `استارت` is PAUSED-only compatibility Resume and cannot fabricate State.

## Canonical Runtime

The only real implementation is a Runtime-owned **Atomic Run Bundle** with an **internal source snapshot**:

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

The Run directory is the sole operational API after Intake. Original external source paths are not read again; changed input requires a new Run.

## Commands

```bash
node scripts/builder-inspector.mjs real-intake <project-gate|direct-ce|manual-builder-input> <source-artifact.json|-> <builder-input.json|-> <run-directory>
node scripts/builder-inspector.mjs emit-batch <run-directory>
node scripts/builder-inspector.mjs confirm-batch <run-directory> "<operator-token>"
node scripts/builder-inspector.mjs attach-evidence <run-directory> <evidence-source.json>
node scripts/builder-inspector.mjs real-completion <run-directory>
```

Mode arguments:

```yaml
project-gate:
  sourceArtifactFile: required
  builderInputFile: required
direct-ce:
  sourceArtifactFile: required
  builderInputFile: forbidden
manual-builder-input:
  sourceArtifactFile: forbidden
  builderInputFile: required
```

`intake` and `completion` remain fixture/compatibility-only aliases.

## Atomic Intake

`real-intake` copies exact source bytes into `source/selected-source.json`; Project Gate mode also snapshots `source/project-gate-receipt.json`. Runtime derives `run_id`, `session_id`, Context, initial Checkpoint, Session, manifest and Intake Result together. Initial Checkpoint is `APPROVED_HANDOFF_MODE / BUILD_ACTIVE`, sequence 1, null parent, no confirmed Actions and the complete Action set unconfirmed. No partial Run may exist after failure.

## Emit and Blockers

Before `emit-batch`, Runtime verifies the manifest and snapshot hash, reruns mode-specific derivation and Builder validation, rebuilds Context and compares Candidate, Package, Batch, Action IDs, Action-body digests and Confirmation binding. `collectActiveBlockers(session, checkpoint)` includes Session unresolved Evidence, Checkpoint blockers and unresolved assertions. Any blocker prevents Action emission.

A valid emit transition atomically creates the exact `WAITING_FOR_CONFIRMATION` Session, Checkpoint and result and updates manifest pointers only after validation.

## Confirmation

Confirmation does not reread external sources. It reconciles the internal snapshot hash, stored Context digest, exact emit result, WAITING Checkpoint, Session, Batch, Actions, Action digests, token and blockers. It atomically derives the `BUILD_ACTIVE` Session/Checkpoint, Confirmation Receipt and Result. Caller-authored Receipt or confirmed arrays have no authority.

## Evidence

`attach-evidence` reads external Evidence once, requires exact `source.status == "verified"`, validates Session, Package, claim, subject and Action binding, then byte-preserves it inside the Run. Completion reads only internal Evidence snapshots. Generic `builder-output` cannot prove `required_action_execution`; Action-specific `action_id`, assertion subject and source subject must match.

## Completion

`real-completion` performs full derivation from the internal source snapshot, validates the active Session and Checkpoint, canonical sequence, Confirmation, exact confirmed Batch, Action IDs and digests, internal Evidence, every required Action and Completion claim, and zero blockers. Runtime—not the caller—derives Completion Status, Gate, terminal Session and terminal Checkpoint and publishes them atomically.

```yaml
runtime_state: COMPLETED
builder_build_complete: true
responsive_complete: false
production_ready: false
```

No signature, PKI, secret, producer authentication, repository identity verification, remote attestation, database, service layer, event bus or generalized workflow platform is part of this Runtime.
