# BATCH3_STRUCTURED_REFERENCE_INTENT

Branch: `fix/batch3-structured-reference-intent`

PR: `#27`
Merge commit: `267a21ea0ccb8cb22fdf558d80f34982618a1000`
Status: merged; post-audit follow-up sync applied.

## دامنه

Batch 3 فقط برای `Structural Reference Paradigm Hardening` پیاده‌سازی شد. هدف patch جایگزینی اتکای تعیین‌کننده به متن آزاد در Reference Paradigm Gate با فیلد ساختاری و validator-backed به نام `first_batch_structure_intent` است.

## تغییرات اصلی

- اضافه شدن `first_batch_structure_intent` به `schemas/reference-paradigm-gate.schema.json`.
- اضافه شدن `$defs.first_batch_structure_intent` و top-level `first_batch_structure_intent` به `schemas/builder-context-package.schema.json`.
- required شدن `first_batch_structure_intent` در visual-reference parity conditional، همراه با `reference_paradigm_lock` و `paradigm_to_structure_map`.
- حفظ استثنای `task_type=pure_execution`.
- تغییر `scripts/validate-reference-paradigm-gate.mjs` تا structured intent بر متن آزاد ترجیح داده شود.
- حفظ `EV4-RPG-005` برای fallback متنی و اضافه شدن:
  - `EV4-RPG-006 blocked_missing_first_batch_structure_intent`
  - `EV4-RPG-007 blocked_first_batch_structure_intent_mismatch`
- اصلاح Gemini review برای `connector_strategy: "none"` و مقایسه نرمال‌شده connector با `?? null`.

## Fixture coverage

Valid:
- `tests/valid/center_anchored_symmetric_reference_ready.json`
- `examples/smart-home-connector/builder_context_package.json`
- `tests/valid/builder_context_package_no_connector_reference.json`
- `tests/valid/reference_paradigm_no_connector_intent.json` به‌عنوان focused validator smoke fixture برای مسیر no-connector

Invalid:
- missing `first_batch_structure_intent`
- wrong `primary_anchor`
- wrong `distribution_model`
- wrong `repeated_unit_form`
- missing connector layer staging
- `forbidden_composition_start=true`
- plausible prose with wrong structured intent

## Validation

Static checks قبل از upload انجام شد:
- JSON parse برای فایل‌های JSON جدید/بازنویسی‌شده.
- `node --check` برای `scripts/validate-reference-paradigm-gate.mjs`.

Validation نهایی Batch 3 از مسیر CI و `npm run validate` تأیید شد:
- Workflow: `Schema validation`
- Run: `203`
- Head SHA: `9f2d27c669c7a0977b74f1631d9473d4628e3a30`
- Conclusion: `success`

Follow-up audit sync:
- `STATUS.md` از حالت pre-merge خارج شد.
- `CHANGELOG.md` و این patch report پوشش no-connector و وضعیت post-merge را شفاف کردند.
- runtime-facing source pack تغییر نکرد، چون رفتار runtime contract تغییر نکرد.

## مرزهای حفظ‌شده

- Batch 4 یا cleanup نامرتبط پیاده‌سازی نشد.
- معماری Smart Home تغییر نکرد.
- `selected_candidate_id: ARCH-FAM-C` حفظ شد.
- class nameهای تأییدشده تغییر نکردند.
- production readiness به true تغییر نکرد.
- gateهای موجود تضعیف نشدند.
