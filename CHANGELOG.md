# CHANGELOG — EV4 Builder Assistant Repo

## v0.3.6 — 2026-06-29

### Added

- Added `scripts/validate-version-consistency.mjs`.
- Added invalid cross-field fixtures for first-builder batch over-cap and recursive package prose prompt-injection detection.
- Added `schemas/layout-check.schema.json` and `scripts/validate-layout-check.mjs`.
- Added valid and invalid layout-check fixtures.
- Added `schemas/completion-gate.schema.json` and `scripts/validate-completion-gate.mjs`.
- Added valid and invalid completion-gate fixtures.

### Changed

- Hardened `scripts/validate-package.mjs` with recursive package prose prompt-injection scanning.
- Enforced `first_builder_batch.actions.length <= first_builder_batch.max_actions` in cross-field validation.
- Reduced `first_builder_batch.max_actions` and `first_builder_batch.actions.maxItems` from 6 to 5 in `schemas/builder-context-package.schema.json`.
- Added `validate:version-consistency` to `package.json` and CI.
- Added `validate:layout-check` and `validate:completion-gate` to `package.json` and CI.
- Added schema compilation for layout-check and completion-gate to CI.
- Synchronized `README.md`, `STATUS.md`, and package version metadata to v0.3.6.

### Status

- No architecture, scoring, recommendation, or redesign was rerun.
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
- Updated deployable ChatGPT Project Instructions and source pack.
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
