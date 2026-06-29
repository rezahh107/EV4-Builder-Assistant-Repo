# CHANGELOG — EV4 Builder Assistant Repo

## v0.3.6 — 2026-06-29

### Added

- Added `scripts/validate-version-consistency.mjs`.
- Added invalid cross-field fixtures for first-builder batch over-cap and recursive package prose prompt-injection detection.
- Added `schemas/layout-check.schema.json` and `scripts/validate-layout-check.mjs`.
- Added valid and invalid layout-check fixtures.
- Added `schemas/completion-gate.schema.json` and `scripts/validate-completion-gate.mjs`.
- Added valid and invalid completion-gate fixtures.
- Added Elementor asset generation gate and generated asset validation coverage.
- Added `protocols/INLINE_VALUE_RATIONALE.md`.
- Added unified session-state validation runner.
- Added `protocols/REFERENCE_PARADIGM_GATE.md`, `schemas/reference-paradigm-gate.schema.json`, and reference paradigm regression fixtures.
- Added `protocols/BEHAVIORAL_CONTRACT_ENFORCEMENT.md` and central validation runner `scripts/validate.mjs`.
- Added behavioral contract schemas, validators, and fixtures for action batches, unit policy, evidence claims, completion hierarchy, visual parity, generated assets, UI confidence, and user-facing status wording.

### Changed

- Hardened `scripts/validate-package.mjs` with recursive package prose prompt-injection scanning.
- Enforced `first_builder_batch.actions.length <= first_builder_batch.max_actions` in cross-field validation.
- Reduced `first_builder_batch.max_actions` and `first_builder_batch.actions.maxItems` from 6 to 5 in `schemas/builder-context-package.schema.json`.
- Added `validate:version-consistency` to `package.json` and CI.
- Added `validate:layout-check` and `validate:completion-gate` to `package.json` and CI.
- Added schema compilation for layout-check and completion-gate to CI.
- Added `validate:elementor-asset-generation`, `validate:reference-paradigm`, and central `validate` entrypoint.
- Simplified CI to run central contract validation through `npm run validate`.
- Wired layout-check, completion-gate, Elementor asset generation, Reference Paradigm Gate, and behavioral contracts into runtime docs.
- Synchronized deployable ChatGPT project pack after behavioral contract enforcement.
- Synchronized `README.md`, `STATUS.md`, and package version metadata to v0.3.6.

### Status

- No architecture, scoring, recommendation, constructability review, or redesign was rerun.
- `selected_candidate_id: ARCH-FAM-C` remains preserved.
- Approved class names remain preserved.
- `production_ready` remains false.

---

## v0.3.5 — 2026-06-28

### Added

- Added `protocols/SESSION_REPAIR_PACKET.md`.
- Added `schemas/repair-packet.schema.json`.
- Added `scripts/validate-repair-packet.mjs`.
- Added Smart Home Connector repair packet example:
  - `examples/smart-home-connector/repair_packet_layout_stability_incident.json`
- Added valid and invalid repair-packet regression fixtures.
- Added session-state regression fixtures requiring `repair_packet` in `CORRECTION`.
- Added `patch-reports/PATCH_SESSION_REPAIR_PACKET.md`.

### Changed

- Updated `PROJECT_INSTRUCTIONS.md` and `core/MASTER_PROMPT.md` so build-impacting incidents freeze normal batches and require a formal repair packet.
- Updated `schemas/session-state.schema.json` so `runtime_state: CORRECTION` requires `repair_packet`.
- Updated `.github/workflows/schema-validation.yml` and `package.json` so repair packet validation runs in CI.

### Validation

- Local schema smoke validation was run against the new repair schema/fixtures before applying to GitHub.
- Full GitHub Actions validation is expected to run on the PR branch.

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

- Updated `core/MASTER_PROMPT.md` with UX precedence and Escape Hatch recovery rules.
- Updated `core/SESSION_STATE_MACHINE.md` with recovery state and no-third-repeat guidance.
- Updated `protocols/USER_FACING_RESPONSE_POLICY.md` to v0.2.0.
- Updated deployable ChatGPT project source pack.
- Reconciled retry policy:
  - attempt 1: clarify instruction
  - attempt 2: request targeted evidence
  - attempt 3: Escape Hatch, not a repeated instruction

### Validation

- GitHub Actions validation is pending after v0.3.4 changes.
- Local npm validation was not run from a checked-out repo because the GitHub connector does not provide a local npm execution environment.

### Status

- No Smart Home architecture redesign was intended.
- `selected_candidate_id: ARCH-FAM-C` remains preserved.
- Approved class names remain preserved.
- `production_ready_allowed: false` and `production_ready: false` remain preserved.

---

## v0.3.3 — 2026-06-28

### Added

- Added `protocols/BUILDER_BATCH_OUTPUT_FORMAT.md`.
- Added `protocols/USER_FACING_RESPONSE_POLICY.md`.
- Added `references/elementor-ui/ATOMIC_ELEMENTS_UI_OBSERVATION_2026-06-28.md` from user-provided Atomic UI screenshots.
- Added user-facing UI vocabulary handling:
  - `ui_vocabulary_map`
  - architecture term vs user-facing UI label separation
  - UI Vocabulary Sync for layout parent labels
- Added schema persistence for:
  - `known_control_map`
  - `ui_vocabulary_map`
- Added practical UX commands:
  - `جزئیات`
  - `جزئیات فنی`
  - `پیش‌نمایش`
- Added copy-pasteable session summary behavior.

### Changed

- Normal builder batch output now hides internal/source fields such as:
  - `element_generation`
  - `element_generation_source`
  - `input_authorization`
  - `package_digest`
  - `Control path: insufficient_evidence`
- Batch headings are now Persian user-facing labels.
- `Container` is treated as an architecture/package term, not automatically as the executable UI label.
- Confirmation after a valid `تایید BATCH-XXX` now uses Token Echo / active silence.
- Updated deployable ChatGPT project source pack.

### Status

- No Smart Home architecture redesign was intended.
- `selected_candidate_id: ARCH-FAM-C` remains preserved.
- Approved class names remain preserved.
- `production_ready_allowed: false` and `production_ready: false` remain preserved.

---

## v0.3.2 — 2026-06-28

### Added

- Added `protocols/UI_INSTRUCTION_CONFIDENCE_GATE.md`.
- Added `known_control_map` concept for verified/missing/version-sensitive UI controls.
- Added targeted UI screenshot recipe.
- Added structured confirmation fixtures and injection fixtures.

### Changed

- Completed Patch C migration to structured `confirmation_request`.
- Upgraded `protocols/SMART_GUIDANCE_FOOTER.md` to v0.2.0.
- Wired UI-confidence rules into runtime docs.
- Updated deployable ChatGPT project source pack.

### Validation

- GitHub Actions `Schema validation` passed on run `111` for head `90b8a8c3345b0329d8e47e99c8c32a624b077d79`.

---

## v0.3.1 — 2026-06-27

### Hardened

- Added workflow_mode/runtime_state separation hardening.
- Hardened intake-result and session-state schemas.
- Expanded CI fixture coverage.

### Status

- No Smart Home architecture, class names, `selected_candidate_id`, or production-readiness rules were changed.
- Production readiness remains false.
