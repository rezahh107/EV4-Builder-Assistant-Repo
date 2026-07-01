# CHANGELOG — EV4 Builder Assistant Repo

## v0.3.6 — 2026-07-01

### Added

- Added central contract validation through `scripts/validate.mjs`.
- Added schema registry validation through `scripts/validate-schema-registry.mjs`.
- Added behavioral contract schemas, validators, and fixtures for action batches, unit policy, evidence claims, visual parity, generated assets, UI confidence, wording, layout checks, completion checks, repair packets, and cognitive mode hints.
- Added Reference Paradigm Gate support with `schemas/reference-paradigm-gate.schema.json` and `scripts/validate-reference-paradigm-gate.mjs`.
- Added structured `first_batch_structure_intent` support for visual-reference parity builds.
- Added diagnostics:
  - `EV4-RPG-006 blocked_missing_first_batch_structure_intent`
  - `EV4-RPG-007 blocked_first_batch_structure_intent_mismatch`
- Added structured reference intent regression fixtures, including missing intent, wrong anchor, wrong distribution, wrong repeated unit form, missing connector layer staging, forbidden composition start, plausible prose with wrong structured intent, and no-connector `none` handling.
- Added Real Elementor Execution Evidence Pack:
  - `schemas/real-elementor-execution-evidence.schema.json`
  - `scripts/validate-real-elementor-execution-evidence.mjs`
  - `docs/REAL_ELEMENTOR_EXECUTION_EVIDENCE.md`
  - `examples/smart-home-connector/real_elementor_execution_evidence.template.json`
  - invalid regression for production-ready claims without completed real evidence.

### Changed

- Hardened package validation and cross-field checks for executable package status, selected candidate locking, production readiness boundary, approved structure references, and first-batch action limits.
- Reduced `first_builder_batch.max_actions` and `first_builder_batch.actions.maxItems` to 5.
- Simplified CI so `.github/workflows/schema-validation.yml` runs central validation through `npm run validate`.
- Hardened central validation runner execution by avoiding shell execution and using cross-platform `npm` / `npm.cmd` handling.
- Hardened Reference Paradigm Gate so `first_batch_structure_intent` is the decisive first-batch structural source; free-text first-batch checks remain fallback-only.
- Updated Smart Home Connector valid fixtures and example package with structured first-batch intent.
- Updated runtime-facing docs and deployable ChatGPT Project pack for structured reference intent.
- Addressed Gemini review by treating connector value `none` as no connector and by normalizing connector comparison with explicit mismatch reporting.
- Synced Batch 3 status after post-implementation audit so repository status no longer describes pre-merge PR work.
- Documented the no-connector coverage split: full-package no-connector regression runs through central package validation, while the standalone gate fixture remains a focused validator smoke fixture.
- Central validation now runs Real Elementor Execution Evidence validation as a final non-production-readiness evidence gate.

### Status

- No architecture, scoring, recommendation, constructability review, or redesign was rerun.
- `selected_candidate_id: ARCH-FAM-C` remains preserved.
- Approved class names remain preserved.
- `production_ready` remains false.
- Real Elementor execution still requires real user-provided UI evidence before any production-readiness claim.

---

## v0.3.5 — 2026-06-28

### Added

- Added `protocols/SESSION_REPAIR_PACKET.md`.
- Added `schemas/repair-packet.schema.json`.
- Added `scripts/validate-repair-packet.mjs`.
- Added Smart Home Connector repair packet example.
- Added valid and invalid repair-packet regression fixtures.
- Added session-state regression fixtures requiring `repair_packet` in `CORRECTION`.
- Added `patch-reports/PATCH_SESSION_REPAIR_PACKET.md`.

### Changed

- Updated runtime docs so build-impacting incidents freeze normal batches and require a formal repair packet.
- Updated `schemas/session-state.schema.json` so `runtime_state: CORRECTION` requires `repair_packet`.
- Updated CI and package scripts so repair packet validation runs centrally.

### Status

- No architecture, scoring, recommendation, or redesign was rerun.
- `selected_candidate_id: ARCH-FAM-C` remains preserved.
- Approved class names remain preserved.
- `production_ready` remains false.

---

## v0.3.4 — 2026-06-28

### Added

- Added `protocols/UX_PRECEDENCE_TABLE.md`.
- Added `protocols/ESCAPE_HATCH_RECOVERY.md`.
- Added `schemas/recovery-state.schema.json`.
- Added `recovery_state` to `schemas/session-state.schema.json`.
- Added compact project source `dist/chatgpt-project/knowledge/10_USER_FACING_UX_RECOVERY.md`.

### Changed

- Updated `core/MASTER_PROMPT.md`, `core/SESSION_STATE_MACHINE.md`, and runtime docs with UX precedence and Escape Hatch recovery rules.
- Updated deployable ChatGPT Project source pack.

### Status

- No Smart Home architecture redesign was intended.
- `selected_candidate_id: ARCH-FAM-C` remains preserved.
- Approved class names remain preserved.
- `production_ready_allowed: false` and `production_ready: false` remain preserved.

---

## v0.3.3 — 2026-06-28

### Added

- Added Builder batch output format and user-facing response policy.
- Added UI vocabulary handling and practical UX commands.
- Added copy-pasteable session summary behavior.

### Changed

- Normal builder batch output hides internal/source fields unless explicitly requested or required by state.
