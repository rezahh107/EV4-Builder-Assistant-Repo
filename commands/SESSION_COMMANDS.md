# commands/SESSION_COMMANDS

Version: 0.3.0
Status: mode_state_intake_foundation_added
Purpose: Persian control commands for the builder session

---

## Recognition Rule

Treat listed Persian session words as explicit builder-session commands when they appear alone or at the beginning of a message followed by a colon.

These commands control the Builder Assistant session. They are not EV4 Architect pipeline commands.

```text
شروع
توقف
استارت
ادامه
تایید
اصلاح
بررسی
وضعیت
عقب
مستندات
ریست
خلاصه
یک پله
دو پله
سه پله
چهار پله
پنج پله
تعداد پله: N
```

---

## Mode/State Rule

Commands must update `workflow_mode` and `runtime_state` separately.

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

Legacy names:

```yaml
CORRECTION_MODE: CORRECTION
REVIEW_MODE: REVIEW_ONLY
```

---

## Commands

### شروع

Starts or safely reruns intake.

Set:

```yaml
workflow_mode: START_INTAKE_MODE
runtime_state: INTAKE_WAITING
```

Before asking again, inspect attachments, pasted JSON, copied package text, and current message content.

Do not delete initialized state or verified checkpoints.

Use:

```text
docs/START_INTAKE_POLICY.md
```

If valid `Builder_Context_Package` is already provided, validate it and route to:

```yaml
workflow_mode: APPROVED_HANDOFF_MODE
runtime_state: BUILD_ACTIVE
```

### توقف

Set:

```yaml
runtime_state: PAUSED
```

Keep the current `workflow_mode` unchanged. Preserve the last verified checkpoint and the previous resumable runtime state.

Do not resume until `استارت` or `ادامه`.

### استارت

Resume from an initialized session/checkpoint.

This is not fresh-chat intake.

If currently paused, restore previous `workflow_mode` and previous resumable `runtime_state`.

If no initialized session/checkpoint exists, route to `START_INTAKE_MODE` and ask only for blocking intake data.

### ادامه

Continue with the next uncompleted builder batch only when safe.

This does not automatically confirm the previous batch.

If the session is paused, `ادامه` may resume only when a previous resumable state is known and no blocker exists.

### تایید

Mark the latest completed batch as user-confirmed and create a verified checkpoint.

Do not automatically provide the next batch unless the user also asks to continue.

If accepted after a waiting batch, route:

```yaml
workflow_mode: APPROVED_HANDOFF_MODE
runtime_state: BUILD_ACTIVE
```

### اصلاح

Set:

```yaml
runtime_state: CORRECTION
```

Keep the current `workflow_mode` unchanged.

Stop new implementation, identify the incorrect or unsupported instruction, provide the smallest corrected path, and wait for confirmation.

### بررسی

Set:

```yaml
runtime_state: REVIEW_ONLY
```

Keep the current `workflow_mode` unchanged.

Inspect only provided evidence and do not continue automatically.

Evidence may include:

```text
Elementor screenshot
Structure Panel screenshot
Frontend screenshot
SVG
DOM diagnostic
Computed CSS
Export JSON
```

### وضعیت

Return concise state report only:

```text
Workflow mode
Runtime state
State capsule
Last verified checkpoint
Completed structure
Applied classes
Active selected element
Current class
Next pending action
Unresolved evidence
Active warnings
Safe to continue
```

No new build actions unless user also says `ادامه`.

### عقب

Return to the checkpoint before the latest unconfirmed batch. Identify discarded unconfirmed actions and preserve earlier confirmed checkpoints.

### مستندات

Verify the requested behavior using official Elementor V4+/Atomic sources when source access is available. Report the safe implementation consequence and do not continue automatically.

### ریست

Do not reset immediately. Ask reset scope first and state exactly what would be lost.

Allowed reset scopes:

```text
full_session_reset
checkpoint_only_reset
class_map_reset
not_confirmed
```

### خلاصه

Return continuation-oriented summary with verified structure, applied classes, unknowns, conflicts, pending work, last checkpoint, and next safe action. Do not continue automatically.

---

## Adjustable Action Count Commands

```text
یک پله = 1
دو پله = 2
سه پله = 3
چهار پله = 4
پنج پله = 5
تعداد پله: N = any integer from 1 to 5
```

When an action-count command is received:

```text
1. Update max_actions_per_turn within 1..5.
2. Report the new maximum.
3. Preserve workflow_mode and runtime_state.
4. Do not emit a new builder batch unless the user also says ادامه.
```

Values above 5 are invalid. Ask the user to choose a value from 1 to 5.
