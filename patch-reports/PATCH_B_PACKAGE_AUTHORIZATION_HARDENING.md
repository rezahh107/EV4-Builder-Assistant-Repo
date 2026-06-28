# PATCH_B_PACKAGE_AUTHORIZATION_HARDENING

## Branch

`patch/b-package-authorization-hardening`

## دامنه

Patch B فقط برای `Package Authorization Hardening` پیاده‌سازی شد.

معماری تأییدشده‌ی Smart Home، نام classهای تأییدشده، `README`, `STATUS`, و `CHANGELOG` تغییر نکردند.

## فایل‌های تغییرکرده

- `schemas/builder-context-package.schema.json`
- `scripts/validate-package.mjs`
- `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md`
- `modes/APPROVED_HANDOFF_MODE.md`
- `tests/invalid-cross-field/package_status_blocked.json`
- `tests/invalid/input_authorization_invalid_digest.json`
- `tests/invalid/input_authorization_missing_digest.json`
- `patch-reports/PATCH_B_PACKAGE_AUTHORIZATION_HARDENING.md`

## Commitها

- `1667ad9` — `Patch B: harden package authorization validator`
- `a88ad91` — `Patch B: add input authorization schema support`
- `c38daff` — `Patch B: add blocked package invalid fixture`
- `46de36e` — `Patch B: add invalid digest fixture`
- `0d390e` — `Patch B: document package authorization gate`
- `3701aec` — `Patch B: gate APPROVED_HANDOFF_MODE by authorization`
- `f18d46b` — `Patch B: add authorization hardening report`
- `d14f072` — `Patch B: harden executable package status gate`
- `a88d14e` — `Patch B: localize report and record audit correction`
- `9f037db` — `Patch B: add missing digest invalid fixture`

## قوانین پیاده‌سازی‌شده

- `input_authorization` به‌صورت optional و backward-compatible در schema پشتیبانی می‌شود.
- وقتی `input_authorization` ارائه شود، `package_digest` required است.
- `package_digest` شکل پایدار زیر را دارد:
  - `algorithm: sha256`
  - `scope: canonical_package_without_digest`
  - `value: <64 lowercase hex>`
- `package_status: blocked` از executable path رد می‌شود.
- فقط `ready` و `ready_with_visible_flags` برای executable validation مجاز هستند.
- `selected_candidate_locked` باید `true` باشد.
- `production_ready_allowed` باید `false` باشد.
- نبودن `approved_structure_tree`, `class_creation_application_map`, `first_builder_batch.actions`, یا generation/source evidence باعث blocking diagnostic می‌شود.
- `audit_flags_to_preserve` و `unknowns_to_preserve` در `visible_flags` حفظ می‌شوند.

## Diagnostic IDهای پایدار

- `EV4-PKG-001 BLOCKED_PACKAGE_STATUS`
- `EV4-PKG-002 SELECTED_CANDIDATE_NOT_LOCKED`
- `EV4-PKG-003 PRODUCTION_READY_NOT_FALSE`
- `EV4-PKG-004 MISSING_REQUIRED_TREE`
- `EV4-PKG-005 ACTION_TARGET_UNKNOWN`

Diagnosticهای محدود اضافی برای generation evidence، class map، digest، executable package status، و cross-reference failure اضافه شده‌اند.

## Fixture coverage

- `tests/invalid-cross-field/package_status_blocked.json` پوشش می‌دهد که `blocked` executable نیست.
- `tests/invalid/input_authorization_invalid_digest.json` digest نامعتبر را پوشش می‌دهد.
- `tests/invalid/input_authorization_missing_digest.json` نبودن digest هنگام وجود `input_authorization` را پوشش می‌دهد.

## Validation

### ثبت‌شده از مرحله پیاده‌سازی

- `npm test --if-present` → exit `0`
- `npm run validate --if-present` → exit `0`
- `npm run validate:builder-context` → `tests/valid/builder_context_package.json valid`
- `npm run validate:cross-field` → valid package و Smart Home example pass شدند.
- `node scripts/validate-package.mjs tests/invalid-cross-field/package_status_blocked.json` → expected fail با `EV4-PKG-001 BLOCKED_PACKAGE_STATUS`
- `npx --yes ajv-cli@5 validate ... tests/invalid/input_authorization_invalid_digest.json` → expected schema fail برای digest نامعتبر

### Controlled hardening pass

Applied hardening commit:

- `9f037db` — `Patch B: add missing digest invalid fixture`

Validation attempt در محیط فعلی:

- تلاش برای clone کردن branch در container با خطای DNS شکست خورد: `Could not resolve host: github.com`, exit `128`.
- به‌دلیل نبود clone واقعی، commandهای `npm run ...` بعد از commit `9f037db` در این environment قابل اجرا نبودند.
- GitHub connector برای head قبلی هیچ `workflow_runs` یا `statuses` برنگردانده بود؛ بنابراین validation کامل باید در PR/GitHub Actions یا local environment دارای network اجرا شود.

## Smart Home validation

`examples/smart-home-connector/builder_context_package.json` در مرحله پیاده‌سازی با cross-field validator pass شده بود و در hardening pass بازنویسی نشد.

معماری Smart Home و class names تأییدشده تغییر نکردند.

## تصمیم‌های deferشده

- required کردن top-level `input_authorization` defer شد، چون backward compatibility را می‌شکند.
- افزودن broad graph validation defer شد، چون خارج از Patch B است.
- افزودن digest metadata به Smart Home package defer شد، چون package فعلی legacy-compatible است و تغییر آن ضروری نیست.
- update کردن `README`, `STATUS`, یا `CHANGELOG` انجام نشد، چون original Patch B چنین چیزی نمی‌خواست.

## ریسک‌های باقی‌مانده

- `input_authorization` برای backward compatibility اختیاری است.
- digest فقط وقتی `input_authorization` ارائه شود enforce می‌شود.
- branch نسبت به `main` یک commit عقب است؛ آن commit مربوط به `README.md` است و برای جلوگیری از parallel conflict وارد Patch B نشده است.
- validation کامل post-hardening در این environment اجرا نشد؛ CI باید در PR یا workflow_dispatch بررسی شود.
