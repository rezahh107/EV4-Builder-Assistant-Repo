# CE Reference Map Adapter Contract

Version: 0.2.0  
Status: active  
Scope: explicit normalization of Constructability Engineer structured `paradigm_to_structure_map` into Builder reference carrier shape and `first_batch_structure_intent`

---

## Purpose

`EV4-Constructability-Engineer-Repo` can emit a richer structured `paradigm_to_structure_map` than the current Builder runtime carrier. Builder must not convert that shape during interactive runtime by inference.

This contract defines a deterministic adapter path:

```text
CE structured paradigm_to_structure_map -> CE→Builder reference IR -> Builder reference carriers
```

The adapter is validated by `scripts/validate-ce-reference-map-adapter.mjs` and runs from the central `scripts/validate.mjs` entrypoint.

The formal transformation registry is:

```text
data/ce-builder-transformation-registry.v1.json
```

The registry is validated by:

```text
scripts/validate-ce-builder-transformation-registry.mjs
```

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

Directional region proof must use explicit `left` and `right` terms. Substrings inside other words, such as `cleft` or `bright`, must not be accepted as directional proof.

---

## Canonical Intermediate Representation

Before Builder projection, the adapter builds this IR:

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

The IR preserves CE fields that Builder's current compact schema cannot carry as separate fields, including `primary_anchor.role`, `regions[].nodes[]`, and the separate connector `node` and `model` values.

---

## Builder Output Shape

The adapter emits two Builder-side carriers.

### `paradigm_to_structure_map`

```yaml
primary_anchor: string
regions: [string]
repeated_units: [string]
connector_layer: string # node:model
first_batch_requirements:
  must_establish_primary_anchor: boolean
  must_create_or_stage_left_right_regions: boolean
  must_use_repeated_unit_form: string
  forbidden_composition_starts: [string]
  connector_strategy: string
```

The connector layer projection is exact:

```text
CE connector_layer { node, model } -> Builder connector_layer "node:model"
```

No whitespace is inserted around the colon.

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

This companion carrier is required because the Builder Reference Paradigm Gate checks structured first-batch intent rather than relying only on batch prose.

---

## Validation Contract

The adapter must prove both sides:

```text
1. Valid CE-style fixture normalizes to the exact expected Builder carriers.
2. The normalized carriers pass Builder reference paradigm gate validation.
3. Invalid CE-style fixtures fail before they can be treated as Builder carrier data.
4. Every transform used by adapter code is declared in the mapping registry.
5. Source-only CE fields are retained in IR or covered by an explicit projection rule.
6. connector_layer projection is exactly node:model.
```

Current fixtures:

```text
tests/valid/ce_reference_map_adapter_valid.json
tests/invalid/ce_reference_map_adapter_missing_anchor.json
tests/invalid/ce_reference_map_adapter_false_direction_terms.json
```

Validators:

```text
scripts/validate-ce-reference-map-adapter.mjs
scripts/validate-ce-builder-transformation-registry.mjs
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
