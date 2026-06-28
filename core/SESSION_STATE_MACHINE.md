# core/SESSION_STATE_MACHINE

Version: 0.3.1
Status: checkpoint_evidence_retry_added
Purpose: normalized runtime state, workflow mode, checkpoint, evidence assertion, and STATE_CAPSULE contract

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
  meaning: previous instruction/control/path is disputed, missing, unsupported, or has reached retry_3

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

Legacy checkpoint `ev4-builder-checkpoint@0.1.0` remains valid for compatibility.

New checkpoints should prefer assertion/evidence model `ev4-builder-checkpoint@0.2.0`:

```yaml
last_verified_checkpoint:
  checkpoint_id:
  checkpoint_sequence:
  parent_checkpoint_id:
  package_id:
  package_sha256:
  selected_candidate_id:
  workflow_mode:
  runtime_state:
  batch_id:
  confirmed_action_ids: []
  unconfirmed_action_ids: []
  assertions:
    - assertion_id:
      subject_ref:
      claim:
      status: confirmed | not_checked | insufficient_evidence | not_applicable
      evidence_refs: []
  evidence_ledger: []
  retry_policy:
    max_retry_per_action: 3
    retry_1: clarify_instruction
    retry_2: request_targeted_screenshot
    retry_3: enter_CORRECTION
  created_at:
  created_from:
```

If an older checkpoint only has `current_state`, map it to `runtime_state` before using it in a new reply.

---

## Evidence Confirmation Rule

Evidence confirms only the specific assertions it supports.

```text
- A screenshot confirms only visible assertions in that screenshot.
- A structure-panel screenshot may confirm structure and class assertions visible in the panel, not frontend rendering.
- A frontend screenshot may confirm visible layout/rendering assertions, not hidden Elementor settings.
- A diagnostic or export JSON confirms only claims traceable to that artifact.
- Silence confirms nothing.
- Vague “done” does not confirm detailed assertions unless the package expected only minimal confirmation for those exact action IDs.
```

When evidence is partial, mark unsupported assertions as `insufficient_evidence` or `not_checked`; do not mark the whole batch confirmed.

If required evidence is insufficient:

```yaml
runtime_state: EVIDENCE_REQUIRED
```

If evidence contradicts the instruction or a repeated retry reaches the limit:

```yaml
runtime_state: CORRECTION
```

---

## Retry Policy

Canonical retry policy:

```yaml
MAX_RETRY_COUNT: 3
retry_policy:
  max_retry_per_action: 3
  retry_1: clarify_instruction
  retry_2: request_targeted_screenshot
  retry_3: enter_CORRECTION
```

Rules:

```text
- Retry count is per action, not per session.
- retry_1 clarifies the exact instruction and expected evidence.
- retry_2 requests one targeted screenshot or diagnostic artifact.
- retry_3 enters CORRECTION and stops downstream actions.
- Do not ask the user to confirm hashes in this patch.
```

---

## Checkpoint Creation Rule

Create or update a verified checkpoint only when at least one assertion is supported by evidence:

```text
- explicit user confirmation mapped to confirmed_action_ids;
- screenshot that visibly confirms the assertion;
- frontend/diagnostic/export evidence that confirms the assertion;
- user sends the expected structured confirmation token for the latest completed batch;
- manual status import with assertion/evidence mapping.
```

Do not create a confirmed checkpoint from:

```text
- silence;
- a new unrelated question;
- a partial screenshot that does not show the target;
- an assumption that a prior instruction was followed;
- a vague “done” that cannot be mapped to assertion IDs;
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

  insufficient_checkpoint_evidence:
    to_workflow_mode: current workflow_mode
    to_runtime_state: EVIDENCE_REQUIRED

  retry_3_reached:
    to_workflow_mode: current workflow_mode
    to_runtime_state: CORRECTION

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
- Do not treat silence as confirmation.
- Do not treat screenshot evidence as batch-wide confirmation.
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
Confirmed action IDs:
Unconfirmed action IDs:
Assertion statuses:
Evidence ledger summary:
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
