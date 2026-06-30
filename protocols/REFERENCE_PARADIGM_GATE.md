# Reference Paradigm Gate

Visual-reference builds must pass this Builder-side gate before `BATCH-001`.

## Rule

Builder must refuse any package where `visual_reference_present=true`, `visual_parity_expected=true`, and `task_type` is not `pure_execution` unless the package includes all of these structured fields:

- `reference_paradigm_lock` extracted by `constructability_engineer` with `paradigm_locked=true` and a non-empty `completion_signature`.
- `paradigm_to_structure_map` with `primary_anchor`, `regions`, `repeated_units`, and `first_batch_requirements`; when the lock includes connectors, `connector_layer` is also required.
- `first_batch_structure_intent`, the machine-readable declaration of the first Builder batch structure intent.

`task_type=pure_execution`, `visual_reference_present=false`, or `visual_parity_expected=false` does not require this lock.

## `first_batch_structure_intent`

For the Smart Home Connector reference, `first_batch_structure_intent` must state the first batch structure using explicit fields instead of free-text wording:

```json
{
  "primary_anchor_staged": true,
  "primary_anchor": "house-center",
  "distribution_model": "3-left-3-right",
  "repeated_unit_form": "pill-card",
  "region_model": "left-center-right",
  "left_region_count": 3,
  "right_region_count": 3,
  "connector_strategy": "card-edge-to-house-edge",
  "connector_layer_staged": true,
  "forbidden_composition_start": false
}
```

The validator treats this structured intent as decisive. Legacy text scanning is fallback-only and cannot override a provided structured intent.

## Builder boundary

Builder validates only structured fields. Builder must not parse reference images, infer layout paradigm from screenshots, create missing locks, redesign the structure, redistribute cards, reinterpret connector models, or infer first-batch structural intent from prose when `first_batch_structure_intent` is present.

## Failure behavior

If the gate fails, Builder enters `EVIDENCE_REQUIRED` or `REVIEW_ONLY`, reports the explicit blocked reason, and does not emit `BATCH-001`.

User-facing Persian response pattern:

> این package برای build تصویری آماده نیست، چون `reference_paradigm_lock`، `paradigm_to_structure_map` یا `first_batch_structure_intent` معتبر ندارد. Builder نمی‌تواند تصویر مرجع یا متن آزاد batch را خودش parse کند. لطفاً خروجی Constructability Engineer شامل این سه فیلد ساختاری را بده.
