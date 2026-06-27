# EV4 Builder Assistant Repo

Status: hardening_pass_v0.2.1  
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

## جریان کلی

```text
EV4 Architect Pipeline
        │
        ▼
/builder-feed-export
        │
        ▼
Builder_Context_Package
        │
        ▼
EV4 Builder Assistant Project
        │
        ▼
Interactive Elementor Build
        │
        ▼
Optional downstream: EV4 Responsive Architect
```

---

## قانون اصلی

```text
Builder Assistant تصمیم‌گیر معماری نیست؛
مجری کنترل‌شده معماری تاییدشده است.
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
│  └─ validate-package.mjs
├─ examples/
│  ├─ _template/
│  └─ smart-home-connector/
├─ tests/
│  ├─ valid/
│  ├─ invalid/
│  └─ invalid-cross-field/
├─ docs/
│  ├─ REPOSITORY_GUIDE.md
│  └─ CI_VALIDATION_RUNBOOK.md
└─ .github/workflows/
   └─ schema-validation.yml
```

---

## Validation in v0.2.1

The repo now validates both schema shape and cross-field package integrity.

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

Checks include:

```text
valid package passes
Smart Home example package passes
invalid package fixtures fail
valid checkpoint passes
invalid checkpoint fails
session-state schema compiles with checkpoint schema
cross-field package integrity passes
cross-field invalid fixtures fail
```

Cross-field validation checks:

```text
duplicate node_id
duplicate action_id
child node references
class map node references
first batch target references
action active_class references
widget class references
element_generation / element_generation_source consistency
```

Local commands:

```text
npm run validate:cross-field
npm run validate:builder-context
npm run validate:checkpoint
```

Manual GitHub Actions run:

```text
Actions → Schema validation → Run workflow → branch main
```

---

## Important Runtime Fixes

```text
element_generation is required for approved_structure_tree nodes.
element_generation_source is required for approved_structure_tree nodes.
element_generation is required for first_builder_batch actions.
element_generation_source is required for first_builder_batch actions.
widget_mapping_table requires at least one item.
selected_candidate_locked must be true for valid packages.
reset scopes are explicit.
FRESH_IMAGE_MODE is fallback-only.
Architect repo schema is synchronized with this consumer schema.
```

---

## Examples

```text
examples/_template/
examples/smart-home-connector/
```

The Smart Home example uses `ARCH-FAM-C` and remains a builder execution example, not a new architecture analysis.

---

## Required Inputs for a New Chat

```text
1. Builder_Context_Package
2. original section screenshot
3. EV4 Builder Assistant Project Instructions / Master Prompt
```

The original section screenshot is `visual_reference_only` unless it is a current Elementor editor/frontend evidence screenshot.

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
شش پله
تعداد پله: N
```

`N` فقط از 1 تا 6 مجاز است.

Reset scopes:

```text
full_session_reset
checkpoint_only_reset
class_map_reset
not_confirmed
```

---

## Completion Gate

Builder Assistant نباید در پایان بگوید «production-ready شد» مگر evidence لازم وجود داشته باشد.

در پایان باید وضعیت‌ها را جداگانه گزارش کند:

```text
Structure completed
Classes applied
Desktop frontend checked
Tablet checked
Mobile checked
Accessibility semantics checked
SVG safety checked
Browser rendering checked
Real Elementor export checked
EDIS validation checked
Exact pixel matching checked
```

هر مورد فقط یکی از این statusها را می‌گیرد:

```text
confirmed
not_checked
insufficient_evidence
not_applicable
```

---

## Upstream Sync

This repo consumes:

```text
/builder-feed-export → Builder_Context_Package
```

The upstream Architect repo has been synchronized through:

```text
stages/11_BUILDER_FEED_EXPORT_v1.1_HARDENING_PATCH.md
schemas/ev4-builder-context-package.schema.json
```

---

## Current Status

```yaml
project_status:
  examples_template: added
  smart_home_example: added_seed_hardened
  valid_fixture: added
  invalid_fixtures: expanded
  invalid_cross_field_fixture: added
  checkpoint_fixtures: added
  cross_field_validator: added
  schema_validation_workflow: hardened_with_manual_run
  architect_schema_sync: applied
  production_ready: false
```

Next recommended step:

```text
Run Schema validation manually from GitHub Actions. If it passes, start a real Smart Home Builder Assistant session and record findings. If it fails, use docs/CI_VALIDATION_RUNBOOK.md for triage.
```
