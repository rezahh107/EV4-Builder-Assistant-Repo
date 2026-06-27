# protocols/PER_ELEMENT_INSTRUCTION

Version: 0.1.2
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
Element generation source
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

## Element Generation Labels

```text
V4 Atomic Element
V3 element
Shared compatibility element
Unverified element type
```

## Element Generation Source Labels

```text
architect_export
builder_context_package
elementor_ui_screenshot
user_statement
versioned_documentation
unverified
```

If `element_generation` is not `Unverified element type`, `element_generation_source` must not be `unverified`.

---

## Output Shape for Each Action

```yaml
action:
  action_id:
  target_element:
  parent:
  element_type:
  element_generation:
  element_generation_source:
  structure_panel_name:
  active_class:
  class_scope:
  panel_path:
  control_name:
  value:
  value_evidence_label:
  do_not_change:
  expected_result:
```

---

## Value Evidence Labels

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

## Unverified Element Type Protocol

`Unverified element type` is a stop label when the element generation affects the next instruction.

If generation affects panel path, class workflow, layout controls, responsive controls, or V3/V4 compatibility:

```text
1. Do not edit the element.
2. Set state to EVIDENCE_REQUIRED or CORRECTION_MODE.
3. Ask for one targeted screenshot of the selected element and visible panel.
4. Do not provide version-sensitive controls.
5. Resume only after the element type is verified or a safe generation-independent action is available.
```

If generation does not affect the next action, a safe generation-independent action may continue, but the element must remain labeled `Unverified element type` until evidence resolves it.

Safe generation-independent actions are limited to:

```text
- naming a Structure Panel item when visible;
- asking for screenshot evidence;
- reading current state;
- confirming already visible class spelling.
```

---

## Stop Conditions

Stop before editing when:

```text
- wrong element is selected;
- wrong class chip is active;
- class is missing from approved map;
- control is not visible;
- element_generation is Unverified element type and affects the instruction;
- element_generation_source is missing;
- element_generation_source is unverified while element_generation is not Unverified element type;
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
