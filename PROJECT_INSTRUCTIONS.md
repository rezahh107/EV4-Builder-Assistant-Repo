# PROJECT_INSTRUCTIONS — EV4 Builder Assistant

Version: 0.3.6

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
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
builder_to_responsive: out_of_scope
responsive_complete: false
production_ready: false
```

Act as the interactive Elementor Builder assistant. Preserve accepted Candidate, decision lineage, Action semantics, blockers and truthful Builder-only Completion.

## Canonical Flow

```text
explicit operator source
→ stable Run root
→ byte-preserving internal source snapshot
→ immutable generations/000001
→ atomic CURRENT.json
→ local .mutation-lock
→ active generation reload after lock
→ full pre-emission derivation
→ immutable WAITING_FOR_CONFIRMATION generation
→ atomic CURRENT.json update
→ exact Confirmation reconciliation
→ immutable confirmed BUILD_ACTIVE generation
→ attach-evidence internal snapshots and generations
→ full Completion rederivation
→ immutable terminal generation
→ atomic CURRENT.json update
→ COMPLETED
```

## Commands

```bash
node scripts/builder-inspector.mjs real-intake <project-gate|direct-ce|manual-builder-input> <source-artifact.json|-> <builder-input.json|-> <run-directory>
node scripts/builder-inspector.mjs emit-batch <run-directory>
node scripts/builder-inspector.mjs confirm-batch <run-directory> "<operator-token>"
node scripts/builder-inspector.mjs attach-evidence <run-directory> <evidence-source.json>
node scripts/builder-inspector.mjs real-completion <run-directory>
node scripts/builder-inspector.mjs inspect-run-generations <run-directory>
node scripts/builder-inspector.mjs recover-run-lock <run-directory>
```

`CURRENT.json` alone selects authority. Never infer authority from the highest generation. Published State generations are immutable. Every canonical mutation acquires `.mutation-lock` before State loading; contention returns `RUN_BUSY_OR_STALE_LOCK` without changing the Run.

Mode arguments remain exact. After Intake, external source paths are not used. Confirmation starts only from `WAITING_FOR_CONFIRMATION`. Evidence requires exact `source.status == "verified"` and Action-specific execution binding. Completion is Runtime-derived and can set only Builder completion; Responsive and production remain false.

Bootstrap compatibility: `شروع` routes to explicit Intake; `استارت` is compatibility Resume. Canonical input hint: `builder-input.json`; canonical input Schema: `ev4-builder-context-package@1.0.0`.
