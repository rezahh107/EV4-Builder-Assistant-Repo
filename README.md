# EV4 Builder Assistant Repo

Status: review_fixes_applied_v0.1.1  
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

## تصویر ذهنی سیستم

```text
EV4 Architect Repo
= دفتر مهندسی / معمار / ناظر

EV4 Builder Assistant Repo
= استادکار کنار دست تو داخل Elementor
```

```text
[Reference Section Screenshot]
        │
        ▼
EV4 Architect Pipeline
/intake → /decompose → /architectures → /score-evidence → /score-audit
→ /recommend → /build-tree → /implementation → /final-audit → /handoff-export
        │
        ▼
/builder-feed-export
        │
        ▼
Builder_Context_Package
        │
        ▼
New Chat / EV4 Builder Assistant Project
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

یا ساده‌تر:

```text
Architect می‌گوید «چه بساز».
Builder Assistant می‌گوید «الان دقیقاً چه بساز و کجا تایید بگیر».
```

---

## Runtime Repository Structure

این ریپو بر اساس runtime flow سازمان‌دهی شده است، نه صرفاً بر اساس نوع فایل.

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
│  └─ CORRECTION_MODE.md
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
└─ docs/
   └─ REPOSITORY_GUIDE.md
```

Pending planned folders/files:

```text
modes/FRESH_IMAGE_MODE.md
examples/_template/
examples/smart-home-connector/
tests/valid/
tests/invalid/
```

---

## Review Fixes in v0.1.1

```text
- builder-context-package.schema.json اضافه شد.
- max_actions_per_turn صریحاً به 1..6 محدود شد.
- commandهای یک پله تا شش پله به SESSION_COMMANDS اضافه شدند.
- Data vs Instruction Rule در MASTER_PROMPT canonical شد.
- رفتار Unverified element type تعریف شد.
- correction output shapes یکپارچه شد و همه زیر correction_response قرار گرفتند.
```

---

## مهم‌ترین فایل‌ها

### `PROJECT_INSTRUCTIONS.md`

خلاصه اجرایی همیشه‌فعال برای ChatGPT Project. این فایل باید در تنظیمات Project استفاده شود.

### `core/MASTER_PROMPT.md`

پرامپت runtime اصلی. `Data vs Instruction Rule` canonical در این فایل است.

### `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md`

قبل از شروع session بررسی می‌کند که `Builder_Context_Package` معتبر و کافی است یا نه.

### `schemas/builder-context-package.schema.json`

schema اصلی برای اعتبارسنجی پکیج ورودی خروجی `/builder-feed-export`.

### `commands/SESSION_COMMANDS.md`

فرمان‌های session از جمله `توقف`، `ادامه`، `تایید`، `اصلاح` و تنظیم تعداد actionها با `یک پله` تا `شش پله`.

### `modes/CORRECTION_MODE.md`

حالت اصلاح با خروجی canonical `correction_response`.

### `docs/REPOSITORY_GUIDE.md`

راهنمای زنده ریپو؛ در آخرین مرحله باید به راهنمای کامل نهایی تبدیل شود.

---

## Primary Mode — APPROVED_HANDOFF_MODE

وقتی `Builder_Context_Package` وجود دارد، Builder Assistant باید در `APPROVED_HANDOFF_MODE` شروع کند.

مجاز است:

```text
- راهنمایی قدم‌به‌قدم ساخت در Elementor بدهد.
- approved Structure Panel labels را اعمال کند.
- approved classها را اعمال کند.
- editable content را حفظ کند.
- decorative layer boundary را حفظ کند.
- برای ابهام UI از کاربر screenshot بخواهد.
- checkpoint بسازد و با confirmation جلو برود.
```

ممنوع است:

```text
- scoring را دوباره اجرا کند.
- recommendation را دوباره اجرا کند.
- selected_candidate را تغییر دهد.
- architecture را redesign کند.
- approved classها را حذف یا اضافه کند.
- meaningful text را به SVG/image/HTML تبدیل کند.
- cards را clickable فرض کند.
- Dynamic Loop را بدون data source تأییدشده فرض کند.
- mobile connector behavior را حدس بزند.
- production readiness claim کند.
```

---

## Required Inputs for a New Chat

```text
1. Builder_Context_Package
2. original section screenshot
3. EV4 Builder Assistant Project Instructions / Master Prompt
```

نقش عکس در این چت:

```text
visual reference only
```

یعنی عکس برای یادآوری ظاهر کلی و validation بصری است، نه برای تغییر architecture.

---

## Session Loop

```text
Action Batch
    │
    ▼
Builder اجرا می‌کند
    │
    ▼
تایید / screenshot / گزارش مشکل
    │
    ▼
Builder Assistant checkpoint می‌سازد
    │
    ▼
Batch بعدی
```

هیچ actionی بدون evidence یا confirmation نباید verified فرض شود.

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

Then it turns that package into a controlled interactive Elementor build session.

---

## Relationship to EV4 Responsive Architect

`EV4 Responsive Architect` is downstream of real builder execution.

Builder Assistant output can later feed responsive validation:

```text
Builder completed structure
+ frontend screenshots
+ tablet/mobile screenshots
+ builder feedback
        │
        ▼
EV4 Responsive Architect
```

This repo does not perform full responsive repair. It may collect evidence and report unchecked responsive items, but actual responsive repair belongs to the responsive pipeline.

---

## Current Status

```yaml
project_status:
  repo_initialized: true
  readme_initialized: true
  review_fixes_applied: true
  project_instructions: active_initial_v0.1.1
  master_prompt: active_initial_v0.1.1
  input_contracts: active_initial_v0.1.1
  core_files: active_initial
  modes: partial_initial_v0.1.1
  protocols: partial_initial_v0.1.1
  commands: active_initial_v0.1.1
  schemas: initial_with_builder_context_package
  examples: pending
  tests: pending
  production_ready: false
```

Next recommended step:

```text
Create examples/_template and examples/smart-home-connector using a real Builder_Context_Package.
```
