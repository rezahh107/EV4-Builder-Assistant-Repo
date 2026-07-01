# CE Builder Package Adapter Patch Report

## Summary

Adds a full package-level adapter from CE `builder_executable_package` to Builder `Builder_Context_Package`.

This is the next step after the reference carrier adapter. The new adapter keeps the boundary explicit and CI-tested:

```text
CE builder_executable_package -> Builder_Context_Package
```

## Added

```text
scripts/normalize-ce-builder-executable-package.mjs
scripts/validate-ce-builder-package-adapter.mjs
docs/CE_BUILDER_PACKAGE_ADAPTER_CONTRACT.md
tests/valid/ce_builder_package_adapter_valid.json
tests/invalid/ce_builder_package_adapter_not_executable_ready.json
tests/invalid/ce_builder_package_adapter_missing_carriers.json
```

## Changed

```text
scripts/validate.mjs
```

Central validation now runs:

```text
scripts/validate-ce-builder-package-adapter.mjs
```

## Validation Intent

The validator proves:

```text
- valid CE executable package normalizes to Builder_Context_Package;
- normalized output passes Builder JSON schema validation;
- normalized output passes Builder cross-field validation;
- invalid CE packages fail before they can become Builder intake data;
- central CI runs the adapter validator.
```

## Safety Boundary

```text
No architecture rerun.
No scoring rerun.
No candidate selection change.
No selected_candidate_id mutation.
No approved class-name mutation.
No production-ready claim.
No Builder runtime inference path.
```

## Notes

The adapter intentionally does not invent missing Builder carriers. CE must carry the Builder-required execution data, including structure tree, class map, first safe batch, QA seed, and confirmation request.

For visual parity packages, the adapter delegates structured reference normalization to the existing CE reference map adapter.
