# Pre-Batch 3 Hardening Report

Date: 2026-06-30
Branch: `fix/pre-batch3-hardening`
Status: ready_for_ci

---

## Critical Review Of Batch 1 And Batch 2

### Batch 1

Batch 1 successfully synchronized the deployable ChatGPT Project pack and runtime docs with the behavioral contract layer. The pack is protected by `scripts/build-project-pack.mjs`, which verifies instruction length, knowledge file count, manifest paths, manifest hashes, and BUILD_REPORT counts.

No additional source-pack hardening was required before Batch 3.

### Batch 2

Batch 2 added schema registry validation, wording false-positive regressions, wording shadowing regression coverage, and reduced duplicate central validation orchestration.

Remaining hardening opportunity found before Batch 3:

- `scripts/validate.mjs` still invoked `npm` with `shell: true`.
- `STATUS.md` still described Batch 1 / Batch 2 work as pending even after the PRs were merged.
- `CHANGELOG.md` did not yet fully record Batch 2 and pre-Batch 3 validation-runner hardening.

---

## Implemented Hardening

- Updated `scripts/validate.mjs` to use `npm.cmd` on Windows and `npm` elsewhere, without `shell: true`.
- Updated `STATUS.md` to reflect merged Batch 1 / Batch 2 state and active schema registry validation.
- Updated `CHANGELOG.md` to record Batch 2 validation hardening and pre-Batch 3 central runner hardening.

---

## Preserved Boundaries

```text
No schema semantics changed.
No validator contract semantics changed.
No fixtures changed.
No architecture/scoring/recommendation/constructability review rerun.
No selected_candidate_id mutation.
No approved class handling change.
production_ready remains false.
Batch 3 structural changes are intentionally not implemented here.
```
