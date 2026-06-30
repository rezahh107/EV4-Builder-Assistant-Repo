# Cross-Repo Contract Audit Patch Report

## Summary

Adds a narrow CE-to-Builder boundary audit for the current handoff between:

```text
rezahh107/EV4-Constructability-Engineer-Repo
rezahh107/EV4-Builder-Assistant-Repo
```

This patch does not change Builder runtime behavior. It records the current boundary and adds a regression fixture proving Builder fails closed when CE-style structured reference carriers are supplied without an explicit Builder-side normalization step.

## Added

```text
docs/CROSS_REPO_CONTRACT_AUDIT.md
tests/invalid-cross-field/ce_structured_reference_map_requires_normalization.json
```

## Key finding

Raw CE `builder_executable_package` is not a drop-in `Builder_Context_Package`.

The current Builder contract requires:

```text
schema: ev4-builder-context-package@1.0.0
package_status: ready | ready_with_visible_flags
production_ready_allowed: false
first_builder_batch
confirmation_request.template_id
```

CE package uses a different executable package shape, including:

```text
builder_package_status: executable_ready
first_safe_builder_batch
confirmation_request without Builder template_id
CE-style structured paradigm_to_structure_map
```

## Boundary preserved

```text
No architecture rerun.
No scoring rerun.
No selected_candidate_id change.
No approved class-name change.
No production-ready claim.
No Builder runtime behavior change.
```

## Validation expectation

The new fixture is under `tests/invalid-cross-field/`, so existing `npm run validate:cross-field` should require it to fail validation. This keeps the current safe behavior explicit until a later adapter/schema-expansion patch is implemented.
