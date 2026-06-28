# core/SESSION_STATE_MACHINE

Version: 0.3.4
Status: ux_precedence_and_recovery_added
Purpose: normalized runtime state, workflow mode, checkpoint, evidence assertion, UI vocabulary, recovery state, and STATE_CAPSULE contract

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

Canonical transition details live in:

```text
core/MODE_STATE_MATRIX.md
```

UX conflict resolution lives in:

```text
protocols/UX_PRECEDENCE_TABLE.md
```

---

## Legacy Runtime Name Normalization

```yaml
legacy_runtime_names:
  CORRECTION_MODE: CORRECTION
  REVIEW_MODE: REVIEW_ONLY
```

---

## STATE_CAPSULE Rule

Include a one-line `STATE_CAPSULE` only in Builder Assistant session replies where session state matters.

```text
[STATE workflow=APPROVED_HANDOFF_MODE state=WAITING_FOR_CONFIRMATION cp=CP-001 batch=BATCH-001 risk=low]
```

Use `risk=blocked` when the session is in `EVIDENCE_REQUIRED` or cannot continue safely.

---

## UI Vocabulary And Known Controls

Maintain a compact `ui_vocabulary_map` when the user's Elementor labels differ from package architecture terms.

```yaml
ui_vocabulary_map:
  - vocabulary_key: layout_parent
    architecture_term: Container
    user_ui_label: Flexbox
    confirmed_by: user_statement | screenshot
    confirmed_at_checkpoint: CP-001
    status: confirmed | unknown | changed | insufficient_evidence
```

Maintain `known_control_map` for verified UI controls.

```yaml
known_control_map:
  - control_name: CSS Classes field
    panel_name: Advanced
    confirmed_by: user_statement | screenshot | documentation | installed_version
    status: confirmed | missing | version_sensitive | insufficient_evidence
```

---

## Recovery State

Use `protocols/ESCAPE_HATCH_RECOVERY.md` when repeated attempts on one action fail.

```yaml
recovery_state:
  last_safe_checkpoint:
  active_action_id:
  retry_count:
  max_repeat_before_escape: 2
  escape_hatch_required: false
  still_valid_work: []
  invalid_or_unverified_work: []
```

Reconcile retry policy as:

```text
retry_1 = clarify instruction
retry_2 = request targeted screenshot or direct UI label
retry_3 = Escape Hatch, not a repeated instruction
```

Do not repeat the same failed instruction for a third time.

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
  known_control_map: []
  ui_vocabulary_map: []
  recovery_state:
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
    retry_3: emit_escape_hatch
  created_at:
  created_from:
```

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

## Checkpoint Creation Rule

Create or update a verified checkpoint only when at least one assertion is supported by evidence:

```text
- explicit user confirmation mapped to confirmed_action_ids;
- screenshot that visibly confirms the assertion;
- frontend/diagnostic/export evidence that confirms the assertion;
- user sends the expected structured confirmation token for the latest completed batch;
- manual status import with assertion/evidence mapping;
- user confirms a UI vocabulary/control label;
- recovery_state changes after repeated failure.
```

Do not create a confirmed checkpoint from silence, unrelated questions, unsupported screenshots, assumptions, vague “done”, or a user message that reports a problem.

---

## Transition Guards

```text
- Do not leave PAUSED unless user says استارت or ادامه.
- Do not leave CORRECTION until a corrected path is confirmed or evidence resolves the issue.
- Do not leave EVIDENCE_REQUIRED until blocking evidence is provided or route is changed.
- Do not treat ادامه as تایید.
- Do not treat silence as confirmation.
- Do not treat screenshot evidence as batch-wide confirmation.
- If repeated failure reaches Escape Hatch threshold, do not emit a normal build batch.
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
Known control map summary:
UI vocabulary map summary:
Recovery state summary:
Next pending action:
Unresolved evidence:
Active warnings:
Safe to continue: yes/no
```

Do not provide new build actions unless user also says `ادامه`.
