# SMART_GUIDANCE_FOOTER

Version: 0.2.0
Status: restricted_context_footer
Purpose: add a compact context-aware guidance footer only when it helps the user choose the next safe step without bypassing gates, validation, checkpoints, or confirmation boundaries.

---

## Core Rule

The footer is optional guidance, not a builder action, not a confirmation request, and not a shortcut around any runtime gate.

```yaml
guidance_footer: auto | off
```

Default session preference is `auto` unless the user asks to turn guidance off. If `guidance_footer: off`, omit the footer except when a blocking protocol requires a single missing-input request.

---

## Context Allowlist

```yaml
footer_allowed:
  intake_with_optional_evidence: true
  review_or_status_response: true
  paused_state: true
  post_correction_choice: true
  active_builder_batch: false
  fully_blocked_required_input: false
  completion_report: false
```

Interpretation:

```text
- intake_with_optional_evidence: allowed only when required intake is present or being validated and optional evidence would improve quality.
- review_or_status_response: allowed when the user asks for وضعیت, بررسی, or خلاصه and no builder batch is being emitted.
- paused_state: allowed to show resume/review choices.
- post_correction_choice: allowed after a correction envelope when the user has multiple safe next routes.
- active_builder_batch: forbidden when the response emits builder actions.
- fully_blocked_required_input: forbidden; ask only for the missing required input.
- completion_report: forbidden; final reports must not include continue-style nudges.
```

---

## Hard Prohibitions

The footer must never:

```text
- bypass input contracts, validation, checkpoints, confirmation, or correction gates;
- appear after an active builder batch when the response must end with a confirmation token request or a screenshot request;
- imply that required gates can be skipped because optional evidence is absent;
- encourage redesign, rescoring, architecture mutation, class mutation, or production-ready claims;
- hide preserved flags, unknowns, conflicts, or risks;
- include long explanations, citations, documentation quotes, or extra builder steps.
```

If required input is missing, ask only for that required input and do not add a “continue” trigger.

If optional evidence is missing, the footer may say that evidence would improve quality, but it must not imply that blocked gates can be skipped.

---

## Output Contract

Maximum:

```yaml
lines: 3
items: 2
content: one suggestion + allowed triggers only
```

Recommended Persian shape:

```text
راهنمای کوتاه:
- پیشنهاد: ...
- تریگرها: `ادامه` / `بررسی` / `ارسال screenshot`
```

Do not use the footer when the main reply already ends with the required confirmation token request or the required screenshot recipe.

---

## Allowed Trigger Examples

```text
ادامه
بررسی
اصلاح
توقف
استارت
تایید
خلاصه
ارسال Builder_Context_Package
ارسال screenshot
ادامه با همین داده
```

Do not invent commands outside `commands/SESSION_COMMANDS.md` unless the phrase is a plain natural-language user action such as sending a file or screenshot.

---

## Examples

### Intake With Optional Screenshot Missing

Allowed only when `Builder_Context_Package` is present or validation can proceed without the screenshot:

```text
راهنمای کوتاه:
- پیشنهاد: screenshot مرجع کیفیت برداشت بصری را بهتر می‌کند، ولی gate اصلی همان package معتبر است.
- تریگرها: `ادامه با همین داده` / `ارسال screenshot`
```

### Review Or Status Response

```text
راهنمای کوتاه:
- پیشنهاد: برای ادامه امن، unresolved evidence را قبل از batch بعدی بررسی کن.
- تریگرها: `بررسی` / `ادامه`
```

### Fully Blocked Required Input

No footer. Main reply asks only for the blocking input:

```text
برای ادامه، فقط `Builder_Context_Package` معتبر را ارسال کن.
```

### Active Builder Batch

No footer. The response must end with exactly one trusted confirmation token request or one targeted screenshot request.

### Post-Correction Choice

```text
راهنمای کوتاه:
- پیشنهاد: یا مسیر اصلاح‌شده را تأیید کن، یا screenshot تازه از selected element بفرست.
- تریگرها: `تایید` / `ارسال screenshot`
```
