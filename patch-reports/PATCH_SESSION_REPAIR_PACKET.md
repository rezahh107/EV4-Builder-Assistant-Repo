# PATCH_SESSION_REPAIR_PACKET

Date: 2026-06-28
Branch: fix/session-repair-packet
Status: implemented_on_branch

---

## Objective

Add a root-level repair mechanism for interrupted EV4 Builder Assistant sessions.

The patch prevents blind continuation after mid-build problems by requiring a machine-checkable `repair_packet` when a build-impacting incident enters `CORRECTION`.

---

## Root Cause

The repository had checkpointing, `CORRECTION`, `PAUSED`, evidence records, and `recovery_state`, but did not enforce a formal incident artifact that captured:

```text
trigger
affected batch/action
last safe checkpoint
confirmed work
still-valid work
invalid/unverified work
rollback decision
smallest repair path
evidence required
resume token
root-fix escalation
```

As a result, a real Smart Home Connector session could continue after layout stability was missed before content entry.

---

## Implemented Mechanism

Added:

```text
protocols/SESSION_REPAIR_PACKET.md
schemas/repair-packet.schema.json
scripts/validate-repair-packet.mjs
```

Integrated into:

```text
PROJECT_INSTRUCTIONS.md
core/MASTER_PROMPT.md
schemas/session-state.schema.json
.github/workflows/schema-validation.yml
package.json
```

---

## Enforcement

When a build-impacting issue is reported or detected:

```yaml
runtime_state: CORRECTION
normal_builder_batch_allowed: false
repair_packet_required: true
```

The session cannot resume normal build until:

```text
repair_packet.resume_condition.expected_user_token
or targeted screenshot/evidence required by repair_packet.resume_condition
```

Normal `تایید BATCH-XXX` does not resolve an active repair packet.

---

## Regression Fixtures

Valid:

```text
tests/valid/repair_packet_smart_home_layout_instability.json
tests/valid/repair_packet_missing_ui_control.json
tests/valid/repair_packet_wrong_selected_element.json
tests/valid/repair_packet_no_rollback_structure_valid.json
tests/valid/repair_packet_rollback_required_invalid_duplicate_root.json
tests/valid/session_state_correction_with_repair_packet.json
examples/smart-home-connector/repair_packet_layout_stability_incident.json
```

Invalid:

```text
tests/invalid/repair_packet_missing_last_safe_checkpoint.json
tests/invalid/repair_packet_missing_affected_actions.json
tests/invalid/repair_packet_production_ready_true.json
tests/invalid/repair_packet_missing_resume_condition.json
tests/invalid/repair_packet_changes_selected_candidate_id.json
tests/invalid/repair_packet_confirmed_without_evidence.json
tests/invalid/session_state_correction_without_repair_packet.json
```

---

## Smart Home Connector Incident

The layout-stability incident is represented as:

```yaml
last_safe_checkpoint.batch_id: BATCH-005
active_batch.batch_id: BATCH-006
still_valid_work:
  - root/stage/content layer/cards/visual core/house asset
invalid_or_unverified_work:
  - text entry before layout stabilization
rollback_required.value: false
resume_condition.expected_user_token: تایید CORRECTION-LAYOUT
root_fix_required.value: true
production_ready: false
```

---

## Safety

This patch does not:

```text
rerun architecture
rerun scoring
rerun recommendation
redesign the approved Smart Home section
change selected_candidate_id
add/remove approved class names
assume clickability, Dynamic Loop, mobile/tablet behavior, custom breakpoints, Grid support, exact UI paths, or production readiness
```
