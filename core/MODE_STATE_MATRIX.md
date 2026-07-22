# core/MODE_STATE_MATRIX

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
industrial_governance: removed_from_active_system
security_posture: minimal_nonblocking
production_ready: false
canonical_builder_input: builder-input.json
canonical_builder_input_schema: ev4-builder-context-package@1.0.0
canonical_transition_table: runtime/state-transitions.v1.json
shared_bounded_transition_module: scripts/lib/builder-runtime-transition.mjs
```

This document is an operator summary, not a second transition specification. Legal mode/state combinations and the active Resume/Completion transition entries are defined in `runtime/state-transitions.v1.json`. The shared module implements only those two critical paths and fails closed if their canonical definitions drift incompatibly.

## Operational Invariants

- `builder-input.json` parsed as `ev4-builder-context-package@1.0.0` is canonical; an Intake Capsule is derived evidence.
- Resume and Completion reverify actual Builder Input bytes, canonical package digest, candidate, lineage and authorization.
- `شروع` initializes only when no Run exists; repeated `شروع` preserves the same Run.
- `استارت` resumes only from a valid `PAUSED` predecessor and cannot target `COMPLETED`.
- Completion starts only from `APPROVED_HANDOFF_MODE / BUILD_ACTIVE`.
- Caller-authored `COMPLETED` Session State or Checkpoint carriers are rejected as transition inputs.
- The bounded module generates terminal carriers only after all Completion guards pass.
- Checkpoint sequence and parent identity must remain continuous.
- `builder-input.json:first_builder_batch.actions` is the complete expected Action universe for the active bounded Run.
- Checkpoint Action summaries must reconcile exactly with expected Action IDs; omission cannot satisfy Completion.
- Completion Status directly enforces the active desktop Builder scope; no Completion Scope Registry is active.
- Completion Gate binds candidate, package digest, session ID, predecessor Checkpoint identity and retained evidence.
- unresolved blockers cannot disappear.
- transition outputs publish atomically or not at all.
- Builder completion does not imply Responsive completion or production readiness.

```yaml
responsive_complete: false
production_ready: false
```

Validators may defensively check carrier integrity, but they must not authorize a transition that contradicts `runtime/state-transitions.v1.json`. A hard-coded `ALLOWED_BY_MODE` map that competes with the canonical JSON table is forbidden.
