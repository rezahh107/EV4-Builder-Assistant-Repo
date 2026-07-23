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

Runtime executes exact operator-selected bytes and derives Runtime facts from those bytes. It does not verify who created the artifact.

```yaml
project-gate:
  sourceArtifactFile: required
  builderInputFile: required
  origin_assurance: not_independently_verified
  receipt_binding_status: matched
direct-ce:
  sourceArtifactFile: required
  builderInputFile: forbidden
  origin_assurance: not_independently_verified
  receipt_binding_status: not_applicable
manual-builder-input:
  sourceArtifactFile: forbidden
  builderInputFile: required
  origin_assurance: manual_operator_supplied
  receipt_binding_status: not_applicable
```

Runtime invocation selects source mode; caller JSON cannot promote itself. Unused paths are rejected and are not recorded as consumed references.

Project Gate Receipt cross-checks exact Builder bytes and canonical package digest only. Direct CE validates the declared content digest, runs the repository-owned Contract Gate and adapter, then Builder validators. Manual mode runs the same Builder validators without claiming Project Gate or CE origin.

Before real Completion, Runtime rereads selected source files, rederives Builder Context, Candidate, Batch, Action IDs and Action body digests, and rejects source or Context drift.

The downstream real flow is:

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

`intake` and `completion` are fixture/compatibility-only aliases.

No GitHub provenance API, allowlist, signed Receipt, PKI, secret, remote attestation, opaque capability, service, database or event bus is used.
