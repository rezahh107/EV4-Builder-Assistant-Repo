# CHANGELOG — EV4 Builder Assistant Repo

## v0.3.0 — 2026-06-27

### Added

- Mode/state foundation:
  - `core/MODE_STATE_MATRIX.md`
- One-line public state marker rule:
  - `STATE_CAPSULE`
- Structured fresh-chat intake result schema:
  - `schemas/intake-result.schema.json`
- Intake result fixtures:
  - `tests/valid/intake_result_approved_with_optional_gaps.json`
  - `tests/invalid/intake_result_missing_decision.json`

### Changed

- Updated `core/SESSION_STATE_MACHINE.md` to separate `workflow_mode` from `runtime_state`.
- Updated `docs/START_INTAKE_POLICY.md` with `intake_checklist`, attachment/pasted JSON inspection, and blocking-only re-request rules.
- Updated `protocols/NEW_CHAT_START_INTAKE.md` to emit compact `intake_checklist` / `intake_result` behavior.
- Updated `commands/SESSION_COMMANDS.md` so `شروع`, `استارت`, `توقف`, `بررسی`, and `اصلاح` map to normalized workflow/state behavior.
- Updated `schemas/session-state.schema.json` with optional `workflow_mode`, `runtime_state`, and `state_capsule` fields while preserving legacy `current_state` compatibility.
- Updated `.github/workflows/schema-validation.yml` and `package.json` to validate intake result fixtures.
- Updated `STATUS.md` for v0.3.0.

### Compatibility

- `CORRECTION_MODE` and `REVIEW_MODE` remain legacy names only.
- Preferred runtime states are now `CORRECTION` and `REVIEW_ONLY`.
- `START_INTAKE_MODE`, `APPROVED_HANDOFF_MODE`, and `FRESH_IMAGE_MODE_LIMITED` are workflow modes, not runtime states.

### Status

- Local JSON Schema check for `schemas/intake-result.schema.json` passed with the valid fixture.
- Local invalid fixture check rejected missing `decision` as expected.
- GitHub Actions validation is pending after this patch.
- Production readiness remains false.

---

## v0.2.3 — 2026-06-27

### Added

- Official Elementor docs priority protocol:
  - `protocols/OFFICIAL_ELEMENTOR_DOCS_PRIORITY.md`
- Workbook reference boundary:
  - `protocols/WORKBOOK_REFERENCE_BOUNDARY.md`
- TUYA case memory:
  - `cases/tuya-step-by-step/CASE_LESSONS.md`
  - `cases/tuya-step-by-step/CASE_PATCH_MAP.md`
- TUYA workbook reference layer:
  - `references/tuya-workbook/README.md`
  - `references/tuya-workbook/WORKBOOK_USAGE_POLICY.md`
  - `references/tuya-workbook/WORKBOOK_LESSON_INDEX.md`
  - `references/tuya-workbook/EXTRACTED_BUILDER_RULES.md`
- New practical builder protocols:
  - `protocols/RISK_ADJUSTED_STEP_SIZE.md`
  - `protocols/STYLE_SYSTEM_CAPABILITY_GATE.md`
  - `protocols/CONTROLLED_OVERLAY_STAGE_PATTERN.md`
  - `protocols/REPEATED_ELEMENT_DUPLICATION_PROTOCOL.md`
  - `protocols/RESPONSIVE_WORKFLOW_GUARD.md`
  - `protocols/READING_ORDER_CHECKLIST.md`

### Changed

- Updated `PROJECT_INSTRUCTIONS.md` to make official Elementor docs the primary external source for standard capability claims.
- Updated `core/MASTER_PROMPT.md` with official-doc priority, workbook/case boundaries, and new reference protocols.
- Updated `core/LIVE_INTERFACE_PRECEDENCE.md` to separate standard capability priority from executable UI priority.
- Updated `protocols/STEP_SIZE_CONTRACT.md` default action limit from 6 to 5.
- Updated `commands/SESSION_COMMANDS.md` action-count commands to support 1..5.
- Updated `schemas/session-state.schema.json` to bound `max_actions_per_turn` to 1..5.
- Updated `docs/CHATGPT_PROJECT_SETUP_GUIDE.md` with new protocol upload order and reference files.
- Updated `README.md` and `STATUS.md` for v0.2.3.

### Status

- Schema validation should be run again after these documentation/protocol changes.
- Real Elementor execution remains not run.
- Production readiness remains false.

---

## v0.2.2 — 2026-06-27

### Added

- `docs/CHATGPT_PROJECT_SETUP_GUIDE.md`.
- `examples/smart-home-connector/MANUAL_SESSION_001.md`.
- Updated Smart Home notes with CI pass and manual-session recording fields.
- Updated `docs/REPOSITORY_GUIDE.md` for CI pass and manual-session seed.
- Updated `STATUS.md` for v0.2.2.

### Validation

- Schema validation workflow passed according to user-reported GitHub UI result.
- Manual session is seeded but not executed in real Elementor yet.

### Status

- Next milestone is real Builder Assistant session evidence.
- Production readiness remains false.

---

## v0.2.1 — 2026-06-27

### Hardened

- Added `element_generation_source` to the Builder Context schema.
- Required generation source on tree nodes and first builder actions.
- Expanded invalid fixtures for missing generation, empty widget mapping, unlocked candidate, production-ready flag, over-sized first batch, and extra fields.
- Added checkpoint valid/invalid fixtures.
- Added `scripts/validate-package.mjs` for cross-field validation.
- Added `package.json` validation scripts.
- Hardened the GitHub Actions schema-validation workflow.
- Updated Smart Home example package and template package for generation-source compatibility.
- Synced upstream Architect schema and Stage 11 hardening patch.

---

## v0.2.0 — 2026-06-27

### Added

- Example template files.
- Smart Home Connector example seed.
- Initial valid and invalid Builder Context fixtures.
- Initial schema-validation workflow.

---

## v0.1.2 — 2026-06-27

### Fixed

- Added `element_generation` to tree nodes and first builder actions.
- Added shared `element_generation` enum.
- Added `minItems: 1` to `widget_mapping_table`.
- Clarified `selected_candidate_locked` valid value.
- Added reset scope enum.
- Added `modes/FRESH_IMAGE_MODE.md` as fallback-only mode.

---

## v0.1.1 — 2026-06-27

### Fixed

- Clarified early `max_actions_per_turn` boundary before v0.2.3 changed runtime default to 5.
- Added action-count commands.
- Added Builder Context schema.
- Canonicalized `Data vs Instruction Rule` in `core/MASTER_PROMPT.md`.
- Added `Unverified element type` behavior.
- Unified correction output shapes under `correction_response`.

---

## v0.1.0 — 2026-06-27

### Added

- Initial runtime repository structure.
- Project instructions.
- Master prompt.
- Input contract.
- Session state machine.
- Live interface precedence.
- Approved handoff and correction modes.
- Core protocols.
- Session commands.
- Initial schemas.
- Initial status file.
