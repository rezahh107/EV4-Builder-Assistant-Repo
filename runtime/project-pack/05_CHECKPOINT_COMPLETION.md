# Checkpoint and Completion

Checkpoint identity binds:

- `session_id`;
- canonical `package_digest`;
- `selected_candidate_id`;
- `batch_id` and Action IDs;
- assertions and retained evidence;
- unresolved blockers;
- legal workflow mode and runtime state.

Completion is a bounded transition from `APPROVED_HANDOFF_MODE / BUILD_ACTIVE` to `APPROVED_HANDOFF_MODE / COMPLETED`. Caller-authored `COMPLETED` Session State or Checkpoint input is rejected.

Before transition, the shared module must:

- revalidate actual `builder-input.json` and its derived Intake Capsule;
- verify exact session, package, candidate and predecessor Checkpoint identity;
- reconcile every required Action in `builder-input.json:first_builder_batch.actions` with the final Checkpoint;
- reject omitted, foreign, duplicate, conflicting or unconfirmed Action IDs;
- enforce the active desktop Builder Completion Status semantics;
- bind Completion Gate to candidate, package digest, session ID, Checkpoint ID and Checkpoint sequence;
- require zero unresolved blocking evidence.

Canonical command:

```bash
node scripts/builder-inspector.mjs completion \
  builder-input.json \
  builder-intake-result.json \
  session-state.json \
  checkpoint.json \
  completion-status.json \
  completion-gate.json \
  completion-output-directory
```

After every guard passes, the Inspector derives the next `COMPLETED` Session State and Checkpoint, validates generated carriers, and atomically publishes them with `completion-result.json`. A failed transition publishes no terminal carrier and removes temporary output.

Builder completion never implies Responsive completion or production readiness:

```yaml
builder_build_complete: true
responsive_complete: false
production_ready: false
```
