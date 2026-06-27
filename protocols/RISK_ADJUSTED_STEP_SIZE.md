# protocols/RISK_ADJUSTED_STEP_SIZE

Version: 0.1.0
Status: active
Purpose: adjust builder action batch size by risk

---

## Default Rule

Default builder response size:

```text
up to 5 small related actions per turn
```

Use fewer actions when risk increases.

---

## Risk-Based Batch Size

```yaml
low_risk_structure:
  max_actions: 5
  examples:
    - create approved wrapper elements
    - rename Structure Panel items
    - apply approved classes

medium_risk_styling:
  max_actions: 2
  examples:
    - typography size and line height
    - spacing values
    - simple alignment settings

high_risk_visual_calibration:
  max_actions: 1
  examples:
    - numeric visual tuning
    - shadow/effect tuning
    - absolute/overlay positioning
    - responsive overrides
    - SVG rendering fixes
    - z-index or overflow changes

control_mismatch_or_missing_evidence:
  max_actions: 0
  action: ask for targeted evidence or enter CORRECTION_MODE
```

---

## High-Risk Stop Conditions

Use one action only when the next instruction changes:

```text
position
z-index
overflow
responsive breakpoint behavior
absolute offsets
SVG asset behavior
shadow/effects
class priority/local-vs-global behavior
numeric values derived from visual matching
```

---

## Confirmation

Every high-risk action must end with:

```text
one exact confirmation sentence
or one targeted screenshot request
```

---

## Repeated Items

Repeated items use this sequence:

```text
build one representative item
verify structure and class map
duplicate
replace only unique content or asset
verify frontend
```

Do not rebuild repeated items manually unless their structure differs.
