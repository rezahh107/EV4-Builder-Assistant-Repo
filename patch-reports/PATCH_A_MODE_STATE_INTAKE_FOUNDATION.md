# گزارش Patch A — Runtime State & Intake Foundation

Branch: `patch/a-mode-state-intake-foundation`

Status: `needs_validation`

زبان گزارش: Persian

Technical identifiers intentionally kept in English.

---

## 1. خلاصه

Patch A بنیاد runtime state و intake را اضافه می‌کند:

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

`CORRECTION_MODE` و `REVIEW_MODE` فقط legacy aliases هستند:

```yaml
CORRECTION_MODE: CORRECTION
REVIEW_MODE: REVIEW_ONLY
```

---

## 2. Hardening commits

```text
2f8e79b5de14db727682c0eb730aef376193d12d — add approved intake fixture
7c8c0dda68d5c785c302695a2d156d75083319e6 — add missing package intake fixture
d0cbbabd860441ab4097cd080f15fd3ed946dcc4 — add invalid approved without package fixture
790705e50bf17ee33763e6f903b26126cb8a7ab7 — add invalid optional screenshot blocker fixture
3eb25042aed9e2980be57c5f734666668603d9a3 — validate all intake fixtures in package.json
d349eda2bc037441d6f57cceaf8aac55faccdfa6 — validate all intake result fixtures in CI
```

این گزارش نیز به‌عنوان hardening documentation روی همین branch اضافه شد.

---

## 3. Files changed by hardening pass

```text
tests/valid/intake_result_approved.json
tests/valid/intake_result_blocked_missing_builder_context_package.json
tests/invalid/intake_result_builder_package_missing_but_approved.json
tests/invalid/intake_result_optional_screenshot_blocks_alone.json
package.json
.github/workflows/schema-validation.yml
patch-reports/PATCH_A_MODE_STATE_INTAKE_FOUNDATION.md
```

---

## 4. Fixes applied

### 4.1 Intake fixture coverage

اضافه شد:

```text
tests/valid/intake_result_approved.json
tests/valid/intake_result_blocked_missing_builder_context_package.json
tests/invalid/intake_result_builder_package_missing_but_approved.json
tests/invalid/intake_result_optional_screenshot_blocks_alone.json
```

هدف:

```text
- approved intake بدون Builder_Context_Package رد شود.
- missing Builder_Context_Package به blocked_missing_input برود.
- optional reference_screenshot به‌تنهایی blocking input نشود.
- approved intake route به APPROVED_HANDOFF_MODE / BUILD_ACTIVE محدود بماند.
```

### 4.2 package.json validation script

`validate:intake-result` از validate کردن فقط یک fixture به validate کردن همه فایل‌های زیر تغییر کرد:

```text
tests/valid/intake_result_*.json
tests/invalid/intake_result_*.json
```

### 4.3 GitHub Actions alignment

`.github/workflows/schema-validation.yml` اکنون همه valid/invalid intake result fixtures را با pattern اجرا می‌کند و دیگر فقط `intake_result_missing_decision.json` را چک نمی‌کند.

---

## 5. Validation commands

در این محیط، GitHub connector امکان local checkout و اجرای مستقیم `npm` را فراهم نمی‌کند. بنابراین commandها اجرا نشدند و باید در GitHub Actions یا local clone اجرا شوند.

Required commands:

```text
npm run validate:cross-field
npm run validate:builder-context
npm run validate:checkpoint
npm run validate:intake-result
```

Expected CI command coverage:

```text
.github/workflows/schema-validation.yml
```

Validation result at report creation time:

```yaml
local_npm_validation: not_run
github_actions_validation: pending_or_not_observed
reason: connector_environment_does_not_provide_local_repo_execution
risk: real_until_CI_passes
```

---

## 6. Failures / skips

```yaml
skipped:
  - local npm validation
  - direct ajv-cli execution
reason:
  - no local checked-out repository execution environment in GitHub connector
```

---

## 7. Remaining risks

```text
- CI must still be run on branch patch/a-mode-state-intake-foundation.
- Branch was found to be behind main at audit time; review should compare this branch directly against the intended merge base.
- README.md, STATUS.md, and CHANGELOG.md were already modified in earlier Patch A work; no additional README/STATUS/CHANGELOG updates were made in this hardening pass.
- package.json uses shell loop syntax for validate:intake-result; this is compatible with GitHub Actions Ubuntu but less portable to Windows shell.
```

---

## 8. Review recommendation

```text
Needs CI validation before PR review.
```

Patch A should not be considered fully ready until `Schema validation` passes on `patch/a-mode-state-intake-foundation`.
