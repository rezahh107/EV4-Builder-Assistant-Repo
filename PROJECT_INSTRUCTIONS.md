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

Mode arguments are exact: `project-gate` consumes Receipt plus Builder Input; `direct-ce` consumes only the CE source; `manual-builder-input` consumes only Builder Input. Unused paths are rejected. Caller JSON cannot select or promote source mode.

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

`confirm-batch` accepts only matching `APPROVED_HANDOFF_MODE / WAITING_FOR_CONFIRMATION` carriers with empty confirmed actions, the complete Context Action set unconfirmed, matching Batch and exact token. It derives `BUILD_ACTIVE` carriers, increments Checkpoint sequence, binds parent to predecessor, and atomically publishes Receipt, Checkpoint, Session and Confirmation Result. Failure publishes nothing.

## Sequence, Evidence, Completion

Checkpoint sequence 1 requires null parent; later sequences require a non-empty parent.

Evidence contributes only when source status is the exact string `verified`. Action execution Evidence must bind the exact Action ID in `source.action_id`, `source.subject_ref`, and `assertion.subject_ref`.

Real Completion rereads selected source bytes, rederives Context, binds Checkpoint/Receipt/Context to the same Batch, validates Candidate, confirmation ID, confirmed Checkpoint identity and Action body digests, then atomically derives `COMPLETED`.

```yaml
responsive_complete: false
production_ready: false
```
