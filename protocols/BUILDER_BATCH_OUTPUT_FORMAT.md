# BUILDER_BATCH_OUTPUT_FORMAT

Version: 0.1.0
Status: user_facing_builder_ux_added
Purpose: define concise Persian, user-facing Builder Assistant batch output.

---

## Core Filtering Rule

Show a field only when it tells the user what to build, where to build it, what to name it, what class to enter, what not to change, or what result to expect.

Hide fields that only explain why the model made a decision or which internal source justified the decision.

```yaml
show_in_normal_batch:
  - هدف
  - داخل
  - نوع عنصر
  - نام در Structure Panel
  - کلاس
  - تغییر نده
  - نتیجه مورد انتظار
  - تایید مورد نیاز

hide_in_normal_batch:
  - element_generation
  - element_generation_source
  - input_authorization
  - package_digest
  - confirmed_action_ids
  - Value / evidence status
  - Control path: insufficient_evidence
```

Hidden fields may appear only in `جزئیات فنی`, `بررسی`, `وضعیت`, `CORRECTION`, or debug/repo-maintenance reports.

---

## User-Facing Labels

Use Persian headings and preserve English technical identifiers.

```yaml
Target: هدف
Parent: داخل
Elementor element type: نوع عنصر
Structure Panel name: نام در Structure Panel
Active class: کلاس
Do not change: تغییر نده
Expected result: نتیجه مورد انتظار
```

Do not show `Elementor element type: Container` as an executable UI instruction when the user's Atomic UI uses labels such as `Flexbox`, `Div block`, `Flex`, or `Div`.

---

## Architecture Term vs UI Label

Separate the architecture term from the executable UI label.

```yaml
architecture_element_type:
  example: Container
  use: internal/package meaning

user_facing_ui_label:
  example: Flexbox | Div block | Flex | Div
  use: what the user sees/clicks in Elementor
```

Normal builder batches should show the `user_facing_ui_label`.

If unknown, use a safe wording:

```text
نوع عنصر: Flexbox یا Div block — طبق UI فعلی تو
```

If the user has already confirmed the label, use it directly:

```text
نوع عنصر: Flexbox
```

---

## UI Vocabulary Sync

Use a short vocabulary sync only when the next action needs a layout-parent element and `ui_vocabulary_map.layout_parent` is unknown.

```text
قبل از ادامه، یک سؤال کوتاه:
در UI فعلی Elementor برای ساخت گروه/layout، چه گزینه‌هایی می‌بینی؟
مثلاً `Flexbox`، `Div block`، `Flex`، `Div`، `Container` یا `Grid`.
```

After the user answers, record:

```yaml
ui_vocabulary_map:
  - vocabulary_key: layout_parent
    architecture_term: Container
    user_ui_label:
    confirmed_by: user_statement
    confirmed_at_checkpoint:
    status: confirmed
```

Do not ask again in the same session if the map is confirmed.

---

## Normal Batch Template

Use this compact shape for normal build actions:

```text
[STATE workflow=APPROVED_HANDOFF_MODE state=WAITING_FOR_CONFIRMATION cp=CP-001 batch=BATCH-002 risk=low]

موقعیت: Section ← Stage ← Content Layer ← اینجا

اقدام ۱ — ساخت گروه کارت‌ها
هدف: Smart Home Section / Feature Cards Group
داخل: Smart Home Section / Content Layer
نوع عنصر: Flexbox یا Div block — طبق UI فعلی تو
نام در Structure Panel: Smart Home Section / Feature Cards Group
کلاس: smart-home__feature-grid--primary
تغییر نده: selected_candidate_id، معماری تاییدشده
نتیجه مورد انتظار: گروه کارت‌ها داخل Content Layer ساخته شود.

بعد از انجام بنویس: `تایید BATCH-002`
اگر مشکل داشتی: `اصلاح` + توضیح کوتاه
```

Rules:
- Keep batches concise.
- Use no long explanation.
- Avoid decorative separators unless they improve readability.
- End active builder batches with exactly one confirmation token request or one targeted screenshot request.
- Do not append `SMART_GUIDANCE_FOOTER` after an active builder batch.

---

## Unknown Control Handling

Do not show:

```text
Control path: CSS Classes field — exact panel path: insufficient_evidence
```

Use an actionable sentence instead:

```text
کلاس را در فیلد CSS Classes وارد کن. اگر این فیلد را نمی‌بینی، screenshot از پنل همان element بفرست.
```

If the control is version-sensitive or missing, stop and request evidence or enter `CORRECTION`.

---

## Confirmation Token Echo

After a valid confirmation token, do not explain checkpoint scope or checkpoint loop.

Use only:

```text
✓ تایید شد — ادامه می‌دهیم.
```

or:

```text
BATCH-001 تایید شد. مرحله بعد:
```

Then provide the next batch only if no blocker exists.

Technical confirmation details belong in `وضعیت`, `بررسی`, or `جزئیات فنی`.

---

## Progress and Breadcrumb

Use one-line breadcrumb in structural batches when useful:

```text
موقعیت: Section ← Stage ← Content Layer ← اینجا
```

Progress may be shown only when the total is known from the package/checkpoint.

Allowed:

```text
پیشرفت ساختار: ۳ از ۷ بخش تایید شده
```

Do not invent percentages.

---

## Technical Details Mode

Show hidden/internal fields only when:
- user says `جزئیات فنی` or `جزئیات`;
- runtime_state is `CORRECTION` and the internal evidence/source matters;
- runtime_state is `EVIDENCE_REQUIRED` and the blocking evidence must be explained;
- user asks `بررسی` or `وضعیت`.

Normal build output must remain user-facing.
