# PATCH_B_PACKAGE_AUTHORIZATION_HARDENING

## Branch

`patch/b-package-authorization-hardening`

## دامنه

Patch B فقط برای `Package Authorization Hardening` پیاده‌سازی شد.

تغییری در معماری تأییدشده‌ی Smart Home، نام classهای تأییدشده، `README`, `STATUS`, یا `CHANGELOG` انجام نشده است.

## فایل‌های تغییرکرده

- `schemas/builder-context-package.schema.json`
- `scripts/validate-package.mjs`
- `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md`
- `modes/APPROVED_HANDOFF_MODE.md`
- `tests/invalid-cross-field/package_status_blocked.json`
- `tests/invalid/input_authorization_invalid_digest.json`
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

## قوانین پیاده‌سازی‌شده

- پشتیبانی schema برای `input_authorization` اضافه شد، اما برای سازگاری عقب‌رو اختیاری باقی ماند.
- شیء digest در `input_authorization.package_digest` پشتیبانی می‌شود:
  - `algorithm: sha256`
  - `scope: canonical_package_without_digest`
  - `value: <64 lowercase hex>`
- packageهای قدیمی که `input_authorization` یا digest ندارند همچنان schema-compatible هستند.
- `scripts/validate-package.mjs` حالا `package_status: blocked` را از مسیر executable رد می‌کند.
- `scripts/validate-package.mjs` حالا فقط `ready` و `ready_with_visible_flags` را برای executable validation مجاز می‌داند.
- `APPROVED_HANDOFF_MODE` با تصمیم `input_authorization.decision: approved` gate شده است.
- `selected_candidate_locked` باید `true` باشد.
- `production_ready_allowed` باید `false` باشد.
- نبودن `approved_structure_tree`, `class_creation_application_map`, `first_builder_batch.actions`, یا generation/source evidence باعث blocking diagnostic می‌شود.
- `audit_flags_to_preserve` و `unknowns_to_preserve` در `visible_flags` حفظ می‌شوند و silently resolve نمی‌شوند.

## Diagnostic IDهای پایدار

validator diagnosticهای پایدار منتشر می‌کند، از جمله IDهای الزامی Patch B:

- `EV4-PKG-001 BLOCKED_PACKAGE_STATUS`
- `EV4-PKG-002 SELECTED_CANDIDATE_NOT_LOCKED`
- `EV4-PKG-003 PRODUCTION_READY_NOT_FALSE`
- `EV4-PKG-004 MISSING_REQUIRED_TREE`
- `EV4-PKG-005 ACTION_TARGET_UNKNOWN`

Diagnosticهای محدود اضافی برای generation evidence، class map، digest، و cross-reference failure اضافه شده‌اند.

## Validation

### نتیجه validation قبلی ثبت‌شده در مرحله پیاده‌سازی

در گزارش اولیه، این نتایج به‌عنوان local validation ثبت شده بودند:

```text
npm test --if-present
exit: 0
```

```text
npm run validate --if-present
exit: 0
```

```text
npm run validate:builder-context
result: tests/valid/builder_context_package.json valid
```

```text
npm run validate:cross-field
result:
Cross-field validation passed: tests/valid/builder_context_package.json
Cross-field validation passed: examples/smart-home-connector/builder_context_package.json
```

Negative validation ثبت‌شده:

```text
node scripts/validate-package.mjs tests/invalid-cross-field/package_status_blocked.json
expected result: fail
observed diagnostic:
EV4-PKG-001 BLOCKED_PACKAGE_STATUS
```

```text
npx --yes ajv-cli@5 validate --spec=draft2020 --strict=false \
  -s schemas/builder-context-package.schema.json \
  -d tests/invalid/input_authorization_invalid_digest.json
expected result: fail
observed schema failure:
/input_authorization/package_digest/algorithm must be equal to constant sha256
```

### Audit rerun limitation

در audit pass بعدی، اجرای commandها روی clone واقعی branch در container ممکن نشد، چون environment نتوانست `github.com` را resolve کند:

```text
git clone --depth 1 --branch patch/b-package-authorization-hardening https://github.com/rezahh107/EV4-Builder-Assistant-Repo.git /mnt/data/ev4-audit
fatal: unable to access 'https://github.com/rezahh107/EV4-Builder-Assistant-Repo.git/': Could not resolve host: github.com
exit: 128
```

همچنین برای commitهای branch، GitHub connector هیچ `workflow_runs` یا combined status check برنگرداند. بنابراین post-fix CI result در این report تأیید نشده است و باید در PR/GitHub Actions بررسی شود.

## Smart Home validation

`examples/smart-home-connector/builder_context_package.json` در مرحله پیاده‌سازی با cross-field validator پاس شده بود و در این patch بازنویسی نشد.

معماری Smart Home و class names تأییدشده تغییر نکردند.

## اصلاح audit pass

در audit pass یک gap تأیید شد: `scripts/validate-package.mjs` فقط `package_status: blocked` را reject می‌کرد. برای hardening، commit زیر اضافه شد:

```text
`d14f072` — `Patch B: harden executable package status gate`
```

این commit باعث می‌شود validator مستقل از AJV نیز فقط `ready` و `ready_with_visible_flags` را eligible بداند و هر مقدار دیگر را با `EV4-PKG-012 PACKAGE_STATUS_NOT_EXECUTABLE` reject کند.

## ریسک‌های باقی‌مانده

- `input_authorization` برای backward compatibility اختیاری است. اگر exporter آینده strict شود، می‌توان آن را required کرد.
- digest فقط وقتی `input_authorization` ارائه شود enforce می‌شود؛ packageهای legacy بدون digest همچنان به runtime-computed authorization وابسته‌اند.
- این patch broad graph validation اضافه نکرده است؛ این موضوع عمداً خارج از Patch B نگه داشته شد.
- branch نسبت به `main` یک commit عقب است. آن commit مربوط به `README.md` است و برای جلوگیری از parallel conflict وارد Patch B نشده است.
- post-fix validation کامل در این audit environment اجرا نشد؛ CI باید در PR یا workflow_dispatch بررسی شود.
