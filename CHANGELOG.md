# CHANGELOG — EV4 Builder Assistant Repo

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
- Batch headings are now Persian user-facing labels:
  - هدف
  - داخل
  - نوع عنصر
  - نام در Structure Panel
  - کلاس
  - تغییر نده
  - نتیجه مورد انتظار
- `Container` is treated as an architecture/package term, not automatically as the executable UI label.
- Confirmation after a valid `تایید BATCH-XXX` now uses Token Echo / active silence:
  - `✓ تایید شد — ادامه می‌دهیم.`
- Updated `core/MASTER_PROMPT.md`, `core/SESSION_STATE_MACHINE.md`, and `commands/SESSION_COMMANDS.md` for Patch G.
- Updated deployable ChatGPT project source pack.

### Validation

- GitHub Actions validation is pending after Patch G.
- Local npm validation was not run from a checked-out repo because the GitHub connector does not provide a local npm execution environment.

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
- Wired UI-confidence rules into runtime docs.
- Updated deployable ChatGPT project source pack.

### Validation

- GitHub Actions `Schema validation` passed on run `111` for head `90b8a8c3345b0329d8e47e99c8c32a624b077d79`.
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
- Hardened `schemas/intake-result.schema.json` with route invariants.
- Hardened `schemas/session-state.schema.json` with workflow/runtime pairing and normalized compatibility.
- Expanded CI fixture coverage for `intake_result_*.json` and `session_state_*.json` fixtures.
- Updated `package.json` scripts for full intake-result and session-state validation.

### Status

- No Smart Home architecture, class names, `selected_candidate_id`, or production-readiness rules were changed.
- Production readiness remains false.

---
