# protocols/SESSION_REPAIR_PACKET

Version: 1.0.0
Status: active_required
Purpose: enforce a formal incident repair loop for interrupted EV4 Builder Assistant sessions.

---

## Trigger

Enter the Session Repair Packet loop immediately when any build-impacting issue is reported or detected:

```text
wrong_instruction
missing_ui_control
ui_path_version_mismatch
wrong_selected_element
wrong_active_class
package_evidence_conflict
visible_frontend_editor_contradiction
layout_instability
unsupported_assumption
repeated_unclear_failing_action
root_pipeline_gap
```

A user report, screenshot contradiction, missing control, visible layout instability, invalid assumption, or repeated failure is enough to stop normal build batches.

---

## Freeze Rule

When triggered:

```yaml
workflow_mode: current workflow_mode
runtime_state: CORRECTION
normal_builder_batch_allowed: false
repair_packet_required: true
```

Do not continue unrelated structure, content, style, responsive, SVG, overlay, or pixel tuning work.

Do not explain and then continue. The repair artifact is required before any resume path.

---

## Required Repair Packet

A repair response must include or update a machine-checkable `repair_packet` conforming to:

```text
schemas/repair-packet.schema.json
```

Minimum semantic fields:

```yaml
repair_packet:
  incident_id:
  workflow_mode:
  runtime_state: CORRECTION
  selected_candidate_id:
  trigger:
    type:
    reported_by:
    evidence_refs: []
  last_safe_checkpoint:
    checkpoint_id:
    batch_id:
    status:
    selected_candidate_id:
  active_batch:
    batch_id:
    status:
  affected_actions: []
  confirmed_work: []
  still_valid_work: []
  invalid_or_unverified_work: []
  rollback_required:
    value:
    reason:
  smallest_verified_repair_path: []
  evidence_required: []
  resume_condition:
    expected_user_token:
    required_screenshot:
  root_fix_required:
    value:
    repo_scope: []
  production_ready: false
```

---

## Diagnosis and Scope Rules

The assistant must separate:

```text
confirmed_work
still_valid_work
invalid_or_unverified_work
rollback_required
```

Rules:

```text
- confirmed_work requires evidence_refs.
- still_valid_work requires evidence_refs, normally from the last safe checkpoint.
- invalid_or_unverified_work must identify the affected action or batch.
- rollback_required must be explicit true/false with reason.
- selected_candidate_id must match the last safe checkpoint.
- production_ready must remain false.
```

---

## Repair Rule

The repair path must be the smallest safe path:

```text
- repair only the affected action/batch/control/scope;
- preserve approved structure and class names;
- do not rerun architecture, scoring, recommendation, or redesign;
- do not assume clickability, Dynamic Loop, mobile/tablet behavior, custom breakpoints, Grid support, exact Elementor UI paths, or production readiness;
- do not mutate selected_candidate_id.
```

---

## Confirmation and Resume Rule

Normal build may resume only after one of these validates:

```text
repair-specific token: تایید CORRECTION-...
targeted screenshot required by repair_packet.resume_condition
```

A normal `تایید BATCH-XXX` token must not resolve an active repair packet.

After repair confirmation/evidence passes:

```yaml
runtime_state: BUILD_ACTIVE
next_action: smallest safe next builder action after repair
```

---

## Root-Fix Escalation

If the incident reveals a repository pipeline defect, set:

```yaml
root_fix_required:
  value: true
  repo_scope:
    - protocols
    - schemas
    - validators
    - tests
```

This does not authorize in-session architecture redesign. It only records that a repo-level patch is required.

---

## Smart Home Layout Incident Rule

For the Smart Home Connector incident where content entry began before layout stabilization:

```yaml
trigger.type: layout_instability
last_safe_checkpoint.batch_id: BATCH-005
active_batch.batch_id: BATCH-006
rollback_required.value: false
resume_condition.expected_user_token: تایید CORRECTION-LAYOUT
root_fix_required.value: true
```

The repair path must verify/correct `Smart Home Section / Feature Cards Group` layout controls before content entry.
