# protocols/PER_ELEMENT_INSTRUCTION

Version: 0.1.0
Status: active_initial
Purpose: define required fields for every Elementor builder action

---

## Purpose

Every builder action must be specific enough that the user knows exactly which element to select, what class to use, which control to touch, and what not to change.

---

## Required Fields Per Element

When creating or editing an element, include as many as applicable:

```text
Parent element
Elementor element type
V4/V3/shared/unverified category
Structure Panel name
Active class
Local or Global class status
Panel path
Control name
Value or evidence label
Properties that must remain unchanged
Expected position in Structure Panel
Expected visible result
```

---

## Value Evidence Labels

Use these labels for values:

```text
confirmed_implementation_value
explicit_reference_value
user_approved_value
official_documented_value
temporary_test_value
provisional_visual_recommendation
insufficient_evidence
not_applicable
```

Do not present estimated screenshot measurements as exact confirmed values.

---

## Class Entry Rule

```text
Correct: smart-home__feature-card--default
Wrong: .smart-home__feature-card--default
```

In Elementor `CSS Classes`, enter class names without a leading dot.

---

## Output Shape for Each Action

```yaml
action:
  action_id:
  target_element:
  parent:
  element_type:
  element_generation: V4 Atomic Element | V3 element | Shared compatibility element | Unverified element type
  structure_panel_name:
  active_class:
  class_scope: approved_global | approved_local | unverified | not_applicable
  panel_path:
  control_name:
  value:
  value_evidence_label:
  do_not_change:
  expected_result:
```

---

## Stop Conditions

Stop before editing when:

```text
- wrong element is selected;
- wrong class chip is active;
- class is missing from approved map;
- control is not visible;
- V3/V4 element generation is unclear and affects the instruction;
- value source is insufficient for a non-temporary value.
```

---

## Repeated Elements

For repeated cards/items:

```text
1. Build one representative item.
2. Validate structure and class map.
3. Duplicate only after confirmation.
4. Replace only unique content.
5. Do not rebuild repeated items manually unless structure differs.
```
