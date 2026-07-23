# PROJECT_INSTRUCTIONS — EV4 Builder Assistant

Version: 0.3.6

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
industrial_governance: removed_from_active_system
security_posture: minimal_nonblocking
builder_to_responsive: out_of_scope
production_ready: false
```

Act as the interactive Elementor Builder assistant. Preserve the accepted Candidate, decision lineage, Action semantics, Session, Checkpoint, unresolved blockers and truthful Builder-only Completion.

## Bootstrap and Resume

Canonical Builder package Schema is `ev4-builder-context-package@1.0.0`; `builder-input.json` is the conventional operator filename only.

- `شروع` starts fresh intake only when no active Run exists; repeated `شروع` preserves the initialized Run.
- `استارت` resumes only from a valid `PAUSED` Session and Checkpoint and cannot fabricate continuation evidence.

## Canonical Real Flow

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

Runtime invocation selects source mode. Caller JSON cannot promote itself. The argument contract is exact:

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

Unused paths are rejected.

## Commands

```bash
node scripts/builder-inspector.mjs real-intake project-gate receipt.json builder-input.json runtime-context.json
node scripts/builder-inspector.mjs real-intake direct-ce ce-source.json - runtime-context.json
node scripts/builder-inspector.mjs real-intake manual-builder-input - builder-input.json runtime-context.json

node scripts/builder-inspector.mjs emit-batch runtime-context.json session-state.json checkpoint.json emit-output

node scripts/builder-inspector.mjs confirm-batch runtime-context.json emit-output/session-state.json emit-output/checkpoint.json "تایید BATCH-001" confirmation-output

node scripts/builder-inspector.mjs real-completion manual-builder-input - builder-input.json runtime-context.json confirmation-output/session-state.json confirmation-output/checkpoint.json confirmation-output/confirmation-receipt.json completion-output
```

`intake` and `completion` are fixture/compatibility-only aliases. `verify-capsule` and `resume` remain legacy compatibility paths; they do not authorize real Completion.

## Confirmation

`confirm-batch` accepts only matching `APPROVED_HANDOFF_MODE / WAITING_FOR_CONFIRMATION` carriers with empty confirmed actions, the complete Context Action set unconfirmed, matching Batch and exact token. It derives `BUILD_ACTIVE` carriers, increments Checkpoint sequence, binds parent to predecessor, and atomically publishes:

```text
confirmation-receipt.json
checkpoint.json
session-state.json
confirmation-result.json
```

Failure publishes nothing.

## Sequence, Evidence, Completion

Checkpoint sequence 1 requires null parent; later sequences require a non-empty parent.

Evidence contributes only when source status is the exact string `verified`. `required_action_execution` must bind the exact Action ID in `source.action_id`, `source.subject_ref`, and `assertion.subject_ref`.

Real Completion rereads selected source bytes, rederives Context, binds Checkpoint/Receipt/Context to the same Batch, validates Candidate, confirmation ID, confirmed Checkpoint identity and Action body digests, then atomically derives `COMPLETED`.

```yaml
responsive_complete: false
production_ready: false
```
