# ATOMIC_ELEMENTS_UI_OBSERVATION_2026-06-28

Status: user_provided_ui_evidence
Source: user-provided screenshots from an Elementor Atomic UI panel.
Use: local UI vocabulary aid for this user's Elementor environment. This is not universal official documentation.

---

## Observed Atomic Elements

The screenshot shows an `Atomic Elements` group with these visible labels:

```text
Div block
Flexbox
Tabs
Heading
Image
Paragraph
SVG
Button
Divider
```

Implication for Builder Assistant output:

```text
Architecture/package term `Container` must not be shown as the only executable UI label.
For user-facing build steps, prefer the user's observed UI vocabulary such as `Flexbox` or `Div block` when confirmed for the target role.
```

---

## Observed Atomic Form Elements

The screenshot shows an `Atomic Form` group with these visible labels:

```text
Atomic form
Input
Label
Text area
Submit button
Checkbox
Radio button
Date picker
Time picker
Select
File Upload
```

---

## Safety Boundary

This evidence can support a `ui_vocabulary_map` entry for the current user/session.

It must not override:
- official Elementor docs for capability claims;
- current UI screenshots if a later screenshot differs;
- the approved Builder_Context_Package architecture;
- `selected_candidate_id`;
- approved class names.

If the user says their UI differs, prefer the latest user statement or screenshot.
