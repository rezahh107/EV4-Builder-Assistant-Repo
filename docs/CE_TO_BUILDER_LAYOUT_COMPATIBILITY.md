# CE → Builder Layout Compatibility

Version: 1.0.0  
Status: active  
Decision: Option A — Extend Builder Support conditionally

## Decision

Builder conditionally supports `reference_paradigm_lock.layout_paradigm: grid` only when explicit left/right decomposition metadata exists.

This does not introduce generic grid rendering. It declares a safe compatibility projection from CE `grid` evidence into Builder's existing `left-center-right` rendering model.

## Registry source of truth

```text
data/ce-builder-transformation-registry.v1.json
layout_compatibility.contract_name = CE_TO_BUILDER_LAYOUT_COMPATIBILITY
```

## Required grid metadata

```text
- paradigm_to_structure_map.regions[] includes explicit left region evidence
- paradigm_to_structure_map.regions[] includes explicit right region evidence
- first_batch_structure_intent.region_model == left-center-right
- first_batch_structure_intent.left_region_count > 0
- first_batch_structure_intent.right_region_count > 0
- distribution_model contains left/right decomposition evidence
```

## Failure code

```text
LAYOUT_PARADIGM_REQUIRES_DECOMPOSITION
```

Builder must fail before rendering if `layout_paradigm=grid` arrives without this decomposition.
