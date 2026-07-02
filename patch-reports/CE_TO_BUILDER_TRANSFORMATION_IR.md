# CE → Builder Transformation IR Patch Report

Status: ready_for_validation  
Branch: `fix/ce-builder-transformation-ir`  
Scope: formal CE→Builder transformation layer, canonical IR, mapping registry, and strict validator

---

## Summary

This patch formalizes the CE→Builder adapter path so CE structured fields are not silently converted during Builder runtime.

The specific structural mismatch addressed is:

```yaml
# CE
connector_layer:
  node: connector-layer
  model: card-edge-to-house-edge

# Builder
connector_layer: connector-layer:card-edge-to-house-edge
```

---

## Added

```text
docs/CE_TO_BUILDER_TRANSFORMATION_SPEC.md
data/ce-builder-transformation-registry.v1.json
scripts/ce-builder-transformation-registry.mjs
scripts/validate-ce-builder-transformation-registry.mjs
```

---

## Changed

```text
scripts/normalize-ce-reference-map.mjs
scripts/normalize-ce-builder-executable-package.mjs
scripts/validate.mjs
tests/valid/ce_reference_map_adapter_valid.json
docs/CE_REFERENCE_MAP_ADAPTER_CONTRACT.md
docs/CE_BUILDER_PACKAGE_ADAPTER_CONTRACT.md
STATUS.md
CHANGELOG.md
```

---

## Contract Behavior

```text
- Every adapter transform must be declared in data/ce-builder-transformation-registry.v1.json.
- The reference adapter builds ev4-ce-builder-reference-ir@1.0.0 before Builder projection.
- Source-only CE fields are retained in IR or explicitly covered by projection rules.
- connector_layer {node, model} is projected as node:model with no inserted whitespace.
- Undeclared transform IDs fail closed.
- Missing CE proof or required carrier data still fails before Builder intake.
```

---

## Validation Added

```text
scripts/validate-ce-builder-transformation-registry.mjs
```

The validator checks:

```text
- registry schema and active status;
- unique mapping IDs;
- required mapping metadata;
- explicit non-implicit loss policy;
- declared source/IR/Builder paths;
- exact adapter-code-to-registry transform ID alignment;
- reference IR preservation of source-only fields;
- connector_layer projection as node:model;
- valid fixture expected output matches adapter output.
```

Central validation now invokes this validator through:

```text
npm run validate
```

---

## Safety Notes

```text
- No architecture rerun.
- No scoring rerun.
- No selected_candidate_id mutation.
- No approved class-name mutation.
- No production-ready claim.
- No Builder runtime inference path added.
```

---

## Remaining Validation

Run in a checked-out repository or CI:

```bash
npm run validate
```

This patch report does not claim CI success until CI/check evidence is available.
