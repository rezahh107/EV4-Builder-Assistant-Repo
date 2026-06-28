# Patch C — Package Trust Boundary & Structured Confirmation

## Branch

`patch/c-package-trust-boundary-sync`

Base branch: `main`

## Summary

Patch C adds a package trust boundary and structured confirmation path while preserving Patch B authorization hardening already merged into `main`.

## Applied fixes

- Added `confirmation_request` as the structured confirmation replacement.
- Deprecated `confirmation_sentence` and `builder_assistant_prompt_seed` as untrusted display-only compatibility data.
- Hardened `scripts/validate-package.mjs` against prompt-injection, command-like confirmation text, missing confirmation source, non-standard confirmation action IDs, and mixed batch prefixes.
- Updated `validate:cross-field` to require invalid cross-field fixtures to fail.
- Added fixtures for malicious prompt seed, command-like legacy confirmation, nested display-only injection, missing confirmation source, non-standard confirmation action IDs, and mixed batch prefixes.
- Preserved compatibility for legacy packages that still provide `confirmation_sentence`.

## Gemini review handling

Accepted and implemented all three material Gemini comments:

1. Fail when `confirmation_request.confirmed_action_ids` span multiple batch prefixes or do not follow standard `BATCH-XXX-AYY` format.
2. Fail when both `confirmation_request` and legacy `confirmation_sentence` are missing.
3. Update `validate:cross-field` so invalid cross-field fixtures are expected to fail.

## Compatibility

Existing legacy examples remain usable through `confirmation_sentence` compatibility, but runtime must treat legacy free text as untrusted display-only data and must not execute it.

## Validation

GitHub connector inspection:

```text
GitHub.compare_commits main...patch/c-package-trust-boundary-sync: ahead_by=13, behind_by=0
GitHub.list_pull_request_review_threads for PR #3: Gemini comments inspected
```

Full local npm/Ajv validation was not run in this environment because the container could not clone GitHub earlier due network/DNS limitations. CI should validate the PR.

## Remaining risks

- CI must run on the final PR.
- The old PR `#3` remains conflict-prone because it was based before Patch B. The sync branch is based on current `main` and should replace it.
