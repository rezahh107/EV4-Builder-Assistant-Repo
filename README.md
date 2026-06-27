# EV4 Builder Assistant Repo

Status: mode_state_intake_foundation_added_v0.3.0  
Role: interactive_elementor_execution_assistant  
Primary input package: `Builder_Context_Package`  
Primary workflow mode after valid intake: `APPROVED_HANDOFF_MODE`

---

## خلاصه ساده

`EV4 Builder Assistant` معمار نیست؛ **استادکار تعاملی Elementor** است.

```text
Architect می‌گوید چه بساز.
Builder Assistant می‌گوید الان دقیقاً چه action کوچکی انجام بده.
```

نقش این repo اجرای قدم‌به‌قدم معماری تأییدشده در Elementor است، نه تحلیل دوباره معماری.

---

## اصل v0.3.0

Patch 1 foundation دو مفهوم را جدا می‌کند:

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

```text
workflow_mode = کدام workflow فعال است
runtime_state = الان داخل آن workflow چه اتفاقی در جریان است
```

`CORRECTION_MODE` و `REVIEW_MODE` فقط legacy aliases هستند:

```yaml
CORRECTION_MODE: CORRECTION
REVIEW_MODE: REVIEW_ONLY
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

## Key Runtime Files

```text
core/MODE_STATE_MATRIX.md
core/SESSION_STATE_MACHINE.md
core/MASTER_PROMPT.md
input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md
docs/START_INTAKE_POLICY.md
protocols/NEW_CHAT_START_INTAKE.md
commands/SESSION_COMMANDS.md
```

---

## Intake Foundation

Fresh-chat intake starts with:

```text
شروع
```

The assistant must inspect pasted/attached data before asking again, must not re-request valid data already provided, and must ask only for blocking missing items.

When inputs are partial, it uses a compact:

```text
intake_checklist
```

When intake is evaluated, it uses:

```text
schemas/intake-result.schema.json
```

---

## STATE_CAPSULE

Builder-session replies may include a compact one-line state capsule when session state matters:

```text
[STATE workflow=APPROVED_HANDOFF_MODE state=WAITING_FOR_CONFIRMATION cp=CP-001 batch=BATCH-001 risk=low]
```

It is not a checkpoint replacement.

---

## Validation

The repo validates schema shape, negative fixtures, checkpoint fixtures, intake result fixtures, and cross-field package integrity.

```text
schemas/builder-context-package.schema.json
schemas/session-state.schema.json
schemas/checkpoint.schema.json
schemas/intake-result.schema.json
tests/valid/builder_context_package.json
tests/valid/checkpoint.json
tests/valid/intake_result_approved_with_optional_gaps.json
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
npm run validate:intake-result
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
  mode_state_matrix: added
  state_capsule_rule: added
  intake_checklist: added
  intake_result_schema: added
  schema_validation_workflow: updated_for_intake_result
  real_elementor_execution: not_run
  production_ready: false
```

Next recommended step:

```text
Run GitHub Actions schema validation for v0.3.0, then continue only with the next explicitly requested patch.
```
