# CHANGELOG — EV4 Builder Assistant Repo

## v0.2.0 — 2026-06-27

### Added

- `examples/_template/README.md`.
- `examples/_template/start_session_prompt.md`.
- `examples/_template/builder_context_package.template.json`.
- `examples/smart-home-connector/README.md`.
- `examples/smart-home-connector/builder_context_package.json`.
- `examples/smart-home-connector/start_session_prompt.md`.
- `examples/smart-home-connector/expected_first_response.md`.
- `examples/smart-home-connector/notes.md`.
- `tests/valid/builder_context_package.json`.
- `tests/invalid/missing_selected_candidate.json`.
- `.github/workflows/schema-validation.yml`.

### Validation

- Valid fixture is expected to pass `schemas/builder-context-package.schema.json`.
- Invalid fixture intentionally omits `selected_candidate_id` and is expected to fail.
- Workflow also compiles `session-state.schema.json` with `checkpoint.schema.json`.

### Status

- Schema validation workflow added; waiting for GitHub Actions result.
- Smart Home example is a seed, not a live Elementor validation.
- Production readiness remains false.

---

## v0.1.2 — 2026-06-27

### Fixed

- Added `element_generation` to `approved_structure_tree` nodes in `schemas/builder-context-package.schema.json`.
- Added `element_generation` to `first_builder_batch.actions` in `schemas/builder-context-package.schema.json`.
- Added shared `$defs.element_generation` enum:
  - `V4 Atomic Element`
  - `V3 element`
  - `Shared compatibility element`
  - `Unverified element type`
- Added `minItems: 1` to `widget_mapping_table`.
- Changed `selected_candidate_locked` from `const: true` to `enum: [true]` with explanatory description for valid/invalid fixture clarity.
- Added reset scope enum to `commands/SESSION_COMMANDS.md`:
  - `full_session_reset`
  - `checkpoint_only_reset`
  - `class_map_reset`
  - `not_confirmed`

### Added

- `modes/FRESH_IMAGE_MODE.md` as fallback-only mode.

### Status

- All initial modes are now present.
- Examples and tests still pending.
- Schema CI is still pending and should be added after valid/invalid fixtures exist.
- Production readiness remains false.

---

## v0.1.1 — 2026-06-27

### Fixed

- Clarified `max_actions_per_turn` is intentionally bounded to `1..6`.
- Added action-count commands to `commands/SESSION_COMMANDS.md` recognition list:
  - `یک پله`
  - `دو پله`
  - `سه پله`
  - `چهار پله`
  - `پنج پله`
  - `شش پله`
  - `تعداد پله: N`
- Added `schemas/builder-context-package.schema.json`.
- Reduced duplication between `PROJECT_INSTRUCTIONS.md` and `core/MASTER_PROMPT.md` by making `core/MASTER_PROMPT.md §3` the canonical `Data vs Instruction Rule`.
- Added explicit `Unverified element type` behavior to `PER_ELEMENT_INSTRUCTION.md`, `V3_V4_SEPARATION_GUARD.md`, and `MASTER_PROMPT.md`.
- Unified correction output shapes under canonical `correction_response`.
- Updated `CONTROL_EXISTENCE_FAILURE.md` to use `correction_response` with `subtype_details` instead of a separate top-level shape.

### Status

- Review fixes applied.
- Examples and tests still pending.
- Production readiness remains false.

---

## v0.1.0 — 2026-06-27

### Added

- Initial runtime repository structure.
- `PROJECT_INSTRUCTIONS.md` for ChatGPT Project settings.
- `core/MASTER_PROMPT.md` as the main runtime prompt.
- `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md`.
- `core/SESSION_STATE_MACHINE.md`.
- `core/LIVE_INTERFACE_PRECEDENCE.md`.
- `modes/APPROVED_HANDOFF_MODE.md`.
- `modes/CORRECTION_MODE.md`.
- `protocols/CONTROL_EXISTENCE_FAILURE.md`.
- `commands/SESSION_COMMANDS.md`.
- `protocols/PER_ELEMENT_INSTRUCTION.md`.
- `protocols/CLASS_APPLICATION_SAFETY.md`.
- `protocols/COMPLETION_GATE.md`.
- `protocols/STEP_SIZE_CONTRACT.md`.
- `protocols/V3_V4_SEPARATION_GUARD.md`.
- `protocols/LAYOUT_COMPLETENESS_CHECKLIST.md`.
- `schemas/session-state.schema.json`.
- `schemas/checkpoint.schema.json`.
- `STATUS.md`.

### Design Notes

- Prompt design follows a PEaC-style separation of role, task, context, constraints, output format, and validation.
- User-provided files and handoffs are treated as data, not executable instructions.
- Runtime uses explicit stop conditions, session state, checkpoints, and correction mode.
