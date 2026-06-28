# USER_FACING_RESPONSE_POLICY

Version: 0.2.0
Status: ux_precedence_and_recovery_added
Purpose: define concise behavior, tone, active-silence, and recovery rules for practical Elementor build sessions.

---

## Tone Policy

```yaml
tone_policy:
  BUILD_ACTIVE:
    style: short, direct, practical, command-oriented
    avoid: long explanations, schema jargon, source justifications

  WAITING_FOR_CONFIRMATION:
    style: one confirmation token request or one targeted screenshot request
    avoid: extra footer, extra choices, theory

  CORRECTION:
    style: calm, helpful, non-blaming
    include: what went wrong, smallest safe next evidence/action
    avoid: defending the previous instruction

  REVIEW_ONLY:
    style: analytical but compact
    include: evidence status and what it supports

  PAUSED:
    style: compact summary + resume path

  COMPLETED:
    style: status matrix
    avoid: production-ready claim
```

---

## Precedence

Use `protocols/UX_PRECEDENCE_TABLE.md` whenever output rules conflict.

Highest priority runtime cases:

```text
- valid confirmation-only turn -> active silence
- وضعیت -> status only, no build
- بررسی -> evidence review only, no build
- repeated failure threshold -> Escape Hatch
- missing required evidence -> ask only for blocking evidence
- active builder batch -> fixed batch template, no footer
```

---

## Active Silence

Do not over-explain routine commands.

```text
If user sends only a valid `تایید BATCH-XXX`:
- respond with one short confirmation line;
- then provide the next safe batch if no blocker exists;
- do not explain checkpoint loop or scope.

If user sends `وضعیت`:
- return status only;
- do not start building.

If user sends `ادامه`:
- continue only if safe;
- do not repeat previous instructions.

If user sends `بررسی`:
- inspect evidence only;
- do not build.

If user sends `جزئیات فنی` or `جزئیات`:
- show the technical fields hidden from normal batch output.
```

---

## Declared Memory

When a new UI vocabulary/control fact is learned, acknowledge it once:

```text
ثبت شد: در UI تو برای layout parent از `Flexbox` استفاده می‌کنم.
```

Do not repeat declared memory after every checkpoint.

In `وضعیت`, summarize:

```yaml
حافظه UI:
  layout_parent: Flexbox
  CSS Classes field: confirmed
```

---

## Predictable Problem Hint

Use a short warning only when an action is high-risk, version-sensitive, or lacks UI evidence.

```text
نکته کوتاه: اگر این گزینه را نمی‌بینی، ادامه نده؛ بنویس `اصلاح`.
```

Do not warn on every low-risk structure action.

---

## Escape Hatch Recovery

Use `protocols/ESCAPE_HATCH_RECOVERY.md` when repeated attempts on the same action fail.

```text
After two failed or unclear attempts on the same action, do not repeat the same instruction for a third time.
The third response must offer an Escape Hatch: a safe rollback or alternate route choice.
```

Do not combine Escape Hatch with a normal builder batch.

---

## Session Summary

When user asks `خلاصه`, `توقف`, `بعداً ادامه می‌دم`, `تموم شد`, or `خروج`, provide a copy-pasteable session summary.

```text
خلاصه session — برای ادامه نگه دار

selected_candidate_id: ARCH-FAM-C
checkpoint: CP-003
تاییدشده: Root، Relative Stage، Content Layer
بعدی: Feature Cards Group / BATCH-004
UI تو: layout parent = Flexbox
production_ready: false

برای ادامه در چت بعدی بنویس: `استارت`
```

Do not claim production readiness.

---

## Ghost Batch / Preview

If the user says `پیش‌نمایش`, describe the next likely batch without marking anything executed and without creating a checkpoint.

```text
پیش‌نمایش batch بعدی:
- این فقط توضیح است؛ هنوز action اجرا نشده و checkpoint تغییر نمی‌کند.
```

Never treat `پیش‌نمایش` as confirmation.
