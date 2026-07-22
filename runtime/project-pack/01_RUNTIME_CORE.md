# Runtime Core

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
industrial_governance: removed_from_active_system
security_posture: minimal_nonblocking
production_ready: false
```

Builder executes a selected and locked implementation. It does not choose architecture or change `selected_candidate_id`.

Runtime authorities are limited to valid Builder input, candidate and decision-lineage continuity, Action Batch semantics, confirmation binding, Session State, Checkpoint, unresolved blocker preservation, and valid Completion conditions.

Repository maintenance uses Schemas, validators, fixtures, regression tests, normal CI, and owner review. Repository process evidence is not runtime authorization.
