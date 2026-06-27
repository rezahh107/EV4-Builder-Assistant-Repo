# STATUS — EV4 Builder Assistant Repo

Version: 0.3.1
Status: mode_state_intake_foundation_hardened
Date: 2026-06-27

---

## Current State

```yaml
project_status:
  project_instructions: active_v0.3.1
  master_prompt: active_v0.3.1
  session_state_machine: active_v0.3.0
  mode_state_matrix: active_v0.3.0
  start_intake_policy: active_v0.3.0
  session_commands: active_v0.3.0
  intake_result_schema: hardened_v0.3.1
  session_state_schema: hardened_v0.3.1
  intake_result_fixtures: expanded
  session_state_fixtures: added
  schema_validation_workflow: expanded_fixture_coverage
  package_scripts: expanded_fixture_coverage
  action_default_max: 5
  production_ready: false
```

---

## v0.3.1 Hardening Summary

```text
PROJECT_INSTRUCTIONS.md no longer treats PAUSED, CORRECTION_MODE, or REVIEW_MODE as workflow modes.
core/MASTER_PROMPT.md now uses workflow_mode/runtime_state separation.
schemas/intake-result.schema.json enforces approved/blocked intake invariants.
schemas/session-state.schema.json enforces workflow_mode/runtime_state pairing when either field is present.
CI validates all intake_result valid/invalid fixtures by filename pattern.
CI validates a session-state mode/runtime mismatch fixture.
```

---

## Runtime Foundation

```yaml
workflow_mode:
  - START_INTAKE_MODE
  - APPROVED_HANDOFF_MODE
  - FRESH_IMAGE_MODE_LIMITED

runtime_state:
  - INTAKE_WAITING
  - INTAKE_VALIDATING
  - BUILD_ACTIVE
  - WAITING_FOR_CONFIRMATION
  - EVIDENCE_REQUIRED
  - CORRECTION
  - REVIEW_ONLY
  - PAUSED
  - COMPLETED
```

Legacy aliases remain compatibility names only:

```yaml
CORRECTION_MODE: CORRECTION
REVIEW_MODE: REVIEW_ONLY
```

---

## Validation State

```yaml
validation_state:
  github_actions_schema_validation: pending_after_v0.3.1
  local_validation: not_run_in_repo_clone
  reason_local_validation_not_run: GitHub connector applies file writes but does not provide a local checked-out repo or npm execution environment
  real_builder_session_test: not_run
```

---

## Boundary

```text
EV4 Builder Assistant is not EV4 Architect.
START_INTAKE_MODE and APPROVED_HANDOFF_MODE are workflow modes, not runtime states.
PAUSED, WAITING_FOR_CONFIRMATION, EVIDENCE_REQUIRED, CORRECTION, and REVIEW_ONLY are runtime states.
STATE_CAPSULE is a one-line public drift-prevention marker, not a checkpoint replacement.
Production ready remains false.
```

---

## Pending Next Work

```text
run GitHub Actions schema validation after v0.3.1
review CI logs if any schema invariant fails
continue with the next explicitly requested patch only
```
