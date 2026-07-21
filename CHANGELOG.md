# CHANGELOG — EV4 Builder Assistant Repo

## Unreleased — 2026-07-21

### Added

- Added canonical `ev4-builder-conversation-bootstrap@1.0.0` manifest and Draft 2020-12 schema.
- Added fail-closed semantic validation with one canonical positive case and 35 isolated semantic mutations.
- Added exact-byte controlled `شروع` response enforcement across active runtime instruction carriers.

### Changed

- Bound fresh intake to `شروع` and checkpoint continuation to `استارت` without conflating their semantics.
- Made intake attachment-first and content-validated; filenames remain operator hints only.
- Defined `builder-input.json` from `EV4-Project-Gate / ce-to-builder` as the canonical personal input route.
- Kept `project-gate-c2b-receipt.json` optional and separate from Builder semantic input.
- Removed the obsolete active startup route for the historical Builder feed export command.
- Preserved the Builder-owned CE→Builder Contract Gate and Adapter as an explicit technical direct path, never a silent fallback.
- Synchronized source and deployable Project Instructions and registered bootstrap validation in `scripts/validate.mjs`.

### Compatibility

- `ev4-builder-context-package@1.0.0` remains unchanged.
- CE→Builder mapping, Action Batch semantics, Builder→Responsive scope, and external Project Gate authority evidence remain unchanged.
- Repository package version remains `0.3.6`; the active version-consistency policy requires synchronized markers but does not mandate a semantic-version increment for this non-schema startup hardening.
- External ChatGPT Project instruction loading, a real non-synthetic Builder session, real Elementor execution, and production readiness remain unverified.

---

## Unreleased — 2026-07-14

### Changed

- Recorded the merge and live-default-branch verification of deterministic governance enforcement from PR #55.
- Advanced governance memory from `GOV-004-v5` to `GOV-004-v6`.
- Moved `GOV-CAP-003`, `GOV-CAP-004`, and `GOV-CAP-005` from `committed_now` to `implemented` after verifying merge commit `65450bc5a4d19edf66098669a6fd48bdcda3ed70`.
- Synchronized `STATUS.md`, `planning/CAPABILITY_MEMORY.yml`, and `planning/GOVERNANCE_ADOPTION_PLAN.yml` with the post-merge repository state.

### Status

- The reviewed head tree `064805f59762e191ae386423b07d73bcf5cae7be` is preserved by the merge commit with no additional file changes.
- The historical independent-review evidence gap remains recorded as `BLOCKED_INSUFFICIENT_EVIDENCE`.
- The official external PR Inspector bundle accessor remains unavailable; the live path remains fail-closed.
- `PROD-CAP-001` through `PROD-CAP-004` remain `deferred_not_deleted`.
- Runtime behavior and product contracts were not changed.
- `production_ready` remains false.

---

## Unreleased — 2026-07-09

### Added

- Added Wave 5 UX-safe Kernel decision receipts for Builder output surfaces.
- Added `schemas/kernel-decision-receipt.schema.json` as a presentation-layer receipt contract.
- Added `scripts/format-kernel-decision-receipt.mjs` and `scripts/validate-kernel-decision-receipts.mjs`.
- Added valid success, warning, fallback-warning, repair-packet fallback-warning, and unordered missing-field receipt fixtures.
- Added invalid regressions preventing green success receipts without complete machine-readable trace evidence.
- Added malformed trace type regressions for string-instead-of-array, object-instead-of-string, empty-array, and non-string-array-item cases.
- Added `docs/KERNEL_DECISION_RECEIPTS_WAVE_5.md` and `patch-reports/WAVE_5_KERNEL_DECISION_RECEIPTS.md`.

### Changed

- Wired Kernel decision receipt validation into `scripts/validate.mjs`.
- Updated the receipt validator to validate fixtures against `schemas/kernel-decision-receipt.schema.json` with AJV before custom no-overclaim checks.
- Hardened receipt formatting so required trace fields use explicit string and non-empty string-array validation.
- Preserved `repair_packet` surface for fallback-warning receipts when explicitly requested.
- Made `missing_trace_fields` custom comparison order-insensitive.
- Updated `STATUS.md` to record Wave 5 as presentation-layer only.

### Status

- No architecture, scoring, recommendation, constructability review, or redesign was rerun.
- No Builder design authority was added.
- No CI, sequence, downstream, runtime, or production readiness status was upgraded.
- No authored `resolved` or `production_ready` fields were added.
- `production_ready` remains false.

---

## Unreleased — 2026-07-02

### Added

- Added formal CE→Builder transformation specification in `docs/CE_TO_BUILDER_TRANSFORMATION_SPEC.md`.
- Added machine-readable transformation mapping registry in `data/ce-builder-transformation-registry.v1.json`.
- Added canonical CE→Builder reference IR support through `buildCeReferenceCarrierIr`.
- Added strict transformation registry validator in `scripts/validate-ce-builder-transformation-registry.mjs`.
- Wired the transformation registry validator into central validation through `scripts/validate.mjs`.
- Added the deterministic CE→Builder Contract Gate in `scripts/validate-ce-to-builder-contract-gate.mjs`.
- Added the CE→Builder Contract Gate report schema in `schemas/ce-to-builder-contract-gate-report.schema.json`.
- Added valid and invalid CE→Builder Contract Gate regression fixtures.
- Added `docs/BUILDER_TO_RESPONSIVE_HANDOFF_BOUNDARY.md` without adding runtime behavior.

### Changed

- Hardened CE reference map normalization so CE `connector_layer: { node, model }` projects to Builder `connector_layer: "node:model"` without inserted whitespace.
- Updated CE reference map adapter and package adapter contracts to require declared transformation mappings and explicit data-loss policy.
- Hardened Builder normalization so CE packages must pass the CE→Builder Contract Gate before Builder-side projection or runtime intake.
- Synced downstream CE producer expectations through `rezahh107/EV4-Constructability-Engineer-Repo#24`.
- Preserved prior changelog history while adding this unreleased section.
