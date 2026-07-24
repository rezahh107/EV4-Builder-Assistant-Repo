# EV4 Builder Assistant Repo

```yaml
version: 0.3.6
repository_profile: personal_single_operator
runtime_goal: functional_correctness
runtime_owned_atomic_run_bundle: true
internal_source_snapshot: true
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
origin_identity_independently_verified: false
builder_to_responsive: out_of_scope
responsive_complete: false
production_ready: false
```

This repository runs one personal, deterministic Builder workflow. It does not authenticate producers or remote origins. It executes the exact explicit operator-selected source bytes and owns all real Runtime State inside one **Atomic Run Bundle**.

Canonical Builder content uses `ev4-builder-context-package@1.0.0`; `builder-input.json` is a filename hint only. `شروع` begins a new Intake only when no active Run exists. `استارت` is PAUSED-only compatibility Resume.

## Canonical real flow

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

After Intake, only the Run directory is operational input. The original source may be moved, deleted or changed without changing the Run. New source content requires a new Run.

## CLI

```bash
node scripts/builder-inspector.mjs real-intake <project-gate|direct-ce|manual-builder-input> <source-artifact.json|-> <builder-input.json|-> <run-directory>
node scripts/builder-inspector.mjs emit-batch <run-directory>
node scripts/builder-inspector.mjs confirm-batch <run-directory> "<operator-token>"
node scripts/builder-inspector.mjs attach-evidence <run-directory> <evidence-source.json>
node scripts/builder-inspector.mjs real-completion <run-directory>
```

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

The aliases `intake` and `completion` are fixture/compatibility-only and cannot create a real Run or real Completion.

## Run Bundle

```text
runs/<RUN_ID>/
├── run-manifest.json
├── source/
│   ├── selected-source.json
│   └── project-gate-receipt.json   # project-gate only
├── runtime-context.json
├── session-state.json
├── checkpoint.json
├── real-intake-result.json
├── transitions/
│   ├── emit-batch/
│   ├── confirmation/
│   ├── evidence/
│   └── completion/
├── evidence/
└── outputs/
```

`run-manifest.json` is a deterministic Run index, not a security attestation. It binds source snapshots, Context, current State, current Checkpoint, Package, Candidate, Batch, transition results and internal Evidence.

## Functional correctness

- Intake atomically snapshots bytes and derives Context, Session and initial Checkpoint.
- initial Checkpoint is sequence 1 with null parent, `BUILD_ACTIVE`, zero confirmed Actions and the complete unconfirmed Action set.
- `emit-batch` fully rederives Context from the internal snapshot and requires zero active blockers.
- `confirm-batch` accepts only the exact emitted `WAITING_FOR_CONFIRMATION` State and exact operator token.
- Confirmation Receipt is Runtime-derived and binds Run, Context, Package, Candidate, Confirmation, Batch, Actions, digests and predecessor/resulting Checkpoints.
- `attach-evidence` snapshots exact Evidence bytes inside the Run and requires exact `source.status == "verified"`.
- `required_action_execution` requires Action-specific assertion/source subjects and `action_id`.
- Completion fully rederives Context from the internal snapshot, validates exact Confirmation/Batch/Actions/Evidence/blockers and derives Status and Gate.
- every transition publishes atomically; failed staging cannot move active manifest pointers.
- repeated operations do not overwrite existing transition directories or create competing active Checkpoints.

## Completion boundary

```yaml
runtime_state: COMPLETED
builder_build_complete: true
responsive_complete: false
production_ready: false
```

No signatures, PKI, secrets, repository provenance checks, producer authentication, remote attestations, databases, services, event buses or generalized workflow infrastructure are used.

## Validation

```bash
npm ci
npm run validate
node scripts/test-builder-atomic-run-bundle.mjs
node scripts/validate-canonical-run-artifacts.mjs
node scripts/validate-lean-runtime.mjs
node scripts/test-project-pack-determinism.mjs
```

The complete suite also preserves explicit source modes, previous truth-spine mutations, functional-correctness regressions, historical bypass reproductions and deterministic Project Pack generation.
