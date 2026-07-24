# Explicit Source Modes and Internal Run Snapshots

```yaml
repository_profile: personal_single_operator
explicit_source_mode_required: true
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
run_root_replacement: forbidden
active_generation_mutation: forbidden
mutation_without_run_lock: forbidden
state_load_before_lock: forbidden
current_pointer_to_partial_generation: forbidden
lost_update: forbidden
responsive_complete: false
production_ready: false
```

## Exact Mode Arguments

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

`real-intake` reads the selected external bytes once, validates the source-mode contract, writes exact bytes under the stable Run root, derives Context/Session/Checkpoint and publishes immutable `generations/000001` plus atomic `CURRENT.json`. Only the process-owned sibling staging directory may be removed after Intake failure. An existing target Run is never deleted or overwritten.

After Intake, later commands use only internal snapshots. They acquire `.mutation-lock`, then load the generation selected by `CURRENT.json`. External source changes cannot affect the Run. A new source requires a new Run.

```text
explicit operator source
→ stable Run root
→ source/selected-source.json
→ optional source/project-gate-receipt.json
→ generations/000001
→ CURRENT.json
→ emit-batch
→ WAITING_FOR_CONFIRMATION
→ confirm-batch
→ BUILD_ACTIVE
→ attach-evidence
→ COMPLETED
```

Origin metadata remains descriptive and is not independently authenticated. No signatures, remote provenance, access-control capabilities or distributed coordination are introduced.
