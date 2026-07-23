# Runtime Core

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
production_ready: false
```

Canonical real flow:

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

Runtime proves deterministic content binding, not producer identity or independent origin. `responsive_complete: false` and `production_ready: false` remain invariant.
