# Reference Paradigm Gate

Visual-reference builds must pass this Builder-side gate before `BATCH-001`.

## Rule

Builder must refuse any package where `visual_reference_present=true` and `visual_parity_expected=true` unless the package includes both:

- `reference_paradigm_lock` extracted by `constructability_engineer` with `paradigm_locked=true` and a non-empty `completion_signature`.
- `paradigm_to_structure_map` with `primary_anchor`, `regions`, `repeated_units`, and `first_batch_requirements`; when the lock includes connectors, `connector_layer` is also required.

`task_type=pure_execution`, `visual_reference_present=false`, or `visual_parity_expected=false` does not require this lock.

## Builder boundary

Builder validates only structured fields. Builder must not parse reference images, infer layout paradigm from screenshots, create missing locks, redesign the structure, redistribute cards, or reinterpret connector models.

## Failure behavior

If the gate fails, Builder enters `EVIDENCE_REQUIRED` or `REVIEW_ONLY`, reports the explicit blocked reason, and does not emit `BATCH-001`.

User-facing Persian response pattern:

> این package برای build تصویری آماده نیست، چون `reference_paradigm_lock` یا `paradigm_to_structure_map` معتبر ندارد. Builder نمی‌تواند تصویر مرجع را خودش parse کند. لطفاً خروجی Constructability Engineer شامل `reference_paradigm_lock` و `paradigm_to_structure_map` را بده.
