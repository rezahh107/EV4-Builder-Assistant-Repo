# protocols/BATCH_COMPACTION_CONTRACT

Version: 0.1.0
Status: active
Purpose: allow compact same-element mechanical batches only after strategy, evidence, and unit safety are resolved.

---

## Core Distinction

High-risk strategy decision is not the same as high-risk mechanical action.

Strategy decisions include:

```text
single SVG vs multiple SVGs
px vs %/auto/vw/rem
connector anchor model
responsive behavior
overlay strategy
structure strategy
```

Mechanical actions after evidence is proven may include:

```text
set Position
set Width
set Height
set Top
set Left
set Z-index
```

Strategy decisions must be resolved before they are hidden inside a mechanical batch.

---

## Compact Batch Allow Conditions

A compact batch may include up to the existing maximum of 5 actions only when all are true:

```yaml
same_element: true
same_control_family: true
controls_visible_or_confirmed: true
unit_strategy_resolved: true
value_sources_resolved: true
actions_reversible: true
geometry_strategy_resolved: true
architecture_boundary_preserved: true
responsive_claim_introduced: false
repair_packet_active: false
action_count: <= 5
```

The actions must affect one element/control family and must not add an unconfirmed responsive claim.

---

## Forbid Compact Batches

Do not compact when any of these are true:

```text
unit_strategy_unresolved
geometry_strategy_unresolved
exact_control_not_visible
action changes structure strategy
action adds/removes approved classes
rollback cost is high
user evidence is missing
repair packet is active and unresolved
responsive claim is introduced
batch exceeds 5 actions
```

---

## Relationship To Step Size

`protocols/STEP_SIZE_CONTRACT.md` still caps normal output at 5 actions. This contract improves how the 5-action limit is used: verified same-element mechanical settings can be batched, while unresolved strategy decisions remain separate blockers.

---

## Repair Interaction

Active Session Repair Packet still blocks normal build. A compact batch is never allowed while `normal_builder_batch_allowed: false` or an unresolved `repair_packet` exists.
