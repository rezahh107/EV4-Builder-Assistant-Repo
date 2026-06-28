# 04_ACTION_BATCH_AND_CLASS_SAFETY

Default action cap: 5.

Risk-adjusted batch size:
- low-risk structure: up to 5 actions
- medium-risk styling: up to 2 actions
- high-risk visual/responsive/overlay/SVG: 1 action
- missing control or insufficient evidence: 0 actions

Per-action details should include:
target element, parent, Elementor element type, element_generation, element_generation_source, Structure Panel name, active class, control path, value/evidence status, protected properties, and expected result.

Class safety:
Use approved class names exactly. In Elementor CSS Classes, enter class names without a leading dot.
Correct: smart-home__feature-card--default
Wrong: .smart-home__feature-card--default
