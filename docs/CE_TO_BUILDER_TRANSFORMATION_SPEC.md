# CE → Builder Transformation Spec

Version: 1.0.0  
Status: active  
Scope: explicit transformation from Constructability Engineer output into Builder-side intake carriers

---

## Purpose

This document formalizes the CE → Builder transformation layer. It exists because CE may emit structured objects such as:

```yaml
connector_layer:
  node: connector-layer
  model: card-edge-to-house-edge
```

while Builder intake requires compact carrier fields such as:

```yaml
connector_layer: connector-layer:card-edge-to-house-edge
```

The transformation is not a Builder runtime inference path. It is a declared, CI-tested adapter path that must run before Builder runtime accepts a normalized `Builder_Context_Package`.

---

## Boundary

```text
CE builder_executable_package
→ CE→Builder transformation layer
→ canonical CE→Builder IR
→ Builder_Context_Package projection
→ Builder schema validation
→ Builder cross-field validation
→ Builder runtime intake
```

Builder runtime must not silently convert raw CE data during an interactive session. If a raw CE package arrives without this adapter path, Builder must fail closed.

---

## Canonical Intermediate Representation

The canonical reference-carrier IR is:

```yaml
schema: ev4-ce-builder-reference-ir@1.0.0
primary_anchor:
  node: string
  role: string
regions:
  - id: string
    distribution: string
    expected_count: integer
    nodes: [string]
repeated_units:
  form: string
  required_children: [string]
connector_layer:
  node: string
  model: string
  compact_id: string # node:model
first_batch_requirements: [string]
derived:
  distribution_model: string
  left_right_regions_proven: boolean
  left_region_count: integer
  right_region_count: integer
```

The IR preserves CE source details that Builder's compact schema cannot carry as separate fields, such as `primary_anchor.role` and `regions[].nodes[]`. Those fields are not silently lost; they are explicitly retained in IR and declared in `data/ce-builder-transformation-registry.v1.json`.

---

## Strict Rules

```text
1. No silent transformations.
2. Every transform must be declared in data/ce-builder-transformation-registry.v1.json.
3. Every transform must declare source_paths, ir_paths, builder_paths, operation, loss_policy, and data_loss behavior.
4. CE connector_layer {node, model} must become Builder connector_layer string exactly as node:model, with no inserted whitespace.
5. Fields that cannot be emitted to Builder because of Builder schema constraints must be marked retained_in_ir_only or covered_by_projection.
6. Missing proof, missing carrier data, mismatched identity, unresolved Builder decision, or undeclared transform must fail closed.
```

---

## Field Mapping Table

| CE source | IR path | Builder output | Operation | Loss policy |
|---|---|---|---|---|
| `paradigm_to_structure_map.primary_anchor.node` | `ir.primary_anchor.node` | `paradigm_to_structure_map.primary_anchor`, `first_batch_structure_intent.primary_anchor` | copy trimmed string | lossless |
| `paradigm_to_structure_map.primary_anchor.role` | `ir.primary_anchor.role` | none | preserve in IR only | declared IR retention |
| `regions[].id`, `regions[].distribution`, `regions[].expected_count` | `ir.regions[]` | `paradigm_to_structure_map.regions[]` | derive region label strings | projected; full region objects retained in IR |
| `regions[].nodes[]` | `ir.regions[].nodes[]` | none | preserve in IR only | declared IR retention |
| `primary_anchor.node` | `ir.primary_anchor.node` | added center-anchor region label | derive label | lossless derived label |
| `repeated_units.form` | `ir.repeated_units.form` | `paradigm_to_structure_map.repeated_units[]`, `first_batch_structure_intent.repeated_unit_form` | copy trimmed string | lossless |
| `repeated_units.required_children[]` | `ir.repeated_units.required_children[]` | repeated-unit summary string | derive summary | projected; raw array retained in IR |
| `connector_layer.node`, `connector_layer.model` | `ir.connector_layer.compact_id` | `paradigm_to_structure_map.connector_layer` | compact `node:model` | lossless compact ID |
| `connector_layer.node` | `ir.connector_layer.node` | none as separate field | preserve in IR only | declared IR retention |
| `connector_layer.model` | `ir.connector_layer.model` | `first_batch_requirements.connector_strategy`, `first_batch_structure_intent.connector_strategy` | copy trimmed string | lossless |
| `first_batch_requirements[]` | `ir.first_batch_requirements[]` | `first_batch_requirements` object | derive Builder-safe flags | projected; raw array retained in IR |
| `regions[].expected_count`, `reference_paradigm_lock.distribution_model` | `ir.derived.left_region_count`, `ir.derived.right_region_count` | `first_batch_structure_intent.left_region_count`, `right_region_count` | derive counts | fail closed if not proven |
| `paradigm_to_structure_map`, `reference_paradigm_lock` | `ir.derived` | `first_batch_structure_intent` | derive structured intent | fail closed if not proven |
| CE executable status gates | none | `package_status: ready` | gated projection | fail closed unless CE is executable-ready |
| CE identity and lock fields | none | `selected_candidate_id`, `selected_candidate_locked` | copy after preservation checks | fail closed on mismatch |
| CE Builder carrier arrays/maps | none | same Builder carrier fields | copy required carriers | fail closed if missing |
| `first_safe_builder_batch` | none | `first_builder_batch` | normalize first batch | fail closed on unresolved decision or over-cap |
| CE `confirmation_request` | none | Builder `confirmation_request` plus `template_id` | copy IDs and attach trusted template | lossless plus Builder trust-boundary constant |
| normalized Builder package | none | `input_authorization.package_digest` | SHA-256 digest | computed, not source data |

The machine-readable source of truth for this table is `data/ce-builder-transformation-registry.v1.json`.

---

## Validator Rules

The strict validator is:

```text
scripts/validate-ce-builder-transformation-registry.mjs
```

It checks:

```text
- registry schema/status are correct;
- mapping IDs are unique;
- every mapping declares source_paths, ir_paths, builder_paths, operation, loss_policy, data_loss, implemented_by, and validation;
- no mapping uses implicit loss policy;
- every transform ID exported by adapter code exists in the registry;
- every registry mapping for the adapter is implemented by code;
- the CE reference IR preserves source-only fields;
- connector_layer projection is exactly node:model with no added whitespace;
- the updated valid fixture matches adapter output.
```

Central validation now invokes this validator through `scripts/validate.mjs`.

---

## Runtime Rule

Builder may enter `APPROVED_HANDOFF_MODE` from CE data only after:

```text
1. CE package passes CE-side executable constraints.
2. CE→Builder transformation registry validation passes.
3. The adapter emits a Builder_Context_Package.
4. Builder JSON schema validation passes.
5. Builder cross-field validation passes.
```

If any step fails, Builder must not infer, repair, or silently convert the package at runtime.
