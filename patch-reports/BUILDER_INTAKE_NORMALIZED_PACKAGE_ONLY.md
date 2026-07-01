# Builder Intake Normalized Package Only Patch Report

## Summary

Adds an explicit regression and documentation for the Builder intake boundary:

```text
Builder intake accepts only validated Builder_Context_Package data.
Raw CE builder_executable_package data is rejected.
```

## Added

```text
docs/BUILDER_INTAKE_NORMALIZED_PACKAGE_ONLY.md
tests/invalid-cross-field/raw_ce_builder_executable_package_rejected_by_intake.json
```

## Validation Path

The regression fixture lives under:

```text
tests/invalid-cross-field/
```

It is covered by the existing `validate:cross-field` script because that script expects every file in `tests/invalid-cross-field/*.json` to fail `scripts/validate-package.mjs`.

## Boundary Preserved

```text
No architecture rerun.
No scoring rerun.
No candidate selection change.
No selected_candidate_id mutation.
No approved class-name mutation.
No production-readiness claim.
No runtime raw-CE conversion path.
```

## Related Work

This patch complements the already-merged CE package adapter. The adapter can normalize CE data before Builder intake, but runtime intake itself remains normalized-package-only.
