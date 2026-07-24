# Explicit Source Modes and Internal Run Snapshots

```yaml
repository_profile: personal_single_operator
explicit_source_mode_required: true
internal_source_snapshot: true
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
origin_identity_independently_verified: false
responsive_complete: false
production_ready: false
```

The operator selects exactly one mode at `real-intake` invocation. JSON content cannot promote or change its mode. Runtime copies exact selected bytes into the **Atomic Run Bundle** and all later operations use the **internal source snapshot** only.

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

## Mode arguments and snapshots

```yaml
project-gate:
  sourceArtifactFile: required
  builderInputFile: required
  source/selected-source.json: exact Builder Input bytes
  source/project-gate-receipt.json: exact Receipt bytes

direct-ce:
  sourceArtifactFile: required
  builderInputFile: forbidden
  source/selected-source.json: exact CE wrapper bytes
  source/project-gate-receipt.json: absent

manual-builder-input:
  sourceArtifactFile: forbidden
  builderInputFile: required
  source/selected-source.json: exact Builder Input bytes
  source/project-gate-receipt.json: absent
```

## Project Gate

Runtime validates exact Builder Input bytes, recomputes source SHA and canonical Package digest and matches both against the Receipt. Receipt metadata such as repository or commit identity is non-authoritative. The Receipt snapshot is a deterministic content-binding input, not origin authentication.

## Direct CE

Runtime reads the exact CE wrapper snapshot, verifies its declared content digest, runs the repository-owned CE Contract Gate and adapter, derives Builder content and runs all Builder validators. No unused Builder Input path is accepted.

## Manual Builder Input

Runtime reads the exact explicitly selected Builder Input snapshot and runs the same Builder Schema, semantic, cross-field, lineage, Candidate, Batch and Action derivation. It records `manual_operator_supplied` and never claims Project Gate or CE origin.

## Context semantics

Runtime Context is derived from internal snapshot content and binds:

```yaml
runtime_mode: real-builder-run
source_mode: project-gate | direct-ce | manual-builder-input
source_selection: operator_explicit
content_binding_status: verified
origin_assurance: not_independently_verified | manual_operator_supplied
receipt_binding_status: matched | not_applicable
selected_source_ref: <Run internal snapshot>
selected_source_sha256: <exact snapshot bytes>
canonical_package_digest: <derived digest>
selected_candidate_id: <derived Candidate>
action_batch: <derived Batch, Action IDs and Action-body digests>
confirmation: <derived Confirmation ID and token>
context_digest: <canonical Context digest>
```

Before `emit-batch` and `real-completion`, Context is fully rederived from the internal snapshot. Changing, moving or deleting original external files cannot change an existing Run. New content requires a new Run.

```bash
node scripts/builder-inspector.mjs real-intake <project-gate|direct-ce|manual-builder-input> <source-artifact.json|-> <builder-input.json|-> <run-directory>
node scripts/builder-inspector.mjs emit-batch <run-directory>
node scripts/builder-inspector.mjs confirm-batch <run-directory> "<operator-token>"
node scripts/builder-inspector.mjs attach-evidence <run-directory> <evidence-source.json>
node scripts/builder-inspector.mjs real-completion <run-directory>
```

`intake` and `completion` remain fixture/compatibility-only.
