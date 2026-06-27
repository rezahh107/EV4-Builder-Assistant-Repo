# core/SESSION_STATE_MACHINE

Version: 0.3.0
Status: mode_state_intake_foundation_added
Purpose: normalized runtime state, workflow mode, checkpoint, and STATE_CAPSULE contract

---

## Canonical Runtime Frame

The assistant must maintain two separate values:

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

`workflow_mode` answers which workflow is active.

`runtime_state` answers what is happening now inside that workflow.

Do not put `START_INTAKE_MODE`, `APPROVED_HANDOFF_MODE`, or `FRESH_IMAGE_MODE_LIMITED` into runtime state.

Do not put `PAUSED`, `WAITING_FOR_CONFIRMATION`, `EVIDENCE_REQUIRED`, `CORRECTION`, or `REVIEW_ONLY` into workflow mode.

Canonical transition details live in:

```text
core/MODE_STATE_MATRIX.md
```

---

## Legacy Runtime Name Normalization

Older docs and session notes may still say:

```yaml
legacy_runtime_names:
  CORRECTION_MODE: CORRECTION
  REVIEW_MODE: REVIEW_ONLY
```

When writing new state data or a `STATE_CAPSULE`, use the normalized names.

---

## Runtime State Meanings

```yaml
INTAKE_WAITING:
  meaning: START_INTAKE_MODE is active and the assistant is waiting for required intake data

INTAKE_VALIDATING:
  meaning: intake data is being checked against BUILDER_CONTEXT_INPUT_CONTRACT

BUILD_ACTIVE:
  meaning: assistant may provide the next safe builder action batch
  requires: valid package/checkpoint and no active blocker

WAITING_FOR_CONFIRMATION:
  meaning: last action batch has been emitted and awaits confirmation/evidence

EVIDENCE_REQUIRED:
  meaning: missing package field, screenshot, version evidence, UI evidence, checkpoint, or status summary blocks continuation

CORRECTION:
  meaning: previous instruction/control/path is disputed, missing, or unsupported

REVIEW_ONLY:
  meaning: inspect evidence only and do not continue automatically

PAUSED:
  meaning: no new builder actions may be emitted
  entered_by: توقف

COMPLETED:
  meaning: session has reached a completion gate report
```

---

## STATE_CAPSULE Rule

Include a one-line `STATE_CAPSULE` only in Builder Assistant session replies where session state matters.

It is a public drift-prevention marker, not a large JSON block.

Recommended shape:

```text
[STATE workflow=APPROVED_HANDOFF_MODE state=WAITING_FOR_CONFIRMATION cp=CP-001 batch=BATCH-001 risk=low]
```

Rules:

```text
- Use English identifiers.
- Keep it one line.
- Do not include private reasoning.
- Do not use it in unrelated repo maintenance reports unless useful.
- It must not replace checkpoint schema.
- It must help prevent session drift.
```

Use `risk=blocked` when the session is in `EVIDENCE_REQUIRED` or cannot continue safely.

---

## Last Verified Checkpoint

A checkpoint must include:

```yaml
last_verified_checkpoint:
  checkpoint_id:
  workflow_mode:
  runtime_state:
  current_section:
  current_handoff_or_context_package:
  selected_candidate_id:
  completed_elements:
  applied_classes:
  verified_settings:
  unconfirmed_settings:
  active_warnings:
  unresolved_evidence:
  last_completed_action:
  next_pending_action:
```

If an older checkpoint only has `current_state`, map it to `runtime_state` before using it in a new reply.

---

## Checkpoint Creation Rule

Create or update a verified checkpoint only when at least one of these is present:

```text
- explicit user confirmation;
- screenshot that visibly confirms the action;
- frontend/diagnostic evidence that confirms the action;
- user says تایید for the latest completed batch;
- manual status import.
```

Do not create a checkpoint from:

```text
- silence;
- a new unrelated question;
- a partial screenshot that does not show the target;
- an assumption that a prior instruction was followed;
- a user message that reports a problem.
```

---

## Minimum Allowed Transitions

Use `core/MODE_STATE_MATRIX.md` as the canonical transition table.

Minimum required transitions:

```yaml
minimum_transitions:
  fresh_شروع:
    to_workflow_mode: START_INTAKE_MODE
    to_runtime_state: INTAKE_WAITING

  valid_package_received:
    to_workflow_mode: APPROVED_HANDOFF_MODE
    to_runtime_state: BUILD_ACTIVE

  missing_required_input:
    to_workflow_mode: START_INTAKE_MODE
    to_runtime_state: EVIDENCE_REQUIRED

  user_says_توقف:
    to_workflow_mode: current workflow_mode
    to_runtime_state: PAUSED

  user_says_استارت_after_pause:
    to_workflow_mode: previous workflow_mode
    to_runtime_state: previous resumable runtime_state

  user_reports_missing_control:
    to_workflow_mode: current workflow_mode
    to_runtime_state: CORRECTION

  user_asks_بررسی:
    to_workflow_mode: current workflow_mode
    to_runtime_state: REVIEW_ONLY

  batch_emitted:
    to_workflow_mode: APPROVED_HANDOFF_MODE
    to_runtime_state: WAITING_FOR_CONFIRMATION

  confirmation_accepted:
    to_workflow_mode: APPROVED_HANDOFF_MODE
    to_runtime_state: BUILD_ACTIVE

  completion_report:
    to_workflow_mode: current workflow_mode
    to_runtime_state: COMPLETED
```

---

## Transition Guards

```text
- Do not leave PAUSED unless user says استارت or ادامه.
- Do not leave CORRECTION until a corrected path is confirmed or evidence resolves the issue.
- Do not leave EVIDENCE_REQUIRED until blocking evidence is provided or route is changed.
- Do not treat ادامه as تایید.
- Do not treat تایید as permission to continue unless the message also asks to continue.
- Do not enter APPROVED_HANDOFF_MODE from image-only input unless FRESH_IMAGE_MODE_LIMITED was explicitly accepted and then a valid Builder_Context_Package is later provided.
- Do not treat optional screenshot absence as a blocker unless the active contract specifically requires it.
```

---

## Status Report Format

When user asks `وضعیت`, return only:

```text
Workflow mode:
Runtime state:
State capsule:
Last verified checkpoint:
Completed structure:
Applied classes:
Active selected element:
Current class:
Next pending action:
Unresolved evidence:
Active warnings:
Safe to continue: yes/no
```

Do not provide new build actions unless user also says `ادامه`.
