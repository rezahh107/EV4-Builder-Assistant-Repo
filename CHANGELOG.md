# CHANGELOG — EV4 Builder Assistant Repo

## Unreleased — 2026-07-22

### Added

- Added one explicit active authority model in `runtime/personal-runtime-authority.v1.json` for `personal_single_operator` operation.
- Added the machine-readable state table `runtime/state-transitions.v1.json`.
- Added `scripts/builder-inspector.mjs` with `intake`, `verify-capsule`, `resume`, and `completion` commands.
- Added machine-readable intake capsule Schema `ev4-builder-intake-result@1.0.0`.
- Added Inspector mutation tests for malformed input, Schema, candidate, lineage, stale source, false Resume, dropped blockers, and false Completion.
- Added fixture-based CE → Project Gate → Builder smoke validation.
- Added deterministic Project Pack source mapping, atomic generation, double-build verification, source-mutation testing, and hand-edit rejection.
- Added the functional-value control inventory in `docs/LEAN_PERSONAL_RUNTIME_CONTROL_INVENTORY.md`.

### Changed

- Restricted `COMPLETED` to `APPROVED_HANDOFF_MODE` after successful Completion validation.
- Removed completion-report requests and detached success text as state transitions.
- Bound Session State and Checkpoint to `session_id`, package digest, selected candidate, unresolved blockers, and legal transitions.
- Made repeated `شروع` state-preserving and made `استارت` Resume-only for a real PAUSED Session.
- Simplified ordinary Action Batch metadata while retaining extended rationale, reversibility, safety, evidence, and confirmation fields for high-risk or difficult-to-reverse actions.
- Preserved the deep runtime transaction as a repository CI regression and diagnostic capability instead of a per-message runtime requirement.
- Replaced exact-byte startup duplication with semantic startup validation and mutation tests.
- Replaced hand-maintained `dist/chatgpt-project` duplication with generated output from one canonical source map.
- Synchronized `README.md`, `AGENTS.md`, `STATUS.md`, `PROJECT_INSTRUCTIONS.md`, `core/MASTER_PROMPT.md`, `core/MODE_STATE_MATRIX.md`, planning memory, and deployable Project Pack sources.

### Removed from Active Runtime and Blocking CI

- External Exact-Head evidence.
- PR Inspector and independent review requirements.
- Review receipts, governance bundles, owner-Merge receipts, merge recommendation evidence, and repository commit identity as runtime authorization.
- External Project Gate workflow authority as a blocking repository check.
- Industrial governance validation from the central correctness runner.

### Preserved Correctness Boundaries

- Builder Context Schema and semantic validation.
- selected candidate and decision-lineage continuity.
- Action Batch semantics, target identity, class scope, and confirmation binding.
- Session State, Checkpoint, Repair, evidence, and Completion validation.
- deterministic package identity through SHA-256.
- Schema registry, version consistency, fixtures, mutation tests, deep transaction regression, and normal CI.
- Builder → Responsive exclusion and `production_ready: false`.

### Verification Status

- Repository write evidence is connector-confirmed.
- Local validation is not claimed.
- GitHub Actions results are pending the consolidated pull request.
- Real Elementor execution remains `not_verified`.
- Owner Local Pilot remains required after normal CI.

---

## v0.3.6 — 2026-07-01

- Established central contract validation, Schema registry validation, Builder input and Action Batch contracts, Checkpoint/Repair/Completion validation, reference-paradigm regression, and production-readiness boundaries.
- Preserved `selected_candidate_id`, approved classes, and `production_ready: false`.

## v0.3.5 — 2026-06-28

- Added formal Repair Packet handling and correction-state validation.

## v0.3.4 — 2026-06-28

- Added recovery state, UX precedence, and Escape Hatch recovery rules.

## v0.3.3 — 2026-06-28

- Added Builder batch output and user-facing confirmation behavior.

## v0.3.2 — 2026-06-28

- Added UI instruction confidence, known-control mapping, and structured confirmation fixtures.

## v0.3.1 — 2026-06-27

- Hardened workflow-mode/runtime-state separation and intake/session-state contracts.
