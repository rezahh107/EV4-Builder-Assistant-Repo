# commands/SESSION_COMMANDS

Version: 0.3.3
Status: user_facing_builder_ux_added
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
جزئیات
جزئیات فنی
پیش‌نمایش
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

## User-Facing Output Policy

Use:

```text
protocols/BUILDER_BATCH_OUTPUT_FORMAT.md
protocols/USER_FACING_RESPONSE_POLICY.md
```

Normal builder output is for the user, not for schema debugging.

Hide internal fields such as `element_generation_source`, `package_digest`, `input_authorization`, and `Control path: insufficient_evidence` unless the user asks `جزئیات فنی`, `بررسی`, `وضعیت`, or the session is in `CORRECTION` / `EVIDENCE_REQUIRED`.

---

## Guidance Footer Preference

```yaml
guidance_footer: auto | off
```

Use `protocols/SMART_GUIDANCE_FOOTER.md`. Never add a guidance footer after an active builder batch that must end with a confirmation token request or targeted screenshot request.

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

Return a compact copy-pasteable session summary if meaningful.

### استارت

Resume from an initialized session/checkpoint.

This is not fresh-chat intake.

If currently paused, restore previous `workflow_mode` and previous resumable `runtime_state`.

If no initialized session/checkpoint exists, route to `START_INTAKE_MODE` and ask only for blocking intake data.

### ادامه

Continue with the next uncompleted builder batch only when safe.

This does not automatically confirm the previous batch.

Do not repeat previous instructions. If a blocker exists, ask for the single blocking evidence/action.

### تایید

Accept confirmation only when it maps to the active structured confirmation request, expected confirmation token, or qualifying evidence for the active batch.

After a valid token, use active silence:

```text
✓ تایید شد — ادامه می‌دهیم.
```

Then provide the next safe batch if no blocker exists. Do not explain checkpoint loop, scope, or assertion internals unless the user asks `وضعیت`, `بررسی`, or `جزئیات فنی`.

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

Apply `protocols/UI_INSTRUCTION_CONFIDENCE_GATE.md` when the issue involves a missing, unverified, or version-sensitive UI control.

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
known_control_map
ui_vocabulary_map
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
Known control map summary
UI vocabulary map summary
Next pending action
Unresolved evidence
Active warnings
Safe to continue
```

No new build actions unless user also says `ادامه`.

### جزئیات / جزئیات فنی

Show the technical fields hidden from normal builder batches, only as diagnostics:

```text
element_generation
element_generation_source
input_authorization status
package_digest status
confirmed_action_ids / unconfirmed_action_ids
known_control_map
ui_vocabulary_map
evidence status
control path evidence
```

Do not continue automatically.

### پیش‌نمایش

Describe the next likely batch without executing it.

Rules:

```text
- Do not create or update checkpoint.
- Do not mark any action confirmed.
- Do not ask for confirmation token as if the batch was emitted.
- Start with: پیش‌نمایش batch بعدی — هنوز اجرا نشده.
```

### عقب

Return to the checkpoint before the latest unconfirmed batch. Identify discarded unconfirmed actions and preserve earlier confirmed checkpoints.

### مستندات

Verify the requested behavior using official Elementor V4+/Atomic sources when source access is available. Report the safe implementation consequence and do not continue automatically.

Official docs may prove capability/terminology. Current UI evidence or direct user statement still governs executable control paths.

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

Return a copy-pasteable continuation summary. Do not continue automatically.

Required shape:

```text
خلاصه session — برای ادامه نگه دار

selected_candidate_id:
checkpoint:
تاییدشده:
بعدی:
UI تو:
production_ready: false

برای ادامه در چت بعدی بنویس: `استارت`
```

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
```
