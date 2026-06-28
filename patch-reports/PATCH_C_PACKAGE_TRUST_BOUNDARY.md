# Patch C — Package Trust Boundary & Structured Confirmation

## Branch

`patch/c-package-trust-boundary`

Base branch: `main`

## Hardening commits

- `2b36ba157c82a7fc00162e6d513f863465f6263c` — `Patch C audit: align master prompt with structured confirmation`
- `e38d96897c449f6070b336d15a7990e6691da0ad` — `Patch C hardening: scan nested display-only legacy text`
- `c8f6c39c3eec21ff777580b6dda2816007d2931f` — `Patch C hardening: add nested display-only injection fixture`

## خلاصه

Patch C مرز اعتماد `Builder_Context_Package` را سخت‌تر کرد تا محتوای package فقط به‌عنوان data مصرف شود، نه runtime instruction. مسیر قبلی که در آن `builder_assistant_prompt_seed` و `confirmation_sentence` می‌توانستند نقش کانال instruction-smuggling داشته باشند، با `confirmation_request` ساختاریافته جایگزین شد.

## موارد deprecated

- `builder_assistant_prompt_seed`
  - از required schema حذف شد.
  - به‌عنوان legacy/deprecated و untrusted display-only علامت‌گذاری شد.
  - validator در صورت وجود آن warning می‌دهد.
  - اگر شامل prompt-injection marker باشد، cross-field validation را fail می‌کند.
  - `core/MASTER_PROMPT.md` نیز اکنون اجرای آن را صراحتاً forbidden می‌کند.

- `confirmation_sentence`
  - از required canonical path حذف شد.
  - برای compatibility نگه داشته شد، اما فقط display-only و untrusted است.
  - runtime نباید آن را به‌عنوان exact confirmation prompt یا command اجرا کند.
  - اگر شامل command-like text مثل `ادامه`، `ریست`، `شروع`، `استارت` یا role-changing text باشد، cross-field validation fail می‌شود.
  - `core/MASTER_PROMPT.md` اکنون structured confirmation را به‌عنوان runtime path معرفی می‌کند.

- `display_only_untrusted_text.*`
  - فقط compatibility/display-only است.
  - hardening pass اضافه کرد که nested legacy text هم مثل top-level legacy fields scan شود.
  - `display_only_untrusted_text.builder_assistant_prompt_seed` و `display_only_untrusted_text.confirmation_sentence` اگر prompt-injection یا command-like content داشته باشند، cross-field validation را fail می‌کنند.

## جایگزین canonical

ساختار canonical جدید:

```yaml
confirmation_request:
  confirmation_id: CONFIRM-BATCH-001
  confirmed_action_ids:
    - BATCH-001-A01
    - BATCH-001-A02
  expected_user_token: "تایید BATCH-001"
  template_id: "standard_batch_confirmation"
```

قواعد enforce شده:

- `confirmation_request.confirmed_action_ids` باید به `first_builder_batch.actions[].action_id` map شود.
- `confirmation_id` برای batchهای استاندارد باید با batch prefix هماهنگ باشد؛ مثال: `CONFIRM-BATCH-001`.
- `expected_user_token` برای batch استاندارد باید مثل `تایید BATCH-001` باشد.
- `template_id` فعلاً فقط `standard_batch_confirmation` است.
- assistant باید confirmation text را از trusted template بسازد، نه از prose داخل package.

## Compatibility notes

برای جلوگیری از شکست ناگهانی packageهای قدیمی:

- schema با `anyOf` اجازه می‌دهد package یا `confirmation_request` داشته باشد یا legacy `confirmation_sentence`.
- packageهای legacy با `confirmation_sentence` همچنان schema-compatible هستند، اما validator warning می‌دهد.
- `display_only_untrusted_text` برای quoted/display-only compatibility مجاز است، اما validator اکنون nested legacy text آن را نیز برای prompt-injection و command-like content بررسی می‌کند.
- `examples/smart-home-connector/builder_context_package.json` عمداً redesign نشد و از compatibility path قابل استفاده می‌ماند؛ validator برای legacy fields warning-level diagnostic می‌دهد، نه fail، مگر اینکه متن legacy حاوی prompt-injection یا command-like content باشد.

## فایل‌های تغییر یافته

- `schemas/builder-context-package.schema.json`
  - اضافه شدن `$defs.confirmation_request`.
  - حذف `builder_assistant_prompt_seed` و `confirmation_sentence` از required canonical path.
  - اضافه شدن `anyOf` برای canonical/legacy compatibility.
  - علامت‌گذاری legacy text fields به‌عنوان deprecated/untrusted.

- `scripts/validate-package.mjs`
  - اضافه شدن warning diagnostics.
  - hardening برای `builder_assistant_prompt_seed` و `confirmation_sentence`.
  - cross-field validation برای `confirmation_request` و mapping آن به action IDs.
  - hardening اضافه‌شده: scan کردن `display_only_untrusted_text.builder_assistant_prompt_seed` و `display_only_untrusted_text.confirmation_sentence`.

- `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md`
  - اضافه شدن Package Trust Boundary.
  - مستندسازی trusted vs untrusted package fields.
  - تغییر confirmation requirement از free-text به structured confirmation.

- `modes/APPROVED_HANDOFF_MODE.md`
  - اضافه شدن Confirmation Trust Boundary.
  - runtime confirmation از `confirmation_request.template_id` و `expected_user_token` تولید می‌شود.

- `core/MASTER_PROMPT.md`
  - PEaC runtime frame از `confirmation sentence` به `structured confirmation_request` اصلاح شد.
  - اجرای `builder_assistant_prompt_seed` و استفاده trusted از `confirmation_sentence` forbidden شد.
  - Builder Batch Response Format اکنون `confirmed_action_ids` و `expected_user_token` را مبنا قرار می‌دهد.

- `package.json`
  - validation scripts حالا `tests/valid/builder_context_package*.json` و example package را پوشش می‌دهند.

- `.github/workflows/schema-validation.yml`
  - CI حالا همه valid builder context package fixtures با pattern جدید را validate می‌کند.

- `tests/valid/builder_context_package.json`
  - به canonical `confirmation_request` migrate شد.
  - legacy `builder_assistant_prompt_seed` حذف شد.

- `tests/valid/builder_context_package_confirmation_request.json`
  - fixture valid جدید برای structured confirmation اضافه شد.

- `tests/invalid-cross-field/malicious_builder_assistant_prompt_seed.json`
  - fixture invalid برای prompt injection داخل `builder_assistant_prompt_seed` اضافه شد.

- `tests/invalid-cross-field/confirmation_sentence_command_like.json`
  - fixture invalid برای command-like و role-changing text داخل `confirmation_sentence` اضافه شد.

- `tests/invalid-cross-field/display_only_untrusted_text_prompt_injection.json`
  - fixture invalid برای prompt-injection/command-like text داخل nested `display_only_untrusted_text` اضافه شد.

## Validation commands run

اجرای connector/GitHub inspection:

```text
GitHub.compare_commits main...patch/c-package-trust-boundary: pass; branch ahead of main and behind_by=0
GitHub.fetch_file scripts/validate-package.mjs: pass
GitHub.fetch_file tests/invalid-cross-field/display_only_untrusted_text_prompt_injection.json: pass
GitHub.fetch_file changed schema/docs/fixtures/report: pass
```

اجرای محلی انجام‌شده قبل از hardening اخیر:

```text
node --check scripts/validate-package.mjs: pass
Python jsonschema Draft202012Validator.check_schema: pass
schema validation for updated/new valid fixtures: pass
schema validation for new invalid-cross-field fixtures: schema-pass as intended
node scripts/validate-package.mjs tests/valid/builder_context_package.json: pass
node scripts/validate-package.mjs tests/valid/builder_context_package_confirmation_request.json: pass
node scripts/validate-package.mjs tests/invalid-cross-field/malicious_builder_assistant_prompt_seed.json: failed as expected
node scripts/validate-package.mjs tests/invalid-cross-field/confirmation_sentence_command_like.json: failed as expected
```

## Failures / skips

- اجرای `git clone` از داخل container برای branch audit به دلیل محدودیت DNS/network محیط شکست خورد: `Could not resolve host: github.com`.
- اجرای مستقیم `npm run validate:builder-context` و `npm run validate:cross-field` داخل container ممکن نبود، چون repository قابل clone نبود.
- GitHub Actions status/workflow run از طریق connector قابل مشاهده نبود؛ این به معنی pass یا fail نیست.

## Remaining risks

- `examples/smart-home-connector/builder_context_package.json` هنوز legacy `confirmation_sentence` و `builder_assistant_prompt_seed` دارد و فقط از compatibility path عبور می‌کند. این برای Patch C قابل قبول است، اما در migration بعدی بهتر است به `confirmation_request` منتقل شود.
- branch روی فایل‌های مشترک و پرریسک merge conflict کار کرده است: `schemas/builder-context-package.schema.json`, `scripts/validate-package.mjs`, `package.json`, `.github/workflows/schema-validation.yml`, `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md`, `modes/APPROVED_HANDOFF_MODE.md`, `core/MASTER_PROMPT.md`.
- full npm/Ajv validation باید در GitHub Actions یا checkout محلی دارای network اجرا شود.

## Remaining migration work

- migrate کردن example packages قدیمی به `confirmation_request` در patch مستقل یا migration pass بعدی؛ در این patch برای کاهش conflict و رعایت عدم redesign، example اصلی فقط از compatibility path پشتیبانی می‌شود.
- در صورت نیاز، افزودن templateهای بیشتر به `confirmation_request.template_id` باید همراه schema enum و validator rule انجام شود.
- اگر پروژه تصمیم بگیرد legacy support را حذف کند، مرحله بعدی حذف کامل `confirmation_sentence` و `builder_assistant_prompt_seed` از schema compatibility path است.
