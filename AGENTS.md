# AGENTS.md

## Repository Profile

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
industrial_governance: removed_from_active_system
security_posture: minimal_nonblocking
production_ready: false
```

Read `runtime/personal-runtime-authority.v1.json`, `runtime/state-transitions.v1.json`, `PROJECT_INSTRUCTIONS.md`, `core/MODE_STATE_MATRIX.md`, relevant Schemas/validators/tests, then `scripts/validate.mjs`.

## Bootstrap and Resume

Canonical Builder package Schema is `ev4-builder-context-package@1.0.0`; `builder-input.json` is the conventional operator filename, not an authority source.

- `شروع` initializes fresh intake only when no active Run exists; repeated `شروع` preserves the initialized Session, Checkpoint and unresolved blockers.
- `استارت` resumes only from valid `PAUSED` carriers and cannot fabricate a Run.

## Canonical Real Runtime

```text
explicit operator source mode
→ real-intake
→ Runtime Context
→ Action Batch
→ emit-batch
→ WAITING_FOR_CONFIRMATION
→ atomic confirm-batch transaction
→ BUILD_ACTIVE
→ verified Evidence
→ real-completion
→ COMPLETED
```

Source mode is selected only by Runtime invocation:

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

`intake` and `completion` are fixture/compatibility-only aliases and can never create real Completion.

## Functional Invariants

- `confirm-batch` accepts only matching `APPROVED_HANDOFF_MODE / WAITING_FOR_CONFIRMATION` Session and Checkpoint carriers.
- Confirmation predecessor has empty `confirmed_action_ids` and the complete Context Action set in `unconfirmed_action_ids`.
- Runtime derives the resulting `BUILD_ACTIVE` carriers and publishes Receipt, Checkpoint, Session and Result atomically.
- Receipt binds resulting Checkpoint ID, sequence and parent, Session, Package, Candidate, Context, Batch, Action IDs, Action body digests and token.
- Checkpoint sequence rule: sequence 1 has null parent; later sequences have a non-empty parent.
- Evidence is verified only when `source.status == "verified"`.
- `required_action_execution` requires Action-specific `assertion.subject_ref`, `source.subject_ref`, and `source.action_id`.
- Completion binds Checkpoint, Receipt and Context to the same Batch and current confirmed Checkpoint.
- Completion rereads selected source bytes and rederives Context before state transition.
- unresolved blockers cannot disappear.
- `responsive_complete: false` and `production_ready: false`.

Do not add signatures, PKI, secrets, GitHub provenance checks, remote attestations, opaque capabilities, services, databases, event buses, generalized workflow infrastructure, Builder → Responsive, deployment or production-readiness claims.

## Validation

```bash
npm ci
npm run validate
node scripts/test-builder-authority-bypasses.mjs
node scripts/test-builder-explicit-source-modes.mjs
node scripts/test-builder-truth-spine.mjs
node scripts/test-builder-functional-correctness.mjs
node scripts/validate-lean-runtime.mjs
node scripts/test-project-pack-determinism.mjs
```

Use one feature branch and focused PR. Do not merge or deploy without owner action. Do not claim validation without evidence.

The temporary UX/UI policy adapter remains supplemental and cannot override this Runtime authority or create Builder → Responsive behavior.
