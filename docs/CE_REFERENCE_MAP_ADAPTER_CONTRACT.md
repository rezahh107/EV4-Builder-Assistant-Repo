# CE Reference Map Adapter Contract

Version: 0.1.0  
Status: active  
Scope: explicit normalization of Constructability Engineer structured `paradigm_to_structure_map` into Builder reference carrier shape and `first_batch_structure_intent`

---

## Purpose

`EV4-Constructability-Engineer-Repo` can emit a richer structured `paradigm_to_structure_map` than the current Builder runtime carrier. Builder must not convert that shape during interactive runtime by inference.

This contract defines a deterministic adapter path:

```text
CE structured paradigm_to_structure_map -> Builder reference carriers
```

The adapter is validated by `scripts/validate-ce-reference-map-adapter.mjs` and runs from the central `scripts/validate.mjs` entrypoint.

---

## Non-Goals

```text
- No architecture rerun.
- No scoring rerun.
- No selected_candidate_id change.
- No approved class-name mutation.
- No production-ready claim.
- No runtime conversation inference path.
```

---

## CE Input Shape

The adapter expects this CE-style structure:

```yaml
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
first_batch_requirements:
  - string
```

---

## Builder Output Shape

The adapter emits two Builder-side carriers.

### `paradigm_to_structure_map`

```yaml
primary_anchor: string
regions: [string]
repeated_units: [string]
connector_layer: string
first_batch_requirements:
  must_establish_primary_anchor: boolean
  must_create_or_stage_left_right_regions: boolean
  must_use_repeated_unit_form: string
  forbidden_composition_starts: [string]
  connector_strategy: string
```

The output intentionally does not add extra fields under `first_batch_requirements`, because Builder's current schema uses `additionalProperties: false` there.

### `first_batch_structure_intent`

```yaml
primary_anchor_staged: boolean
primary_anchor: string
distribution_model: string
repeated_unit_form: string
region_model: left-center-right
left_region_count: integer
right_region_count: integer
connector_strategy: string
connector_layer_staged: boolean
forbidden_composition_start: false
```

This companion carrier is required because the Builder Reference Paradigm Gate now checks structured first-batch intent rather than relying only on batch prose.

---

## Validation Contract

The adapter must prove both sides:

```text
1. Valid CE-style fixture normalizes to the exact expected Builder carriers.
2. The normalized carriers pass Builder reference paradigm gate validation.
3. Invalid CE-style fixture fails before it can be treated as Builder carrier data.
```

Current fixtures:

```text
tests/valid/ce_reference_map_adapter_valid.json
tests/invalid/ce_reference_map_adapter_missing_anchor.json
```

Validator:

```text
scripts/validate-ce-reference-map-adapter.mjs
```

Central CI entrypoint:

```text
scripts/validate.mjs
```

---

## Boundary Rule

A raw CE `builder_executable_package` is still not a drop-in `Builder_Context_Package`.

This adapter only normalizes the CE structured reference carriers. It does not authorize a package for `APPROVED_HANDOFF_MODE` by itself.

Builder intake still requires the normal Builder package validation path:

```text
Builder_Context_Package schema validation
cross-field validation
confirmation_request.template_id
selected_candidate_locked: true
production_ready_allowed: false
first_builder_batch present
```
