# CHANGELOG — EV4 Builder Assistant Repo

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

### Status

- Smart Home example remains not live Elementor validated.
- Production readiness remains false.

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

### Added

- `modes/FRESH_IMAGE_MODE.md` as fallback-only mode.

---

## v0.1.1 — 2026-06-27

### Fixed

- Clarified `max_actions_per_turn` is bounded to `1..6`.
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
