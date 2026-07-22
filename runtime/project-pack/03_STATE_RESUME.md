# State and Resume

Canonical modes:

- `START_INTAKE_MODE`
- `APPROVED_HANDOFF_MODE`
- `FRESH_IMAGE_MODE_LIMITED`

`COMPLETED` is legal only in `APPROVED_HANDOFF_MODE`.

`شروع` initializes intake only when no active Run exists. Repeated `شروع` is idempotent and must preserve the current session, Checkpoint, candidate, package identity, confirmed work, and unresolved blockers.

`استارت` does not create a Run. It resumes only from a valid `PAUSED` Session State with a prior legal target state.

Resume requires:

```yaml
session_id_matches: true
package_digest_matches: true
selected_candidate_matches: true
checkpoint_valid: true
session_state_valid: true
checkpoint_and_state_consistent: true
unresolved_blockers_preserved: true
transition_is_legal: true
```

Canonical command:

```bash
node scripts/builder-inspector.mjs resume builder-intake-result.json session-state.json checkpoint.json resume-result.json
```
