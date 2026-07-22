# Checkpoint and Completion

Checkpoint identity binds:

- `session_id`;
- canonical `package_digest`;
- `selected_candidate_id`;
- `batch_id` and action IDs;
- assertions and retained evidence;
- unresolved blockers;
- legal workflow mode and runtime state.

Completion is valid only after `completion_validation_passed` from `APPROVED_HANDOFF_MODE / BUILD_ACTIVE`.

Required conditions:

```yaml
workflow_mode: APPROVED_HANDOFF_MODE
runtime_state: COMPLETED
final_checkpoint_valid: true
package_digest_matches: true
selected_candidate_matches: true
required_actions_complete: true
unresolved_blocking_evidence_count: 0
completion_status_valid: true
completion_gate_valid: true
```

Canonical command:

```bash
node scripts/builder-inspector.mjs completion builder-intake-result.json session-state.json checkpoint.json completion-status.json completion-gate.json completion-result.json
```

A completion report request, detached success text, incomplete actions, stale Checkpoint, candidate mismatch, package mismatch, or unresolved blocker cannot produce Completion.

Builder completion never implies Responsive completion or production readiness.
