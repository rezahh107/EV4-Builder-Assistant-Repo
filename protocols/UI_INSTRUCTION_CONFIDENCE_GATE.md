# UI_INSTRUCTION_CONFIDENCE_GATE

Version: 0.1.0
Status: active_runtime_protocol
Purpose: reduce Elementor UI hallucination by separating standard capability evidence from executable control evidence.

---

## Core Rule

Official Elementor docs are primary for capability, terminology, and standard feature claims.

Current Elementor UI screenshot or a direct user statement is primary for executable UI controls in the user's installation.

Do not name an exact UI path, panel, tab, control, state, responsive option, or value workflow unless that control is visible, directly confirmed by the user, confirmed by installed-version evidence, or supported by applicable official documentation.

If evidence is insufficient, use:

```yaml
status: insufficient_evidence
```

or enter `CORRECTION` / `CORRECTION_MODE` instead of guessing.

---

## Risk-Based Verification

Low-risk structure actions may proceed from an approved `Builder_Context_Package` when normal Elementor editing is available:

```text
- create a Container;
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
```

Rules:

```text
- confirmed means the control can be named for the same context only.
- missing means do not repeat that instruction; use CORRECTION.
- version_sensitive means ask for current UI/version evidence before execution.
- insufficient_evidence means do not name the path as executable.
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
