# Explicit Source Intake and Internal Snapshot

```yaml
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
responsive_complete: false
production_ready: false
```

`real-intake` is the sole real initialization transaction for the Atomic Run Bundle.

```bash
node scripts/builder-inspector.mjs real-intake <project-gate|direct-ce|manual-builder-input> <source-artifact.json|-> <builder-input.json|-> <run-directory>
```

```yaml
project-gate:
  sourceArtifactFile: required
  builderInputFile: required
  selected_snapshot: exact Builder Input bytes
  receipt_snapshot: exact Receipt bytes
direct-ce:
  sourceArtifactFile: required
  builderInputFile: forbidden
  selected_snapshot: exact CE wrapper bytes
manual-builder-input:
  sourceArtifactFile: forbidden
  builderInputFile: required
  selected_snapshot: exact Builder Input bytes
```

Runtime validates exact bytes, source-mode contracts, Builder Schema `ev4-builder-context-package@1.0.0`, semantic/cross-field rules, decision lineage, Candidate, Package, Batch, Action IDs/digests and Confirmation binding. It then generates Context, `run_id`, `session_id`, initial Checkpoint and Session together.

Initial Checkpoint:

```yaml
checkpoint_sequence: 1
parent_checkpoint_id: null
workflow_mode: APPROVED_HANDOFF_MODE
runtime_state: BUILD_ACTIVE
confirmed_action_ids: []
unconfirmed_action_ids: complete derived Action set
```

All applicable snapshots, `run-manifest.json`, `runtime-context.json`, `session-state.json`, `checkpoint.json` and `real-intake-result.json` publish atomically. Any failure leaves no Run directory. After success, original external source paths are never used again.
