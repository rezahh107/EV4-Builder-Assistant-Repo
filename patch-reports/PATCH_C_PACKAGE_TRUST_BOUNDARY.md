# Patch C — Package Trust Boundary & Structured Confirmation

## خلاصه

Patch C مرز اعتماد `Builder_Context_Package` را سخت‌تر کرد تا محتوای package فقط به‌عنوان data مصرف شود، نه runtime instruction. مسیر قبلی که در آن `builder_assistant_prompt_seed` و `confirmation_sentence` می‌توانستند نقش کانال instruction-smuggling داشته باشند، با `confirmation_request` ساختاریافته جایگزین شد.

## موارد deprecated

- `builder_assistant_prompt_seed`
  - از required schema حذف شد.
  - به‌عنوان legacy/deprecated و untrusted display-only علامت‌گذاری شد.
  - validator در صورت وجود آن warning می‌دهد.
  - اگر شامل prompt-injection marker باشد، cross-field validation را fail می‌کند.

- `confirmation_sentence`
  - از required canonical path حذف شد.
  - برای compatibility نگه داشته شد، اما فقط display-only و untrusted است.
  - runtime نباید آن را به‌عنوان exact confirmation prompt یا command اجرا کند.
  - اگر شامل command-like text مثل `ادامه`، `ریست`، `شروع`، `استارت` یا role-changing text باشد، cross-field validation fail می‌شود.

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

- `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md`
  - اضافه شدن Package Trust Boundary.
  - مستندسازی trusted vs untrusted package fields.
  - تغییر confirmation requirement از free-text به structured confirmation.

- `modes/APPROVED_HANDOFF_MODE.md`
  - اضافه شدن Confirmation Trust Boundary.
  - runtime confirmation از `confirmation_request.template_id` و `expected_user_token` تولید می‌شود.

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

## Validation results

اجرای محلی انجام‌شده:

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

محدودیت validation:

- اجرای کامل `npx --yes ajv-cli@5 ...` در محیط محلی connector انجام نشد؛ validation schema با Python `jsonschema` و cross-field validator با Node انجام شد.
- انتظار می‌رود GitHub Actions مسیر کامل `ajv-cli` را پس از push/PR اجرا کند.

## Remaining migration work

- migrate کردن example packages قدیمی به `confirmation_request` در patch مستقل یا migration pass بعدی؛ در این patch برای کاهش conflict و رعایت عدم redesign، example اصلی فقط از compatibility path پشتیبانی می‌شود.
- در صورت نیاز، افزودن templateهای بیشتر به `confirmation_request.template_id` باید همراه schema enum و validator rule انجام شود.
- اگر پروژه تصمیم بگیرد legacy support را حذف کند، مرحله بعدی حذف کامل `confirmation_sentence` و `builder_assistant_prompt_seed` از schema compatibility path است.
