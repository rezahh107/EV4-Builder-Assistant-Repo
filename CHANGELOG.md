# CHANGELOG — EV4 Builder Assistant Repo

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
