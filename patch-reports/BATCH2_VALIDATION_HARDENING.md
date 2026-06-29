# Batch 2 Validation Hardening Report

Date: 2026-06-29
Branch: `fix/batch2-validation-hardening`
Status: ready_for_ci

---

## Scope

Batch 2 hardens validation coverage without changing runtime schemas or Builder architecture.

Implemented:

- Added `scripts/validate-schema-registry.mjs`.
- Added `validate:schema-registry` to `package.json`.
- Added schema registry compilation to the central `scripts/validate.mjs` runner.
- Removed duplicate central execution of `validate:elementor-asset-generation` because `validate:asset-generation` already covers it.
- Removed duplicate reference paradigm execution from `validate:cross-field`; `scripts/validate.mjs` still runs `validate:reference-paradigm` explicitly.
- Added wording false-positive regression fixtures:
  - `tests/valid/wording_already_substring_safe.json`
  - `tests/valid/wording_abandoned_substring_safe.json`
- Added wording shadowing regression fixture:
  - `tests/invalid/wording_desktop_complete_shadowing_regression.json`

---

## Preserved Boundaries

```text
No schema semantics changed.
No validator behavior changed except central orchestration.
No architecture/scoring/recommendation/constructability review rerun.
No selected_candidate_id mutation.
No approved class handling change.
production_ready remains false.
```
