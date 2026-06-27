# protocols/V3_V4_SEPARATION_GUARD

Version: 0.1.0
Status: active_initial
Purpose: prevent Elementor generation confusion

---

## Core Rule

Do not treat Elementor V3, V4 Atomic Elements, legacy Containers, Flexbox, Div Block, Section, Column, and Grid Container as interchangeable.

For every selected element, classify it as one of:

```text
V4 Atomic Element
V3 element
Shared compatibility element
Unverified element type
```

---

## Forbidden

```text
- Use a V3 panel path for a V4 Atomic Element.
- Use a V4 class workflow for a V3 element without compatibility evidence.
- Call a legacy Container an Atomic Flexbox.
- Assume a control is shared between generations.
- Use a beta/alpha control as if it exists in the user's installed version.
```

---

## No-Grid Assumption

Do not instruct:

```text
Display: Grid
```

unless one is true:

```text
- Grid is visible in the current Elementor V4+ interface;
- user explicitly confirms Grid is present;
- official version-matched V4+ documentation confirms Grid for the selected element type.
```

The following do not prove Grid availability:

```text
- CSS Grid support in browsers;
- a visual design that looks grid-like;
- legacy Grid Container;
- e-grid data node;
- workbook concept examples;
- old screenshots from another installation.
```

---

## If Generation Is Unknown

If the selected element generation is unknown and affects the instruction:

```text
1. Stop.
2. Ask for a targeted screenshot of the selected element and panel.
3. Mark element_generation: Unverified element type.
4. Do not provide version-sensitive controls until verified.
```

---

## Safe Replacement Rule

If a control is unavailable:

```text
- preserve the approved semantic structure;
- inspect available layout controls;
- propose Flex/nested/width/wrap alternative only when visible or confirmed;
- label replacement as proposed until confirmed;
- route architecture-level conflicts back to EV4 Architect.
```
