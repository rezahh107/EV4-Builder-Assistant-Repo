# EV4 Builder Assistant Repo

```yaml
version: 0.3.6
repository_profile: personal_single_operator
runtime_goal: functional_correctness
fixture_validation_is_real_completion: false
real_completion_requires_explicit_source_mode: true
real_completion_requires_deterministic_content_binding: true
origin_identity_independently_verified: false
manual_builder_input_mode_enabled: true
canonical_confirmation_transaction_enabled: true
verified_evidence_status_required: true
action_specific_execution_evidence_required: true
completion_status_runtime_derived: true
completion_gate_runtime_derived: true
builder_to_responsive: out_of_scope
responsive_complete: false
production_ready: false
```

Runtime executes the exact operator-selected source bytes and derives facts from those bytes. It does not claim independently verified producer or origin identity.

## Bootstrap and Resume

Canonical Builder package Schema is `ev4-builder-context-package@1.0.0`; `builder-input.json` is a conventional operator filename and does not create authority.

- `شروع` initializes a fresh intake only when no active Run exists; repeated `شروع` preserves initialized state.
- `استارت` resumes only from valid `PAUSED` Session and Checkpoint carriers and cannot fabricate a Run.

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

## Source Modes

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

Unused paths are rejected and cannot appear as consumed Context references.

## Confirmation

```bash
node scripts/builder-inspector.mjs emit-batch runtime-context.json session-state.json checkpoint.json emit-output
node scripts/builder-inspector.mjs confirm-batch runtime-context.json emit-output/session-state.json emit-output/checkpoint.json "تایید BATCH-001" confirmation-output
```

`confirm-batch` accepts only matching WAITING carriers, derives BUILD_ACTIVE carriers, advances Checkpoint sequence, moves the complete Action set to confirmed, and atomically publishes:

```text
confirmation-receipt.json
checkpoint.json
session-state.json
confirmation-result.json
```

Receipt binds the resulting Checkpoint ID/sequence/parent plus Session, Package, Candidate, Context, Batch, Action IDs, Action body digests and token.

## Sequence and Evidence

```text
sequence == 1 => parent_checkpoint_id == null
sequence > 1  => parent_checkpoint_id is a non-empty string
```

Evidence is verified only when `source.status == "verified"`. `required_action_execution` requires `source.action_id`, `source.subject_ref`, and `assertion.subject_ref` to bind the same active Action ID. Generic subjects do not prove Action execution.

## Completion

`real-completion` rereads selected source bytes, rederives Context, requires exact Batch/Receipt/Checkpoint/Candidate/confirmation bindings and verified Evidence, then atomically derives Builder Completion.

`intake` and `completion` are fixture/compatibility-only aliases and never set real Completion.

```bash
npm ci
npm run validate
```

Builder completion never implies Responsive completion or production readiness.
