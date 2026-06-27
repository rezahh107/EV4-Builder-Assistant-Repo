# EV4 Builder Assistant Repo

Status: reference_layer_v0.2.3  
Role: interactive_elementor_execution_assistant  
Primary input package: `Builder_Context_Package`  
Primary mode: `APPROVED_HANDOFF_MODE`

---

## خلاصه ساده

`EV4 Builder Assistant` معمار نیست؛ **استادکار تعاملی Elementor** است.

```text
Architect می‌گوید چه بساز.
Builder Assistant می‌گوید الان دقیقاً چه action کوچکی انجام بده.
```

نقش این ریپو اجرای قدم‌به‌قدم معماری تأییدشده در Elementor است، نه تحلیل دوباره معماری.

---

## اصل جدید v0.2.3

```text
Official Elementor docs = منبع اصلی خارجی برای قابلیت‌ها و استانداردهای Elementor
Current Elementor UI = منبع اصلی برای اینکه الان چه چیزی واقعاً قابل انتخاب است
Builder_Context_Package = منبع اصلی ساختار تأییدشده پروژه
Workbook/Case Memory = مرجع آموزشی و روش‌شناسی، نه سند قطعی کنترل‌های زنده
```

---

## Runtime Repository Structure

```text
EV4-Builder-Assistant-Repo/
├─ README.md
├─ PROJECT_INSTRUCTIONS.md
├─ STATUS.md
├─ CHANGELOG.md
├─ package.json
├─ core/
├─ modes/
├─ protocols/
├─ input-contracts/
├─ commands/
├─ schemas/
├─ scripts/
├─ examples/
├─ tests/
├─ docs/
├─ references/
│  └─ tuya-workbook/
├─ cases/
│  └─ tuya-step-by-step/
└─ .github/workflows/
```

---

## Added Reference Layer

```text
references/tuya-workbook/README.md
references/tuya-workbook/WORKBOOK_USAGE_POLICY.md
references/tuya-workbook/WORKBOOK_LESSON_INDEX.md
references/tuya-workbook/EXTRACTED_BUILDER_RULES.md
cases/tuya-step-by-step/CASE_LESSONS.md
cases/tuya-step-by-step/CASE_PATCH_MAP.md
```

---

## Added Protocols

```text
protocols/OFFICIAL_ELEMENTOR_DOCS_PRIORITY.md
protocols/WORKBOOK_REFERENCE_BOUNDARY.md
protocols/RISK_ADJUSTED_STEP_SIZE.md
protocols/STYLE_SYSTEM_CAPABILITY_GATE.md
protocols/CONTROLLED_OVERLAY_STAGE_PATTERN.md
protocols/REPEATED_ELEMENT_DUPLICATION_PROTOCOL.md
protocols/RESPONSIVE_WORKFLOW_GUARD.md
protocols/READING_ORDER_CHECKLIST.md
```

---

## Validation

The repo validates schema shape, negative fixtures, checkpoint fixtures, and cross-field package integrity.

```text
schemas/builder-context-package.schema.json
tests/valid/builder_context_package.json
tests/valid/checkpoint.json
tests/invalid/*.json
tests/invalid-cross-field/*.json
scripts/validate-package.mjs
.github/workflows/schema-validation.yml
docs/CI_VALIDATION_RUNBOOK.md
```

Local commands:

```text
npm run validate:cross-field
npm run validate:builder-context
npm run validate:checkpoint
```

---

## Action Batch Policy

```text
default: up to 5 small related actions
medium-risk styling: up to 2 actions
high-risk visual/responsive/overlay/SVG tuning: 1 action
missing control or insufficient evidence: 0 actions, ask for evidence
```

---

## Session Commands

```text
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

`N` فقط از 1 تا 5 مجاز است.

---

## Completion Gate

Builder Assistant نباید در پایان بگوید «production-ready شد» مگر evidence لازم وجود داشته باشد.

هر مورد فقط یکی از این statusها را می‌گیرد:

```text
confirmed
not_checked
insufficient_evidence
not_applicable
```

---

## Current Status

```yaml
project_status:
  repo_ready_for_controlled_use: true
  official_elementor_docs_priority: added
  workbook_reference_layer: added
  tuya_case_memory: added
  risk_adjusted_step_size: added
  action_default_max: 5
  schema_validation_workflow: passed_user_reported
  real_elementor_execution: not_run
  production_ready: false
```

Next recommended step:

```text
Run or continue the first real Builder Assistant session, then record actual Elementor findings in examples/smart-home-connector/notes.md.
```
