# AGENTS.md

## Repository Profile

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
industrial_governance: removed_from_active_system
security_posture: minimal_nonblocking
production_ready: false
responsive_complete: false
```

Read `runtime/personal-runtime-authority.v1.json`, `runtime/state-transitions.v1.json`, `PROJECT_INSTRUCTIONS.md`, `core/MODE_STATE_MATRIX.md`, relevant Schemas/validators/tests, then `scripts/validate.mjs`.

## Bootstrap Boundary

Canonical Builder package Schema is `ev4-builder-context-package@1.0.0`; `builder-input.json` is a conventional operator filename, not authority.

- `شروع` begins fresh Intake only when no Run exists.
- repeated `شروع` preserves the active Run, Checkpoint and blockers.
- `استارت` remains PAUSED-only compatibility Resume and cannot fabricate a Run.

## Canonical Real Runtime

The sole real authority is the Runtime-owned **Atomic Run Bundle** with an **internal source snapshot**:

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

```yaml
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
responsive_complete: false
production_ready: false
```

## Real CLI

```bash
node scripts/builder-inspector.mjs real-intake <project-gate|direct-ce|manual-builder-input> <source-artifact.json|-> <builder-input.json|-> <run-directory>
node scripts/builder-inspector.mjs emit-batch <run-directory>
node scripts/builder-inspector.mjs confirm-batch <run-directory> "<operator-token>"
node scripts/builder-inspector.mjs attach-evidence <run-directory> <evidence-source.json>
node scripts/builder-inspector.mjs real-completion <run-directory>
```

Exact Intake inputs:

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

`intake` and `completion` aliases are fixture/compatibility-only and never create a real Run or Completion.

## Functional Invariants

- `real-intake` byte-preserves the selected source inside the Run and atomically derives Context, Session, Checkpoint and manifest.
- initial Checkpoint uses sequence `1`, null parent, `BUILD_ACTIVE`, empty confirmed Actions and the complete derived unconfirmed Action set.
- later commands read only the Run directory and internal snapshots.
- `collectActiveBlockers(session, checkpoint)` includes Session unresolved Evidence, Checkpoint blockers and unresolved assertions.
- `emit-batch` performs full source-snapshot re-derivation and requires zero blockers.
- `confirm-batch` accepts only the exact emitted `WAITING_FOR_CONFIRMATION` carriers and exact operator token.
- Confirmation atomically publishes `confirmation-receipt.json`, `confirmation-result.json`, `checkpoint.json` and `session-state.json` inside the Run.
- Evidence is copied into the Run and accepted only when `source.status == "verified"`.
- `required_action_execution` requires Action-specific `action_id`, `assertion.subject_ref` and `source.subject_ref`.
- Completion fully rederives Context from the internal source snapshot, reconciles exact Confirmation, Batch, Actions, digests, internal Evidence and blockers, then derives Status and Gate.
- Checkpoint sequence rule: sequence 1 has null parent; later sequences require a non-empty parent.
- failed transitions publish nothing and do not move active manifest pointers.
- Builder → Responsive, Responsive completion and production readiness remain out of scope.

Do not add signatures, PKI, secrets, GitHub provenance checks, remote attestations, opaque capabilities, services, databases, event buses, generalized workflow infrastructure, deployment or production-readiness claims.

## Validation

```bash
npm ci
npm run validate
node scripts/test-builder-authority-bypasses.mjs
node scripts/test-builder-explicit-source-modes.mjs
node scripts/test-builder-truth-spine.mjs
node scripts/test-builder-functional-correctness.mjs
node scripts/test-builder-atomic-run-bundle.mjs
node scripts/validate-lean-runtime.mjs
node scripts/validate-canonical-run-artifacts.mjs
node scripts/test-project-pack-determinism.mjs
```

Use this feature branch and PR #66. Do not merge, approve or deploy without fresh independent review. The temporary UX/UI policy adapter remains supplemental and cannot override this Runtime authority or create Builder → Responsive behavior.
