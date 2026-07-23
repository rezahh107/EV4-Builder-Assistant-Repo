# Builder Truth Spine

## Scope

```yaml
repository_profile: personal_single_operator
functional_correctness: required
industrial_governance: not_runtime_required
fixture_validation_is_real_completion: false
real_completion_requires_explicit_source_mode: true
real_completion_requires_deterministic_content_binding: true
origin_identity_independently_verified: false
manual_builder_input_mode_enabled: true
real_completion_requires_confirmation_receipt: true
real_completion_requires_verified_evidence_bytes: true
completion_status_runtime_derived: true
completion_gate_runtime_derived: true
responsive_complete: false
production_ready: false
```

This document defines the lean normal-path controls used by `scripts/builder-inspector.mjs`.

The Runtime verifies selected content and deterministic derivation. It does not verify who created a source artifact.

## Runtime flow

```text
operator-explicit source mode
→ exact selected source bytes
→ source-mode-specific content checks
→ Builder validators
→ deterministic Runtime Context
→ Action Batch
→ Confirmation Receipt
→ Evidence Resolver
→ Derived Completion Status
→ Derived Completion Gate
→ COMPLETED
```

## Runtime modes

### `fixture-validation`

Purpose:

- contract regression;
- preview;
- diagnostics;
- migration inspection;
- synthetic business-rule testing.

Terminal meaning:

```yaml
synthetic_validation_passed: true
would_complete: true
builder_build_complete: false
runtime_state: NOT_A_REAL_RUN
```

### `real-builder-run`

Purpose:

- execute exact operator-selected content;
- retain Session, Package, Candidate, Batch and Evidence continuity;
- derive bounded Builder Completion.

Source mode is selected by Runtime invocation, not by JSON content.

## Explicit source modes

```text
project-gate
direct-ce
manual-builder-input
```

### Project Gate

Inputs:

```text
project-gate-c2b-receipt.json
builder-input.json
```

Required Receipt content:

```yaml
schema: ev4-project-gate-c2b-receipt@1.0.0
source_file_sha256: <sha256 of exact Builder Input bytes>
canonical_package_digest: <Builder canonical package digest>
```

The resolver:

1. reads exact Builder Input bytes;
2. runs Builder Schema, semantic, cross-field and lineage validators;
3. recomputes byte SHA-256;
4. recomputes canonical package digest;
5. compares both values with the Receipt;
6. derives Candidate, Batch and Action facts from actual Builder content;
7. creates deterministic Runtime Context.

The Receipt is a content-binding cross-check only. Producer repository, commit and artifact metadata do not authorize or block a Run.

### Direct CE

Input wrapper:

```json
{
  "content_sha256": "<canonical digest of ce_builder_executable_package>",
  "ce_builder_executable_package": {}
}
```

The resolver:

1. reads actual CE package content;
2. verifies the declared content digest;
3. runs the repository-owned CE Contract Gate;
4. runs the repository-owned adapter;
5. derives Builder package bytes internally;
6. runs all Builder validators;
7. creates deterministic Runtime Context.

Producer authentication and external attestation are not required.

### Manual Builder Input

Input:

```text
builder-input.json
```

The mode must be selected explicitly as `manual-builder-input`.

The resolver runs the same Builder validators and derives the same package digest, Candidate, Batch, Action IDs and Action body digests used by the other real source modes.

Manual mode records:

```yaml
origin_assurance: manual_operator_supplied
receipt_binding_status: not_applicable
```

It never claims Project Gate or CE origin.

## Runtime Context

Carrier:

```yaml
schema: ev4-builder-verified-context@1.0.0
runtime_mode: real-builder-run
source_mode: project-gate | direct-ce | manual-builder-input
source_selection: operator_explicit
content_binding_status: verified
origin_assurance: not_independently_verified | manual_operator_supplied
receipt_binding_status: matched | not_applicable
selected_source_ref: ...
selected_source_sha256: ...
source_artifact_ref: ... | null
builder_input_ref: ... | null
builder_input_sha256: ...
canonical_package_digest: ...
selected_candidate_id: ...
builder_context_schema: ...
synthetic_derived: false
action_batch:
  batch_id: ...
  action_ids: []
  action_digests: {}
confirmation:
  confirmation_id: ...
  expected_user_token: ...
decision_lineage: []
context_digest: ...
```

The legacy Schema identifier is retained for carrier compatibility. `verified` in that identifier refers only to deterministic content checks; it is not an origin-authentication claim.

The active Context must not contain:

```text
verification_status: verified_source_bound
producer_repository
producer_commit_sha
producer_artifact_id
producer_artifact_sha256
```

Before Completion, the Context is regenerated from selected source bytes and compared canonically. Hand-editing Context cannot create authority.

## Completion re-derivation

Before real Completion, Runtime:

1. rereads source files selected by invocation;
2. reruns source-mode-specific derivation;
3. reruns Builder validation;
4. recomputes source and Builder hashes;
5. recomputes canonical package digest;
6. rederives Candidate, Batch, Action IDs and Action body digests;
7. rebuilds Runtime Context;
8. compares fresh and stored Contexts;
9. rejects source-byte or Context drift.

Only then do Confirmation, Evidence and Completion checks run.

## Confirmation Receipt

Command:

```bash
node scripts/builder-inspector.mjs \
  confirm-batch \
  runtime-context.json \
  session-state.json \
  checkpoint.json \
  "تایید BATCH-001" \
  confirmation-receipt.json
```

Receipt fields:

```yaml
schema: ev4-builder-confirmation-receipt@1.0.0
runtime_mode: real-builder-run
confirmation_id: ...
session_id: ...
package_digest: ...
selected_candidate_id: ...
batch_id: ...
confirmed_action_ids: []
confirmed_action_digests: {}
user_token: ...
captured_at: ...
context_digest: ...
receipt_digest: ...
```

Validation fails when Session, Package, Candidate, Context, Batch, Action ID, Action body digest or token differs.

`confirmed_action_ids` inside Checkpoint may mirror the Receipt but never replaces it.

## Evidence source contract

Every consequential Evidence Record points to an actual JSON source file:

```json
{
  "schema": "ev4-builder-evidence-source@1.0.0",
  "evidence_type": "export_json",
  "claim_ids": ["ASSERT-EXPORT"],
  "claim_classes": ["export_checked", "export_verified"],
  "subject_ref": "builder-output",
  "session_id": "SESSION-001",
  "package_digest": "<exact digest>",
  "status": "verified"
}
```

For Action execution Evidence, include exact `action_id`.

Normal Completion verifies:

- safe repository-relative path;
- source existence and readability;
- SHA-256 of actual bytes;
- declared/source Evidence type equality;
- assertion and claim ID binding;
- subject, Session, Package and Action binding;
- absence of synthetic Evidence in real mode;
- claim and Evidence-type compatibility.

## Claim compatibility

```yaml
required_action_execution: [diagnostic]
scaffold_built: [diagnostic]
structure_built: [structure_panel_screenshot]
content_filled: [editor_screenshot]
desktop_layout_established: [frontend_screenshot]
layout_verified: [frontend_screenshot]
export_checked: [export_json]
export_verified: [export_json]
```

Compatible paired reuse:

- `desktop_layout_established` + `layout_verified`;
- `export_checked` + `export_verified`.

Other multi-claim reuse is rejected.

## Derived Completion

Runtime derives:

```yaml
scaffold_built: true
structure_built: true
content_filled: true
desktop_layout_established: true
export_checked: true
layout_verified: confirmed
export_verified: confirmed
```

Inputs:

- freshly rederived Runtime Context;
- verified required Action execution;
- validated Confirmation Receipt;
- verified Checkpoint assertions;
- compatible content-bound Evidence;
- zero unresolved blockers.

Caller-provided Completion Status and Gate files are not consumed by `real-completion`.

## Atomic publication

Successful Completion publishes:

```text
checkpoint.json
completion-gate.json
completion-result.json
completion-status.json
session-state.json
```

Staged output is validated before rename. Failure removes temporary output and leaves no final directory.

## Validation

```bash
node --check scripts/lib/builder-explicit-source-runtime.mjs
node scripts/test-builder-authority-bypasses.mjs
node scripts/test-builder-truth-spine.mjs
node scripts/test-builder-explicit-source-modes.mjs
npm run validate
```

## Explicit exclusions

No GitHub provenance API, repository allowlist, commit allowlist, signed Receipt, PKI, secret, external attestation, opaque capability, service, database or event bus is part of this Runtime.
