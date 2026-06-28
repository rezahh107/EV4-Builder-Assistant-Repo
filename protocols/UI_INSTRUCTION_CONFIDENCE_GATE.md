# UI_INSTRUCTION_CONFIDENCE_GATE

Version: 0.2.0
Status: user_facing_builder_ux_added
Purpose: reduce Elementor UI hallucination by separating standard capability evidence from executable control evidence and user-facing UI vocabulary.

---

## Core Rule

Official Elementor docs are primary for capability, terminology, and standard feature claims.

Current Elementor UI screenshot or a direct user statement is primary for executable UI controls in the user's installation.

Do not name an exact UI path, panel, tab, control, state, responsive option, value workflow, or user-facing element label unless that control/label is visible, directly confirmed by the user, confirmed by installed-version evidence, or supported by applicable official documentation.

If evidence is insufficient, use:

```yaml
status: insufficient_evidence
```

or enter `CORRECTION` / `CORRECTION_MODE` instead of guessing.

---

## Risk-Based Verification

Low-risk structure actions may proceed from an approved `Builder_Context_Package` when normal Elementor editing is available:

```text
- create a layout parent using a confirmed UI label;
- create a basic Heading/Text/Image/Icon element;
- rename a Structure Panel item;
- apply an approved class name exactly as supplied;
- ask for a targeted screenshot.
```

These do not prove version-sensitive controls and must not include invented exact panel paths.

High-risk or version-sensitive instructions require current UI evidence, direct user confirmation, installed-version evidence, or applicable official docs:

```text
- exact control paths;
- responsive controls;
- SVG settings;
- overlay, z-index, overflow, absolute/relative positioning controls;
- grid controls;
- Variables;
- Components;
- interaction/state controls;
- class-management UI behavior;
- any panel whose name or location differs across Elementor generations.
```

If a required control is missing, stop and enter `CORRECTION`.

---

## Architecture Term vs User-Facing UI Label

Package terms are not always executable UI labels.

Example:

```yaml
architecture_term: Container
possible_user_ui_labels:
  - Flexbox
  - Div block
  - Flex
  - Div
  - Container
```

Normal builder output should use the user's confirmed UI label.

Do not show `Elementor element type: Container` as the only instruction when the current UI displays `Flexbox` or `Div block`.

If the UI label is unknown, ask a short UI vocabulary sync question before relying on it.

---

## User-Provided Atomic UI Observation

A user-provided screenshot on 2026-06-28 showed `Atomic Elements` labels including:

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

A second screenshot showed `Atomic Form` labels including:

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

Use:

```text
references/elementor-ui/ATOMIC_ELEMENTS_UI_OBSERVATION_2026-06-28.md
```

This is local user UI evidence, not universal official docs.

---

## known_control_map

A session may maintain a small evidence map for controls already verified in the user's UI.

```yaml
known_control_map:
  - control_name:
    panel_name:
    element_generation:
    confirmed_by: user_statement | screenshot | documentation | installed_version
    evidence_ref:
    status: confirmed | missing | version_sensitive | insufficient_evidence
    session_confirmed_at:
```

Rules:

```text
- confirmed means the control can be named for the same context only.
- missing means do not repeat that instruction; use CORRECTION.
- version_sensitive means ask for current UI/version evidence before execution.
- insufficient_evidence means do not name the path as executable.
```

---

## ui_vocabulary_map

Use this map to remember user-facing labels for architecture terms.

```yaml
ui_vocabulary_map:
  - vocabulary_key: layout_parent
    architecture_term: Container
    user_ui_label: Flexbox
    confirmed_by: user_statement | screenshot | documentation | installed_version
    confirmed_at_checkpoint:
    status: confirmed | unknown | changed | insufficient_evidence
```

---

## Screenshot Recipe

Use this compact recipe when UI evidence is needed:

```text
Screenshot target:
- selected element:
- show:
- active class:
- panel/tab:
- crop:
```

Example:

```text
Screenshot target:
- selected element: Smart Home Section / Relative Stage
- show: left Structure Panel + right/current settings panel
- active class: smart-home__stage--relative
- panel/tab: Layout or Advanced, whichever contains the disputed control
- crop: include the full panel header and visible controls
```

---

## Stop Conditions

Stop and route to `CORRECTION` when:

```text
- the user says the named control does not exist;
- screenshot contradicts the instruction;
- the selected element or active class is wrong;
- an exact control path was not verified but is required for the action;
- V3/V4 generation affects the instruction and is unresolved.
```

Do not continue downstream actions from memory after a missing-control report.
