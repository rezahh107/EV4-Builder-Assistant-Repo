# Builder Functional Truth Spine

```yaml
repository_profile: personal_single_operator
fixture_validation_is_real_completion: false
real_completion_requires_explicit_source_mode: true
real_completion_requires_deterministic_content_binding: true
origin_identity_independently_verified: false
canonical_confirmation_transaction_enabled: true
verified_evidence_status_required: true
action_specific_execution_evidence_required: true
responsive_complete: false
production_ready: false
```

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

## Source Modes and Arguments

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

Runtime invocation selects the mode. Unused paths are rejected. Completion rereads consumed files, reruns mode-specific derivation and Builder validators, recomputes hashes/Candidate/Batch/Action digests, and compares the fresh Context with the stored Context. Content binding never claims independent origin verification.

## Canonical Confirmation Transaction

```text
BUILD_ACTIVE
→ emit-batch
→ WAITING_FOR_CONFIRMATION
→ confirm-batch
→ BUILD_ACTIVE
```

`confirm-batch` accepts only matching `APPROVED_HANDOFF_MODE / WAITING_FOR_CONFIRMATION` Session and Checkpoint carriers where:

```text
checkpoint.batch_id == context.action_batch.batch_id
checkpoint.confirmed_action_ids == []
checkpoint.unconfirmed_action_ids == complete context Action set
```

The exact operator token is required. Runtime derives the resulting Checkpoint and Session, increments sequence, sets parent to the predecessor Checkpoint, moves the complete Action set to confirmed, and atomically publishes:

```text
confirmation-receipt.json
checkpoint.json
session-state.json
confirmation-result.json
```

The Receipt binds the resulting Checkpoint ID, sequence and parent plus Session, Package, Candidate, Context, Batch, Action IDs, Action body digests and token. Failure publishes nothing.

## Canonical Checkpoint Sequence

```text
sequence == 1  => parent_checkpoint_id == null
sequence > 1   => parent_checkpoint_id is a non-empty string
```

`scripts/lib/checkpoint-sequence.mjs` is the canonical exported predicate used by Confirmation, real Completion and active Resume.

## Strict Confirmation Binding at Completion

```text
checkpoint.batch_id
== confirmation_receipt.batch_id
== context.action_batch.batch_id
```

Receipt `selected_candidate_id`, `confirmation_id`, current confirmed Checkpoint ID/sequence/parent, Action IDs and Action body digests must match the fresh Context and current Checkpoint.

## Verified Evidence

Evidence enters the verified set only when:

```text
source.status == "verified"
```

Missing, null, failed, unverified, pending, unknown and non-string values are rejected and contribute no claim or Action coverage.

For `required_action_execution`:

```text
source.action_id is in context.action_batch.action_ids
assertion.subject_ref == source.action_id
source.subject_ref == source.action_id
record supports the exact assertion
source binds the exact assertion
```

Generic `builder-output` subjects cannot prove Action execution.

## Completion and Aliases

`real-completion` is the real command. `intake` and `completion` are fixture/compatibility-only aliases. Real Completion derives Status and Gate and atomically publishes terminal carriers only after all bindings and Evidence checks pass.

No signature, PKI, secret, GitHub provenance check, remote attestation, service, database, event bus, Builder → Responsive implementation or production-readiness claim is part of this Runtime.
