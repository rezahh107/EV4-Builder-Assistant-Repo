# STATUS — EV4 Builder Assistant Repo

Version: 0.3.6

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
pull_request: 66
feature_branch: fix/lean-builder-truth-spine
implementation_state: implemented_pending_rereview
runtime_owned_atomic_run_bundle: true
internal_source_snapshot: true
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
origin_identity_independently_verified: false
builder_to_responsive: out_of_scope
responsive_complete: false
production_ready: false
merge_performed: false
approval_performed: false
deployment_performed: false
external_repositories_modified: false
```

## Current architecture

The sole real Runtime path is the **Atomic Run Bundle** with an **internal source snapshot**:

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

Canonical Builder Schema is `ev4-builder-context-package@1.0.0`; `builder-input.json` is a filename hint. `شروع` creates fresh Intake only without an active Run; `استارت` remains PAUSED-only compatibility Resume.

## Implemented

- one Run directory owns source snapshots, Context, Session, Checkpoint, transition history, Evidence and outputs;
- `real-intake` generates `run_id`, `session_id`, initial Checkpoint and Session and publishes the complete Run atomically;
- original source paths are not consumed after Intake;
- Project Gate Receipt is internally snapshotted only for `project-gate`;
- full source-snapshot re-derivation precedes Action emission and Completion;
- shared deterministic blocker collection precedes emit, Confirmation and Completion;
- `emit-batch`, `confirm-batch`, `attach-evidence` and `real-completion` consume only the Run directory;
- Confirmation performs lightweight internal reconciliation and publishes Session, Checkpoint, Receipt and Result atomically;
- Evidence is byte-preserved inside the Run and requires exact `source.status == "verified"`;
- Action execution Evidence remains Action-specific;
- Completion validates exact Confirmation, Batch, Candidate, Action IDs, Action-body digests, internal Evidence and zero blockers;
- Completion Status and Gate are Runtime-derived;
- existing transition directories are never silently overwritten;
- failed staging leaves active manifest pointers unchanged;
- weak multi-file APIs return `BUILDER-LEGACY-AUTHORITY-INACTIVE` and cannot publish real State;
- strict generated-artifact Schemas and semantic validator are active;
- public end-to-end preservation covers `project-gate`, `direct-ce` and `manual-builder-input`.

## Real CLI

```bash
node scripts/builder-inspector.mjs real-intake <project-gate|direct-ce|manual-builder-input> <source-artifact.json|-> <builder-input.json|-> <run-directory>
node scripts/builder-inspector.mjs emit-batch <run-directory>
node scripts/builder-inspector.mjs confirm-batch <run-directory> "<operator-token>"
node scripts/builder-inspector.mjs attach-evidence <run-directory> <evidence-source.json>
node scripts/builder-inspector.mjs real-completion <run-directory>
```

`intake` and `completion` are fixture/compatibility-only aliases.

## Validation boundary

The branch must pass exact-head GitHub Actions with:

```bash
npm ci
npm run validate
node scripts/test-builder-atomic-run-bundle.mjs
node scripts/validate-canonical-run-artifacts.mjs
node scripts/validate-lean-runtime.mjs
node scripts/test-project-pack-determinism.mjs
```

CI is repository-maintenance evidence, not Runtime authorization. The resulting exact Head still requires fresh independent PR Inspector review. No finding is declared finally closed.

## Scope boundary

```yaml
runtime_state_after_truthful_completion: COMPLETED
builder_build_complete: true
responsive_complete: false
production_ready: false
```

Real Elementor execution remains an Owner Local Pilot. No signature, PKI, secret, GitHub provenance check, producer authentication, remote attestation, database, service layer or event bus was added.
