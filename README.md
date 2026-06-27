# EV4 Builder Assistant Repo

Status: example_and_validation_seed_v0.2.0  
Role: interactive_elementor_execution_assistant  
Primary upstream: [`elementor-v4-architect-prompt-pack`](https://github.com/rezahh107/elementor-v4-architect-prompt-pack)  
Primary input package: `Builder_Context_Package`  
Primary mode: `APPROVED_HANDOFF_MODE`

---

## خلاصه ساده

`EV4 Builder Assistant` معمار نیست؛ **استادکار تعاملی Elementor** است.

معمار می‌گوید:

```text
چه چیزی باید ساخته شود؟
کدام architecture انتخاب شده؟
کدام Structure Panel tree تأیید شده؟
کدام classها مجازند؟
کدام بخش‌ها editable هستند؟
کدام بخش‌ها decorative هستند؟
چه چیزهایی هنوز unknown هستند؟
```

Builder Assistant می‌گوید:

```text
الان این Container را بساز.
Structure Label را این بگذار.
این class را بدون نقطه وارد کن.
بعد از انجام، تایید کن تا برویم مرحله بعد.
```

بنابراین نقش این ریپو **اجرای قدم‌به‌قدم معماری تأییدشده در Elementor** است، نه تحلیل دوباره معماری.

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
│
├─ core/
│  ├─ MASTER_PROMPT.md
│  ├─ SESSION_STATE_MACHINE.md
│  └─ LIVE_INTERFACE_PRECEDENCE.md
│
├─ modes/
│  ├─ APPROVED_HANDOFF_MODE.md
│  ├─ CORRECTION_MODE.md
│  └─ FRESH_IMAGE_MODE.md
│
├─ protocols/
│  ├─ CONTROL_EXISTENCE_FAILURE.md
│  ├─ COMPLETION_GATE.md
│  ├─ CLASS_APPLICATION_SAFETY.md
│  ├─ STEP_SIZE_CONTRACT.md
│  ├─ PER_ELEMENT_INSTRUCTION.md
│  ├─ LAYOUT_COMPLETENESS_CHECKLIST.md
│  └─ V3_V4_SEPARATION_GUARD.md
│
├─ input-contracts/
│  └─ BUILDER_CONTEXT_INPUT_CONTRACT.md
│
├─ commands/
│  └─ SESSION_COMMANDS.md
│
├─ schemas/
│  ├─ builder-context-package.schema.json
│  ├─ session-state.schema.json
│  └─ checkpoint.schema.json
│
├─ examples/
│  ├─ _template/
│  └─ smart-home-connector/
│
├─ tests/
│  ├─ valid/
│  └─ invalid/
│
├─ docs/
│  └─ REPOSITORY_GUIDE.md
│
└─ .github/workflows/
   └─ schema-validation.yml
```

---

## Current Validation Seed

The repository now includes:

```text
schemas/builder-context-package.schema.json
tests/valid/builder_context_package.json
tests/invalid/missing_selected_candidate.json
.github/workflows/schema-validation.yml
```

The workflow validates that:

```text
- the valid Builder_Context_Package fixture passes;
- the missing selected_candidate_id fixture fails;
- session-state.schema.json compiles with checkpoint.schema.json.
```

---

## Examples

### `_template`

Reusable starting point for future examples:

```text
examples/_template/README.md
examples/_template/start_session_prompt.md
examples/_template/builder_context_package.template.json
```

### `smart-home-connector`

Seed example for the Smart Home Connector section:

```text
examples/smart-home-connector/README.md
examples/smart-home-connector/builder_context_package.json
examples/smart-home-connector/start_session_prompt.md
examples/smart-home-connector/expected_first_response.md
examples/smart-home-connector/notes.md
```

This example uses `ARCH-FAM-C` and remains a builder execution example, not a new architecture analysis.

---

## Important Runtime Fixes

```text
- element_generation is required for approved_structure_tree nodes.
- element_generation is required for first_builder_batch actions.
- widget_mapping_table requires at least one item.
- selected_candidate_locked must be true for valid packages.
- reset scopes are explicit.
- FRESH_IMAGE_MODE is fallback-only.
```

---

## Required Inputs for a New Chat

```text
1. Builder_Context_Package
2. original section screenshot
3. EV4 Builder Assistant Project Instructions / Master Prompt
```

The screenshot is:

```text
visual reference only
```

unless it is a current Elementor editor/frontend evidence screenshot.

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

## Relationship to EV4 Architect

Upstream repo:

```text
https://github.com/rezahh107/elementor-v4-architect-prompt-pack
```

This Builder Assistant repo consumes:

```text
/builder-feed-export → Builder_Context_Package
```

---

## Current Status

```yaml
project_status:
  repo_initialized: true
  examples_template: added
  smart_home_example: added_seed
  valid_fixture: added
  invalid_fixture: added
  schema_validation_workflow: added
  production_ready: false
```

Next recommended step:

```text
Wait for GitHub Actions result, then fix workflow/schema/fixtures if CI reports anything.
```
