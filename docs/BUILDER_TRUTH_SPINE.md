# Builder Truth Spine

## Scope

```yaml
repository_profile: personal_single_operator
functional_correctness: required
industrial_governance: not_runtime_required
fixture_validation_is_real_completion: false
real_completion_requires_source_bound_input: true
real_completion_requires_confirmation_receipt: true
real_completion_requires_verified_evidence_bytes: true
completion_status_runtime_derived: true
completion_gate_runtime_derived: true
responsive_complete: false
production_ready: false
```

This document defines the lean normal-path authority used by `scripts/builder-inspector.mjs`.

## Authority flow

```text
Upstream Source Artifact
→ Builder Source Resolver
→ Runtime-owned Verified Builder Context
→ Action Batch
→ Confirmation Receipt
→ Evidence Resolver
→ Derived Completion Status
→ Derived Completion Gate
→ COMPLETED
```

A structurally valid or internally consistent Builder Input is not a verified upstream package. Caller-authored confirmation, Evidence metadata, Completion booleans and proof states are not runtime truth.

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

The mode is selected by the command invocation. A JSON field cannot promote fixture execution into a real run.

### `real-builder-run`

Purpose:

- execute an authoritative source-bound Builder package;
- retain exact Session, Package, Candidate, Batch and Evidence continuity;
- derive real Builder Completion.

Real mode rejects nested fixture and synthetic indicators as contradictions.

## Source resolver

### Project Gate

Inputs:

```text
project-gate-c2b-receipt.json
builder-input.json
```

The Receipt must use:

```yaml
schema: ev4-project-gate-c2b-receipt@1.0.0
source_file_sha256: <sha256 of exact builder-input.json bytes>
canonical_package_digest: <Builder canonical package digest>
```

The resolver:

1. reads exact Builder Input bytes;
2. executes existing Builder Schema, cross-field and lineage validators;
3. recomputes byte SHA-256;
4. recomputes canonical package digest;
5. compares both values with the Project Gate Receipt;
6. rejects synthetic indicators;
7. creates the Runtime-owned Verified Builder Context.

The Receipt is binding metadata. It does not supply or repair semantic Builder fields.

### Direct CE

Input wrapper:

```json
{
  "content_sha256": "<canonical digest of ce_builder_executable_package>",
  "producer_repository": "...",
  "producer_commit_sha": "...",
  "producer_artifact_id": "...",
  "ce_builder_executable_package": {}
}
```

The resolver:

1. verifies `content_sha256`;
2. runs the repository-owned CE Contract Gate and adapter;
3. derives the Builder Context package;
4. validates the derived package;
5. creates the Runtime-owned Verified Builder Context.

No new external cross-repository contract is introduced.

## Verified Builder Context

Internal carrier:

```yaml
schema: ev4-builder-verified-context@1.0.0
runtime_mode: real-builder-run
source_kind: project-gate | direct-ce
source_file_sha256: ...
builder_input_sha256: ...
canonical_package_digest: ...
selected_candidate_id: ...
verification_status: verified_source_bound
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

The carrier is regenerated and compared with source facts before Completion. Hand-editing it cannot create authority.

Decision lineage is bound to `source_package_digest`. Manual entries remain `manual_attributed` and cannot authorize a new design decision.

## Confirmation Receipt

Command:

```bash
node scripts/builder-inspector.mjs \
  confirm-batch \
  verified-builder-context.json \
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

Validation fails when any Session, Package, Candidate, Context, Batch, Action ID, Action body digest or token differs.

`confirmed_action_ids` inside Checkpoint may mirror the Receipt for compatibility. It never replaces the Receipt.

## Evidence source contract

Every consequential Evidence Record in the Checkpoint must point to an actual JSON source file. The ledger keeps its existing Schema. The source content uses this minimal internal shape:

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

For Action execution Evidence, include:

```json
{
  "action_id": "BATCH-001-A01"
}
```

Normal Completion verifies:

- safe repository-relative path;
- source existence and readability;
- SHA-256 of actual bytes;
- declared/source Evidence type equality;
- assertion and claim ID binding;
- exact subject binding;
- exact Session and Package binding;
- exact Action binding where applicable;
- absence of synthetic or fixture indicators;
- claim and Evidence-type compatibility.

## Claim compatibility

```yaml
required_action_execution:
  evidence_types: [diagnostic]
scaffold_built:
  evidence_types: [diagnostic]
structure_built:
  evidence_types: [structure_panel_screenshot]
content_filled:
  evidence_types: [editor_screenshot]
desktop_layout_established:
  evidence_types: [frontend_screenshot]
layout_verified:
  evidence_types: [frontend_screenshot]
export_checked:
  evidence_types: [export_json]
export_verified:
  evidence_types: [export_json]
```

Explicitly compatible reuse:

- `desktop_layout_established` + `layout_verified`;
- `export_checked` + `export_verified`.

Other multi-claim reuse is rejected.

## Derived Completion Status

Runtime derives:

```yaml
scaffold_built: true
structure_built: true
content_filled: true
desktop_layout_established: true
export_checked: true
```

Inputs:

- verified required Action execution;
- validated Confirmation Receipt;
- verified Checkpoint assertions;
- compatible source-bound Evidence;
- zero unresolved blockers.

Caller-provided Completion Status files are not consumed by `real-completion`.

## Derived Completion Gate

Runtime derives proofs for:

```text
layout_verified
export_verified
```

Each proof records:

```yaml
claim_id: ...
subject_ref: ...
verification_method: source_bound_evidence
required_evidence_types: []
verified_evidence_refs: []
derived_status: confirmed | missing | unverified | incompatible_evidence | synthetic_evidence_forbidden
diagnostics: []
```

Caller-provided proof status is not consumed by `real-completion`.

## Atomic publication

Successful Completion publishes one directory containing:

```text
checkpoint.json
completion-gate.json
completion-result.json
completion-status.json
session-state.json
```

The staged output is validated before rename. Failure removes the temporary directory and leaves no final output.

## Validation

Focused:

```bash
node --check scripts/lib/builder-truth-spine.mjs
node --check scripts/builder-inspector.mjs
node --check scripts/test-builder-truth-spine.mjs
node scripts/test-builder-truth-spine.mjs
```

Full:

```bash
npm ci
npm run validate
```

The focused suite includes 54 one-predicate mutation and preservation tests covering source origin, mode separation, confirmation, Evidence verification, derived Completion, state continuity, Resume, atomic publication and prompt-injection regression.

## Remaining boundaries

This implementation does not establish:

- real Elementor execution by itself;
- Builder → Responsive transport;
- Responsive completion;
- production readiness;
- cryptographic assurance;
- multi-user authorization;
- an external Evidence service;
- a second state machine or completion evaluator.
