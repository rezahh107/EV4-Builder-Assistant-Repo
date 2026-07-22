# Runtime Core

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
industrial_governance: removed_from_active_system
security_posture: minimal_nonblocking
production_ready: false
canonical_engine: scripts/lib/runtime-transaction-engine.mjs
transition_authority: runtime/state-transitions.v1.json
```

Builder executes a selected and locked implementation. `builder-input.json` is canonical. The Intake Capsule is derived evidence only.

Critical Resume and Completion transitions are evaluated and applied only by the Canonical Runtime Transaction Engine. Validators inspect carrier integrity; they do not own a competing mode/state matrix.

Runtime authorities are limited to Builder Input validity, candidate and lineage continuity, Action Ledger reconciliation, confirmation binding, Session State and Checkpoint consistency, blocker preservation, Completion Scope, Completion Gate binding and atomic publication.
