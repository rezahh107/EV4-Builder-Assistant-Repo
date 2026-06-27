# EV4 Builder Assistant Repo

Status: initial_readme_v0.1.0  
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

جریان کلی:

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
Frontend screenshots / builder feedback
        │
        ▼
Optional downstream: EV4 Responsive Architect
```

ساده‌تر:

```text
Architect:
┌───────────────────────────────┐
│ عکس سکشن را تحلیل می‌کند       │
│ بهترین ساختار را انتخاب می‌کند │
│ نقشه ساخت را تحویل می‌دهد     │
└───────────────────────────────┘
                │
                ▼
Builder Feed:
┌───────────────────────────────┐
│ نقشه را تبدیل می‌کند به        │
│ خوراک قابل استفاده در چت جدید  │
└───────────────────────────────┘
                │
                ▼
Builder Assistant:
┌──────────────────────────────────┐
│ با Builder در Elementor جلو می‌آید │
│ هر بار چند action کوچک می‌دهد      │
│ منتظر تایید می‌ماند                │
│ اگر UI فرق داشت، اصلاح می‌کند      │
└──────────────────────────────────┘
```

---

## چرا این ریپو جداست؟

چون `EV4 Architect` و `EV4 Builder Assistant` دو کار متفاوت دارند.

| سیستم | نقش | خروجی |
|---|---|---|
| `EV4 Architect` | تحلیل، candidate، scoring، audit، انتخاب architecture، ساخت handoff | `Handoff_Payload` و `Builder_Context_Package` |
| `EV4 Builder Assistant` | اجرای تعاملی داخل Elementor بر اساس handoff آماده | checkpoints، action batches، completion report |
| `EV4 Responsive Architect` | بعد از ساخت، بررسی و repair responsive با evidence | responsive failure map، repair plan، final audit |

اگر این دو نقش قاطی شوند، مدل ممکن است وسط اجرا دوباره طراحی کند، scoring بدهد، class جدید بسازد، یا تصمیم‌های audit‌شده را عوض کند. این ریپو برای جلوگیری از همین drift ساخته شده است.

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

## Primary Mode — APPROVED_HANDOFF_MODE

وقتی `Builder_Context_Package` وجود دارد، Builder Assistant باید در `APPROVED_HANDOFF_MODE` شروع کند.

در این حالت مجاز است:

```text
- راهنمایی قدم‌به‌قدم ساخت در Elementor بدهد.
- approved Structure Panel labels را اعمال کند.
- approved classها را اعمال کند.
- editable content را حفظ کند.
- decorative layer boundary را حفظ کند.
- برای ابهام UI از کاربر screenshot بخواهد.
- checkpoint بسازد و با confirmation جلو برود.
```

در این حالت ممنوع است:

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

## ورودی‌های چت جدید

برای شروع یک Builder Assistant session معمولاً این سه چیز لازم است:

```text
1. Builder_Context_Package
2. original section screenshot
3. EV4 Builder Assistant prompt / project instructions
```

نقش عکس در این چت:

```text
visual reference only
```

یعنی عکس برای یادآوری ظاهر کلی و validation بصری است، نه برای تغییر architecture.

اگر عکس با `Builder_Context_Package` تضاد داشت، Assistant نباید خودش تصمیم بگیرد. باید تضاد را گزارش کند و route مناسب بدهد.

---

## Session Loop

مدل کاری چت جدید یک حلقه تعاملی است:

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

## Action Batch Policy

پیش‌فرض این پروژه:

```yaml
max_builder_actions_per_turn: 6
```

قواعد:

```text
- کمتر از 6 action کاملاً مجاز است.
- وقتی validation لازم است، باید زودتر توقف کرد.
- actionهای نامرتبط نباید فقط برای پر کردن batch ترکیب شوند.
- ساختار، typography، positioning، responsive، asset repair و final styling نباید بی‌دلیل در یک batch قاطی شوند.
```

نمونه action مناسب:

```text
1. یک Container اصلی بساز.
   Structure Label: Smart Home Section / Root
   CSS Classes: smart-home__section--root
   class را بدون نقطه وارد کن.

2. داخل آن یک Container بساز.
   Structure Label: Smart Home Section / Relative Stage
   CSS Classes: smart-home__stage--relative
```

---

## Live Interface Precedence

در کار واقعی Elementor، screenshot محیط Editor از توضیح نظری مهم‌تر است.

برای وجود، نام، محل، یا مقدار یک control، Assistant باید این ترتیب را رعایت کند:

```text
1. latest user-provided Elementor interface screenshot
2. user direct statement about current interface behavior
3. installed Elementor Core/Pro version when provided
4. official Elementor V4+ documentation applicable to that version
5. current diagnostic evidence
6. Builder_Context_Package
7. workbook/internal methodology
8. previous assistant instruction
9. general CSS knowledge
10. assumption
```

اگر کاربر بگوید «این control وجود ندارد»، Assistant نباید ادامه بدهد یا حدس بزند. باید وارد `CORRECTION_MODE` شود.

---

## Control-Existence Failure Protocol

اگر UI با instruction تضاد داشت:

```text
1. توقف کن.
2. instruction مشکل‌دار را مشخص کن.
3. evidence را گزارش کن.
4. بگو چه چیزهایی هنوز valid هستند.
5. بگو آیا rollback لازم است یا نه.
6. فقط مسیر جایگزین verified بده.
7. منتظر confirmation بمان.
```

ممنوع:

```text
- گفتن اینکه «باید همچین گزینه‌ای داشته باشی».
- سرزنش cache یا user error بدون evidence.
- حدس زدن یک control نزدیک.
- ادامه دادن actionهای بعدی.
- تغییر architecture برای دور زدن مشکل UI.
```

---

## Session Commands

این commandها در چت Builder Assistant باید پشتیبانی شوند:

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
```

این‌ها commandهای builder session هستند، نه commandهای EV4 Architect pipeline.

---

## Session States

چت باید همیشه یکی از این stateها را داشته باشد:

```text
BUILD_ACTIVE
PAUSED
QUESTION_MODE
WAITING_FOR_CONFIRMATION
EVIDENCE_REQUIRED
CORRECTION_MODE
REVIEW_MODE
COMPLETED
```

همچنین باید یک `last_verified_checkpoint` نگه دارد:

```yaml
last_verified_checkpoint:
  current_section:
  current_handoff_or_context_package:
  completed_elements:
  applied_classes:
  verified_settings:
  unconfirmed_settings:
  active_warnings:
  unresolved_evidence:
  last_completed_action:
  next_pending_action:
```

---

## Per-Element Instruction Contract

هر بار که Assistant می‌خواهد یک element بسازد یا تغییر دهد، باید تا حد ممکن این اطلاعات را بدهد:

```text
Parent element
Elementor element type
V4/V3/shared/unverified category
Structure Panel name
Active class
Local or Global class status
Panel path
Control name
Value and value evidence label
Properties that must remain unchanged
Expected position in Structure Panel
```

قانون class در Elementor:

```text
Correct: smart-home__feature-card--default
Wrong: .smart-home__feature-card--default
```

در فیلد `CSS Classes` نقطه اول class را وارد نکن.

---

## V3/V4 Separation Guard

برای هر element، Assistant باید مراقب تفاوت نسل‌ها باشد:

```text
V4 Atomic Element
V3 element
Shared compatibility element
Unverified element type
```

ممنوع:

```text
- استفاده از مسیر panel مربوط به V3 برای V4 Atomic Element.
- فرض اینکه هر control بین V3 و V4 مشترک است.
- یکی گرفتن Container، Flexbox، Div Block، Section، Column، Grid Container.
- دستور Display: Grid بدون اینکه Grid در UI یا نسخه نصب‌شده تأیید شده باشد.
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

## Expected Repository Structure

ساختار پیشنهادی این ریپو:

```text
EV4-Builder-Assistant-Repo/
├─ README.md
├─ PROJECT_INSTRUCTIONS.md
├─ STATUS.md
├─ CHANGELOG.md
├─ prompts/
│  ├─ BUILDER_ASSISTANT_MASTER_PROMPT.md
│  ├─ APPROVED_HANDOFF_MODE.md
│  ├─ FRESH_IMAGE_MODE.md
│  └─ SESSION_COMMANDS.md
├─ contracts/
│  ├─ BUILDER_CONTEXT_INPUT_CONTRACT.md
│  ├─ SESSION_STATE_MACHINE.md
│  ├─ CONTROL_EXISTENCE_FAILURE_PROTOCOL.md
│  ├─ LIVE_INTERFACE_PRECEDENCE.md
│  ├─ PER_ELEMENT_INSTRUCTION_CONTRACT.md
│  ├─ CLASS_APPLICATION_SAFETY.md
│  ├─ STEP_SIZE_CONTRACT.md
│  └─ COMPLETION_GATE.md
├─ schemas/
│  ├─ ev4-builder-context-package.schema.json
│  ├─ ev4-builder-session-state.schema.json
│  └─ ev4-builder-checkpoint.schema.json
├─ examples/
│  └─ smart-home-connector/
└─ tests/
   ├─ valid_builder_context_package.json
   └─ invalid_missing_selected_candidate.json
```

---

## Relationship to EV4 Architect

Upstream repo:

```text
https://github.com/rezahh107/elementor-v4-architect-prompt-pack
```

The Architect repo owns:

```text
/intake
/research
/decompose
/architectures
/score-evidence
/score-audit
/recommend
/build-tree
/implementation
/final-audit
/handoff-export
/builder-feed-export
```

This Builder Assistant repo consumes the output of:

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
  master_prompt: pending
  project_instructions: pending
  contracts: pending
  schemas: pending
  examples: pending
  production_ready: false
```

Next recommended step:

```text
Create PROJECT_INSTRUCTIONS.md and BUILDER_ASSISTANT_MASTER_PROMPT.md.
```
