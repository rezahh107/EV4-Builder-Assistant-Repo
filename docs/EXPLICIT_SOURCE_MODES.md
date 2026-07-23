# Explicit Source Modes and Deterministic Content Binding

```yaml
repository_profile: personal_single_operator
fixture_validation_is_real_completion: false
real_completion_requires_explicit_source_mode: true
real_completion_requires_deterministic_content_binding: true
origin_identity_independently_verified: false
manual_builder_input_mode_enabled: true
completion_status_runtime_derived: true
completion_gate_runtime_derived: true
production_ready: false
```

## Functional invariant

```text
The Runtime executes the exact operator-selected source bytes,
derives authoritative Runtime facts from those bytes,
and does not represent content consistency as independently verified origin.
```

The source mode is selected only by Runtime invocation:

```text
project-gate
direct-ce
manual-builder-input
```

A JSON field cannot select, promote or change source mode.

## Project Gate mode

Inputs:

```text
project-gate-c2b-receipt.json
builder-input.json
```

Runtime behavior:

1. read exact Builder Input bytes;
2. run Builder Schema, semantic, cross-field and lineage validators;
3. recompute Builder Input SHA-256;
4. recompute canonical package digest;
5. compare both values with the Receipt;
6. derive Candidate, Batch, Action IDs and Action body digests from actual Builder Input content;
7. build deterministic Runtime Context.

The Receipt is a content-binding cross-check only.

These fields, when present, are non-authoritative metadata:

```text
producer_repository
producer_commit_sha
producer_artifact_id
repository identity
remote origin metadata
```

They do not authorize or block a Run.

Runtime Context semantics:

```yaml
source_mode: project-gate
source_selection: operator_explicit
content_binding_status: verified
origin_assurance: not_independently_verified
receipt_binding_status: matched
```

## Direct CE mode

Inputs:

```text
ce-source-wrapper.json
```

The wrapper contains the actual `ce_builder_executable_package` plus its declared canonical content digest.

Runtime behavior:

1. read actual CE package content;
2. recompute and compare the declared content digest;
3. run the repository-owned CE Contract Gate;
4. run the repository-owned CE adapter;
5. derive Builder package bytes internally;
6. run all Builder validators;
7. derive deterministic Runtime Context.

Runtime Context semantics:

```yaml
source_mode: direct-ce
source_selection: operator_explicit
content_binding_status: verified
origin_assurance: not_independently_verified
receipt_binding_status: not_applicable
```

External CE attestation and producer authentication are not required.

## Manual Builder Input mode

Inputs:

```text
builder-input.json
```

This mode is valid only when explicitly selected in Runtime invocation.

Runtime behavior:

1. read exact operator-selected Builder Input bytes;
2. run the same Builder validators used by Project Gate mode;
3. compute the same source SHA-256 and canonical package digest;
4. derive the same Candidate, Batch, Action IDs and Action body digests;
5. preserve the same Session, Confirmation, Evidence and Completion rules.

Runtime Context semantics:

```yaml
source_mode: manual-builder-input
source_selection: operator_explicit
content_binding_status: verified
origin_assurance: manual_operator_supplied
receipt_binding_status: not_applicable
```

Manual mode never claims Project Gate or CE origin.

## Runtime Context

The Context is deterministic and contains content-derived facts, not origin authentication claims.

Core fields:

```yaml
schema: ev4-builder-verified-context@1.0.0
runtime_mode: real-builder-run
source_mode:
source_selection: operator_explicit
content_binding_status: verified
origin_assurance:
receipt_binding_status:
selected_source_ref:
selected_source_sha256:
source_artifact_ref:
builder_input_ref:
builder_input_sha256:
canonical_package_digest:
selected_candidate_id:
builder_context_schema:
synthetic_derived: false
action_batch:
confirmation:
decision_lineage:
context_digest:
```

The legacy Schema identifier is retained for carrier compatibility. Its semantics are explicitly limited to deterministic content verification; it does not assert independent origin verification.

The active Runtime Context must not contain:

```text
verification_status: verified_source_bound
producer_repository
producer_commit_sha
producer_artifact_id
producer_artifact_sha256
```

## Completion re-derivation

Before real Completion, Runtime:

1. rereads selected source files;
2. reruns source-mode-specific derivation;
3. reruns all Builder validators;
4. recomputes source and Builder hashes;
5. recomputes canonical package digest;
6. rederives Candidate, Batch, Action IDs and Action body digests;
7. rebuilds the Runtime Context deterministically;
8. canonically compares fresh and stored Contexts;
9. rejects source-byte or Context drift.

Confirmation Receipt, Session, Checkpoint, Evidence and derived Completion rules run only after this comparison passes.

## Mutation coverage

`scripts/test-builder-explicit-source-modes.mjs` covers:

- invocation-only source selection;
- caller JSON attempting mode promotion;
- Project Gate Receipt paired with different Builder bytes;
- Project Gate package-digest mismatch;
- manual mode explicit acceptance;
- manual mode origin semantics;
- source-byte drift after intake;
- Context drift after intake;
- valid Project Gate preservation;
- valid direct CE preservation;
- valid manual preservation.

## Explicit exclusions

The Runtime does not add:

- GitHub API provenance checks;
- repository or commit allowlists;
- signed Receipts;
- PKI;
- secrets;
- external attestation;
- opaque capabilities;
- services;
- databases;
- event buses.
