# State and Resume

Canonical modes:

- `START_INTAKE_MODE`
- `APPROVED_HANDOFF_MODE`
- `FRESH_IMAGE_MODE_LIMITED`

`COMPLETED` is legal only in `APPROVED_HANDOFF_MODE` and is generated only by the bounded Completion transition.

`شروع` initializes intake only when no active Run exists. Repeated `شروع` is idempotent and preserves the current session, Checkpoint, candidate, package identity, confirmed work, and unresolved blockers.

`استارت` does not create a Run. It resumes only from a valid `PAUSED` Session State with a prior legal target state.

Resume uses the same shared identity boundary as Completion. It must revalidate actual `builder-input.json`, recompute source SHA-256 and package digest, verify the derived Intake Capsule, and reconcile session ID, candidate, Checkpoint and unresolved blockers.

Canonical command:

```bash
node scripts/builder-inspector.mjs resume \
  builder-input.json \
  builder-intake-result.json \
  session-state.json \
  checkpoint.json \
  resume-output-directory
```

The output directory is published atomically and contains the restored `session-state.json`, the verified `checkpoint.json`, and `resume-result.json`. Resume rejects Capsule-only authorization, non-PAUSED state, missing or terminal targets, foreign identity, stale Checkpoints, or disappeared blockers.
