# CHANGELOG — EV4 Builder Assistant Repo

## Unreleased — 2026-07-22

### Added

- Added lightweight local `scripts/builder-inspector.mjs` with `intake`, `verify-capsule`, `snapshot`, `resume`, and `completion` commands.
- Added versioned personal intake, state, resume, and Builder-completion authorization Schemas with positive and negative fixtures.
- Added exact input-byte, canonical package-digest, selected-candidate, Session State, Checkpoint, blocker, and transition bindings.
- Added a small static transition validator for the active single-operator workflow.
- Added focused Inspector, transition, capsule, completion, and deterministic Project Pack regression tests.

### Changed

- The canonical personal ChatGPT Project path now requires a matching accepted intake capsule before `APPROVED_HANDOFF_MODE / BUILD_ACTIVE`.
- `input_authorization` remains compatibility-optional in the public Builder Context Package; the Inspector capsule is the single personal-path authorization truth.
- Resume and Builder-only completion now require matching local authorization outputs.
- Preserved the full Runtime Transaction as a CI/deep-diagnosis control without requiring a per-message envelope.
- Replaced verify-only Project Pack handling with deterministic generation from `project-pack/source-map.v2.json`, temporary double-build verification, and atomic publication.
- Reconciled README, STATUS, canonical instructions, setup guide, pack counts, and post-merge baseline evidence.

### Boundaries

- No Builder→Responsive implementation was added.
- No production-readiness claim was added.
- No cryptographic signing, RBAC, remote service, database, distributed lock, or enterprise policy framework was added.

---

## Unreleased — 2026-07-21

### Added

- Added canonical `ev4-builder-conversation-bootstrap@1.0.0` manifest and deterministic startup validation.
- Added exact-byte bare `شروع` response enforcement and semantic mutation tests.
- Added the canonical Builder Runtime Transaction and mutation coverage through PRs #60 and #61.

### Compatibility

- `ev4-builder-context-package@1.0.0` remains unchanged.
- CE→Builder Contract Gate and Adapter remain active.
- Real non-synthetic Builder/Elementor execution remains unverified.

---

## Unreleased — 2026-07-14

- Recorded merged deterministic governance enforcement and preserved explicit evidence limitations.

---

## Unreleased — 2026-07-09

- Added UX-safe Kernel decision receipts and fail-closed receipt validation.

---

## Unreleased — 2026-07-02

- Added CE→Builder transformation specification, registry, Contract Gate, Adapter validation, and the documented non-executing Builder→Responsive boundary.

---

## v0.3.6 — 2026-07-01

- Preserved the active Builder runtime contract family and validation baseline.
