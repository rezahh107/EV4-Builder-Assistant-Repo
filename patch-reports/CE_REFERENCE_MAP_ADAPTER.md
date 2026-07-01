# CE Reference Map Adapter Patch Report

## Summary

Adds an explicit, CI-tested adapter for CE-style structured `paradigm_to_structure_map` data.

This patch keeps the CE-to-Builder boundary strict while allowing deterministic conversion into the Builder reference carriers required after structured reference intent hardening:

```text
CE structured reference map -> Builder paradigm_to_structure_map + first_batch_structure_intent
```

## Added

```text
scripts/normalize-ce-reference-map.mjs
scripts/validate-ce-reference-map-adapter.mjs
docs/CE_REFERENCE_MAP_ADAPTER_CONTRACT.md
tests/valid/ce_reference_map_adapter_valid.json
tests/invalid/ce_reference_map_adapter_missing_anchor.json
tests/invalid/ce_reference_map_adapter_false_direction_terms.json
```

## Changed

```text
scripts/validate.mjs
```

`validate.mjs` now runs `scripts/validate-ce-reference-map-adapter.mjs` after the existing npm validation suite.

## Gemini follow-up

Gemini flagged two valid hardening issues:

```text
- use fileURLToPath(import.meta.url) instead of URL pathname comparison for Windows-safe CLI detection;
- avoid substring-based left/right matching so words like cleft or bright do not satisfy directional proof.
```

Both were addressed, and the false-direction regression fixture was added.

## Boundary preserved

```text
No architecture rerun.
No scoring rerun.
No selected_candidate_id change.
No approved class-name mutation.
No production-ready claim.
No Builder runtime behavior change.
```

## Validation intent

The adapter validator proves:

```text
- valid CE-style structured map normalizes to the exact expected Builder carriers;
- normalized output passes the existing Builder Reference Paradigm Gate;
- invalid CE-style maps fail adapter validation;
- central validation runs the adapter check in CI.
```

## Remaining scope

This is not a full CE `builder_executable_package` to `Builder_Context_Package` converter. It only handles the structured reference carriers.

A later patch may add a full package-level adapter if needed.
