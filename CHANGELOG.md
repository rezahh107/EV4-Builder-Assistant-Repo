# CHANGELOG — EV4 Builder Assistant Repo

## v0.3.2 — 2026-06-28

### Added

- Added `protocols/UI_INSTRUCTION_CONFIDENCE_GATE.md`.
- Added `known_control_map` concept for verified/missing/version-sensitive UI controls.
- Added targeted UI screenshot recipe:
  - selected element
  - show
  - active class
  - panel/tab
  - crop
- Added valid structured confirmation fixture:
  - `tests/valid/builder_context_package_with_confirmation_request.json`
- Added cross-field invalid fixtures:
  - `tests/invalid-cross-field/package_prompt_seed_injection.json`
  - `tests/invalid-cross-field/confirmation_sentence_command_injection.json`
  - `tests/invalid-cross-field/confirmation_request_unknown_action.json`

### Changed

- Completed Patch C migration to structured `confirmation_request` in `examples/smart-home-connector/builder_context_package.json`.
- Removed legacy executable-looking `builder_assistant_prompt_seed` and `confirmation_sentence` from the Smart Home example runtime path.
- Confirmed runtime confirmation must be generated from trusted templates using:
  - `confirmation_request.template_id`
  - `confirmation_request.confirmed_action_ids`
  - `confirmation_request.expected_user_token`
- Upgraded `protocols/SMART_GUIDANCE_FOOTER.md` to `Version: 0.2.0` and `Status: restricted_context_footer`.
- Added explicit footer context gate:
  - `active_builder_batch: false`
  - `fully_blocked_required_input: false`
  - `completion_report: false`
- Added `guidance_footer: auto | off` session preference.
- Wired UI-confidence rules into:
  - `core/LIVE_INTERFACE_PRECEDENCE.md`
  - `protocols/OFFICIAL_ELEMENTOR_DOCS_PRIORITY.md`
  - `protocols/PER_ELEMENT_INSTRUCTION.md`
  - `modes/CORRECTION_MODE.md`
  - `commands/SESSION_COMMANDS.md`
- Updated `README.md`, `STATUS.md`, `docs/REPOSITORY_GUIDE.md`, and `docs/CHATGPT_PROJECT_SETUP_GUIDE.md` for Patch C/F and source-pack sync.
- Updated deployable ChatGPT project source pack:
  - `dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt`
  - `dist/chatgpt-project/knowledge/02_INPUT_AUTHORIZATION.md`
  - `dist/chatgpt-project/knowledge/05_UI_EVIDENCE_AND_CORRECTION.md`
  - `dist/chatgpt-project/knowledge/smart-home-connector.compact.md`
  - `dist/chatgpt-project/SOURCE_PACK_MANIFEST.json`
  - `dist/chatgpt-project/BUILD_REPORT.json`

### Validation

- GitHub Actions `Schema validation` passed on run `111` for head `90b8a8c3345b0329d8e47e99c8c32a624b077d79`.
- Passed steps included:
  - `npm run build:project-pack`
  - valid Builder_Context_Package fixture validation
  - invalid Builder_Context_Package rejection
  - `npm run validate:cross-field`
  - invalid cross-field fixture rejection
  - `npm run validate:checkpoint`
  - intake-result fixture validation
  - `npm run validate:session-state`
  - session-state schema compilation
- Local npm validation was not run from a checked-out repo because the GitHub connector does not provide a local npm execution environment.

### Status

- No Smart Home architecture redesign was intended.
- `selected_candidate_id: ARCH-FAM-C` remains preserved.
- Approved class names remain preserved.
- `production_ready_allowed: false` and `production_ready: false` remain preserved.
- Real Elementor execution remains not run.

---

## v0.3.1 — 2026-06-27

### Hardened

- Updated `PROJECT_INSTRUCTIONS.md` so `workflow_mode` and `runtime_state` are separated in the primary Project Instructions layer.
- Updated `core/MASTER_PROMPT.md` so `PAUSED`, `CORRECTION`, `REVIEW_ONLY`, and `COMPLETED` are runtime states, not workflow modes.
- Hardened `schemas/intake-result.schema.json` with route invariants:
  - missing `Builder_Context_Package` must be `blocked_missing_input`;
  - missing `Builder_Context_Package` must appear in `blocking_missing_inputs`;
  - `approved` and `approved_with_optional_gaps` require present and validated `Builder_Context_Package`;
  - approved intake requires non-null `selected_candidate_id` and `package_status`;
  - optional screenshots alone cannot block intake;
  - approved/blocked decisions must match their workflow/runtime route.
- Hardened `schemas/session-state.schema.json` with:
  - `dependentRequired` pairing for `workflow_mode` and `runtime_state`;
  - allowed workflow/runtime combinations;
  - normalized `current_state` compatibility for `CORRECTION` and `REVIEW_ONLY`.
- Expanded CI fixture coverage for `intake_result_*.json` and `session_state_*.json` fixtures.
- Updated `package.json` scripts for full intake-result and session-state validation.

### Added

- Valid intake fixtures:
  - `tests/valid/intake_result_approved.json`
  - `tests/valid/intake_result_blocked_missing_builder_context_package.json`
  - `tests/valid/intake_result_blocked_invalid_package.json`
  - `tests/valid/intake_result_blocked_conflict.json`
- Invalid intake fixtures:
  - `tests/invalid/intake_result_builder_package_missing_but_approved.json`
  - `tests/invalid/intake_result_approved_with_blocking_missing_input.json`
  - `tests/invalid/intake_result_approved_without_selected_candidate_id.json`
  - `tests/invalid/intake_result_optional_screenshot_blocks_alone.json`
  - `tests/invalid/intake_result_workflow_runtime_mismatch.json`
- Session-state fixtures:
  - `tests/valid/session_state_mode_state.json`
  - `tests/invalid/session_state_workflow_runtime_mismatch.json`

### Status

- GitHub Actions validation should be run after v0.3.1.
- No Smart Home architecture, class names, `selected_candidate_id`, or production-readiness rules were changed.
- Production readiness remains false.

---

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
