# PATCH_B_PACKAGE_AUTHORIZATION_HARDENING

## Branch

`patch/b-package-authorization-hardening`

## Scope

Implemented Patch B only: Package Authorization Hardening.

No changes were made to the approved Smart Home architecture, approved class names, README, STATUS, or CHANGELOG.

## Files changed

- `schemas/builder-context-package.schema.json`
- `scripts/validate-package.mjs`
- `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md`
- `modes/APPROVED_HANDOFF_MODE.md`
- `tests/invalid-cross-field/package_status_blocked.json`
- `tests/invalid/input_authorization_invalid_digest.json`
- `patch-reports/PATCH_B_PACKAGE_AUTHORIZATION_HARDENING.md`

## Commits

- `1667ad9` — `Patch B: harden package authorization validator`
- `a88ad91` — `Patch B: add input authorization schema support`
- `c38daff` — `Patch B: add blocked package invalid fixture`
- `46de36e` — `Patch B: add invalid digest fixture`
- `0d390e` — `Patch B: document package authorization gate`
- `3701aec` — `Patch B: gate APPROVED_HANDOFF_MODE by authorization`

## Implemented rules

- Added optional schema support for `input_authorization`.
- Added supported digest object at `input_authorization.package_digest`:
  - `algorithm: sha256`
  - `scope: canonical_package_without_digest`
  - `value: <64 lowercase hex>`
- Kept digest support backward-compatible: legacy packages without embedded `input_authorization` remain schema-compatible.
- `scripts/validate-package.mjs` now rejects `package_status: blocked` from the executable validation path.
- `APPROVED_HANDOFF_MODE` is now gated by an approved authorization decision.
- `ready` and `ready_with_visible_flags` remain the only package statuses eligible for approved execution.
- `selected_candidate_locked` must be `true`.
- `production_ready_allowed` must be `false`.
- Missing `approved_structure_tree`, class map, first batch actions, or generation/source evidence is blocking.
- Existing visible flags and unknowns are carried into deterministic authorization checks when `input_authorization` is supplied.

## Stable diagnostic IDs

The validator now emits stable diagnostic IDs, including the required Patch B IDs:

- `EV4-PKG-001 BLOCKED_PACKAGE_STATUS`
- `EV4-PKG-002 SELECTED_CANDIDATE_NOT_LOCKED`
- `EV4-PKG-003 PRODUCTION_READY_NOT_FALSE`
- `EV4-PKG-004 MISSING_REQUIRED_TREE`
- `EV4-PKG-005 ACTION_TARGET_UNKNOWN`

Additional narrow IDs were added for generation evidence, class map, digest, and cross-reference failures.

## Validation results

Local validation was run against the patched files.

```text
npm test --if-present
exit: 0
```

```text
npm run validate --if-present
exit: 0
```

```text
npm run validate:builder-context
result: tests/valid/builder_context_package.json valid
```

```text
npm run validate:cross-field
result:
Cross-field validation passed: tests/valid/builder_context_package.json
Cross-field validation passed: examples/smart-home-connector/builder_context_package.json
```

Manual negative validation:

```text
node scripts/validate-package.mjs tests/invalid-cross-field/package_status_blocked.json
expected result: fail
observed diagnostic:
EV4-PKG-001 BLOCKED_PACKAGE_STATUS
```

```text
npx --yes ajv-cli@5 validate --spec=draft2020 --strict=false \
  -s schemas/builder-context-package.schema.json \
  -d tests/invalid/input_authorization_invalid_digest.json
expected result: fail
observed schema failure:
/input_authorization/package_digest/algorithm must be equal to constant sha256
```

## Smart Home validation

`examples/smart-home-connector/builder_context_package.json` still validates through the cross-field validator.

The Smart Home package was not rewritten and its approved architecture/class names were not changed.

## Remaining risks

- Embedded `input_authorization` remains optional for backward compatibility. This is intentional for Patch B, but future stricter exporter versions may require it.
- Digest validation is deterministic when `input_authorization` is supplied; packages without embedded digest rely on runtime-computed authorization.
- This patch does not add broad graph validation beyond existing node/class/action cross-reference checks.
- `PROJECT_INSTRUCTIONS.md` was read but not modified to avoid broad instruction churn.
