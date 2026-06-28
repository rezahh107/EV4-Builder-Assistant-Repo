# ESCAPE_HATCH_RECOVERY

Version: 0.1.0
Status: escape_hatch_recovery_added
Purpose: prevent repeated failed builder instructions from trapping the user in a correction loop.

---

## Core Rule

After repeated failure on the same action, stop repeating the same instruction.

Use an Escape Hatch instead of a third near-identical attempt.

```yaml
escape_hatch_policy:
  max_repeat_before_escape: 2
  retry_1: clarify_instruction
  retry_2: request_targeted_screenshot_or_direct_ui_label
  retry_3: emit_escape_hatch
```

This reconciles the repo retry policy `MAX_RETRY_COUNT = 3` with the UX rule `MAX_RETRY = 2`:

```text
Attempt 1 = clarify.
Attempt 2 = targeted evidence.
Attempt 3 = Escape Hatch, not a repeated instruction.
```

---

## recovery_state

Persist recovery information in session/checkpoint state when possible.

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

Rules:

```text
- retry_count is per action, not per session.
- last_safe_checkpoint is the latest checkpoint with confirmed assertions unaffected by the failure.
- escape_hatch_required becomes true when retry_count >= 2 and the next response would otherwise repeat the same path.
```

---

## Trigger Conditions

Enter Escape Hatch when any of these happen on the same active action:

```text
- user reports the same control/path is missing twice;
- two correction attempts fail or remain unclear;
- two screenshots still do not show required evidence;
- user says the same instruction cannot be followed after a clarification and screenshot request;
- the assistant would otherwise repeat the same instruction for a third time.
```

---

## Escape Hatch Template

Use this concise user-facing template:

```text
به نظر می‌رسد این مرحله گیر کرده.

آخرین وضعیت امن: [last_safe_checkpoint]
هنوز معتبر است: [still_valid_work]
مشکل فعلی: [one-line issue]

دو مسیر داریم:
1. [مسیر جایگزین کوچک]
2. برگشت به [last_safe_checkpoint] و ادامه از مسیر امن‌تر

کدام؟ `۱` / `۲`
```

Rules:

```text
- Do not include a normal builder batch in the same response.
- Do not add SMART_GUIDANCE_FOOTER after Escape Hatch.
- Do not blame the user.
- Do not claim the broken step is fixed.
- Preserve selected_candidate_id, approved classes, and confirmed work.
```

---

## Exit Conditions

Exit Escape Hatch only when:

```text
- user chooses route 1 or 2;
- user provides new evidence that resolves the blocker;
- user explicitly asks to stop or summarize.
```

After exit:

```yaml
runtime_state: CORRECTION
```

until the replacement path or rollback is confirmed safe.
