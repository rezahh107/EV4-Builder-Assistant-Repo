# core/MODE_STATE_MATRIX

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
industrial_governance: removed_from_active_system
security_posture: minimal_nonblocking
production_ready: false
canonical_transition_table: runtime/state-transitions.v1.json
canonical_transition_engine: scripts/lib/runtime-transaction-engine.mjs
```

This document is an operator summary, not a second transition specification. Legal mode/state combinations, transition sources, targets and guards are defined only in `runtime/state-transitions.v1.json` and executed only by the Canonical Runtime Transaction Engine.

## Operational Invariants

- `builder-input.json` is canonical; an intake Capsule is derived evidence.
- `شروع` initializes only when no Run exists; repeated `شروع` preserves the same Run.
- `استارت` resumes only from a valid `PAUSED` predecessor and cannot target `COMPLETED`.
- Completion starts only from `APPROVED_HANDOFF_MODE / BUILD_ACTIVE`.
- The caller never supplies authoritative `COMPLETED` carriers; the Engine generates them.
- Checkpoint sequence and parent identity must remain continuous.
- The Action Ledger defines the complete expected Action universe and must reconcile exactly with Checkpoint summaries.
- Completion Scope and Completion Gate must bind to the active Runtime Transaction.
- unresolved blockers cannot disappear.
- transition outputs publish atomically or not at all.
- Builder completion does not imply Responsive completion or production readiness.

```yaml
responsive_complete: false
production_ready: false
```

Validators derive legal combinations from the canonical JSON table. A hard-coded `ALLOWED_BY_MODE` map or a prose table that competes with that authority is forbidden.
