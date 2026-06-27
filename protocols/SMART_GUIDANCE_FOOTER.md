# SMART_GUIDANCE_FOOTER

Version: 0.1.0
Status: active
Purpose: add a compact context-aware guidance footer to Builder Assistant replies when it helps the user choose the next safe step.

---

## Core Idea

The assistant may add a short guidance footer at the end of a reply when the current state has a meaningful user choice.

The footer is not a builder action.

The footer must not override gates, input contracts, checkpoints, or approved handoff rules.

---

## When To Use

Use the footer only when it improves the next user decision.

Good cases:

- the user provided a valid required input but skipped optional helpful evidence
- the assistant can continue safely, but quality would improve with another source
- the user has two safe routes: continue now or provide stronger evidence
- a checkpoint can be created but screenshot evidence would reduce risk
- responsive, overlay, SVG, or accessibility work is approaching
- the current state is paused, blocked, or waiting for a specific missing item
- correction mode has a choice between rollback, screenshot, or small repair

Do not use the footer when:

- the main reply already contains only one clear required action
- adding it would confuse a confirmation sentence
- the next step is fully blocked by a missing required input
- the user explicitly asked for no extra guidance
- the reply is a final status report with no decision needed

---

## Footer Types

### 1. Better Evidence Nudge

Use when continuing is allowed but another input would reduce risk.

Example intent:

```text
I can continue with the current data, but a current Structure Panel screenshot would make the next steps safer.
```

### 2. Choice Router

Use when the user has multiple valid paths.

Example intent:

```text
Say continue to proceed, review to inspect evidence first, or send screenshot to reduce uncertainty.
```

### 3. Blocking Clarifier

Use when a required item is missing.

Example intent:

```text
The next step is blocked until Builder_Context_Package is provided.
```

### 4. Risk Preview

Use before high-risk visual, responsive, overlay, SVG, z-index, overflow, or numeric tuning.

Example intent:

```text
The next step affects visual matching; one action at a time is safer.
```

### 5. Recovery Hint

Use after user reports a wrong control, missing panel, or unexpected UI.

Example intent:

```text
Send a screenshot of the selected element and active class so I can switch to correction mode safely.
```

---

## Output Contract

The footer must be short.

Recommended shape in Persian:

```text
راهنمای کوتاه:
- پیشنهاد: ...
- تریگرها: `ادامه` / `بررسی` / `اصلاح` / `ارسال screenshot`
```

Maximum:

```yaml
lines: 3
items: 2
words_approx: 45
```

Do not include long explanations, citations, or documentation quotes in the footer.

---

## Safety Rules

The footer must not say that a blocked step can proceed.

The footer must distinguish:

```text
required_input_missing
optional_evidence_missing
safe_to_continue_with_caution
blocked_until_correction
```

If required input is missing, only ask for the required input.

If optional evidence is missing, the footer may say that continuing is possible but less safe.

Never hide preserved flags, unknowns, or risks.

Never use the footer to encourage redesign, rescoring, or architecture mutation.

---

## Command Triggers

Allowed trigger suggestions:

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

Do not invent commands that are not supported by `commands/SESSION_COMMANDS.md` unless they are plain natural-language user actions such as sending a screenshot or file.

---

## Examples

### Start Intake With Missing Optional Screenshot

```text
راهنمای کوتاه:
- می‌توانم بعد از package معتبر ادامه بدهم، اما screenshot مرجع ریسک برداشت بصری را کم می‌کند.
- تریگرها: `ادامه با همین داده` / `ارسال screenshot`
```

### Package Valid But Editor Screenshot Missing

```text
راهنمای کوتاه:
- مرحله بعد قابل شروع است؛ screenshot از Structure Panel فقط مسیر کنترل‌های واقعی را امن‌تر می‌کند.
- تریگرها: `ادامه` / `ارسال screenshot`
```

### Blocking Package Missing

```text
راهنمای کوتاه:
- فعلاً مرحله بعد blocked است؛ اول Builder_Context_Package را بفرست.
```

### Correction Needed

```text
راهنمای کوتاه:
- برای اصلاح امن، screenshot از selected element و active class بفرست.
- تریگرها: `اصلاح` / `بررسی`
```
