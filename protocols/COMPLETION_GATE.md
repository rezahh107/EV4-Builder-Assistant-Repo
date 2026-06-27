# protocols/COMPLETION_GATE

Version: 0.1.0
Status: active_initial
Purpose: prevent over-claiming build completion or production readiness

---

## Core Rule

A Builder Assistant session may report build progress, but it must not claim production readiness without real evidence.

Completion is not one Boolean. It is a checklist of separately verified states.

---

## Required Completion Report

Before declaring implementation complete, report every item:

```yaml
completion_gate:
  structure_completed: confirmed | not_checked | insufficient_evidence | not_applicable
  classes_applied: confirmed | not_checked | insufficient_evidence | not_applicable
  desktop_frontend_checked: confirmed | not_checked | insufficient_evidence | not_applicable
  tablet_checked: confirmed | not_checked | insufficient_evidence | not_applicable
  mobile_checked: confirmed | not_checked | insufficient_evidence | not_applicable
  accessibility_semantics_checked: confirmed | not_checked | insufficient_evidence | not_applicable
  svg_safety_checked: confirmed | not_checked | insufficient_evidence | not_applicable
  browser_rendering_checked: confirmed | not_checked | insufficient_evidence | not_applicable
  real_elementor_export_checked: confirmed | not_checked | insufficient_evidence | not_applicable
  EDIS_validation_checked: confirmed | not_checked | insufficient_evidence | not_applicable
  exact_pixel_matching_checked: confirmed | not_checked | insufficient_evidence | not_applicable
  production_ready: false
```

---

## Status Definitions

```yaml
confirmed:
  meaning: verified by user confirmation, screenshot, frontend evidence, diagnostic, or export evidence

not_checked:
  meaning: no check has been performed yet

insufficient_evidence:
  meaning: partial evidence exists but does not prove the claim

not_applicable:
  meaning: item structurally does not apply to this build and reason is stated
```

---

## Production Boundary

Do not claim:

```text
production-ready
release-ready
pixel-perfect
live Elementor validated
export JSON validated
EDIS validated
browser QA complete
```

unless the required evidence exists.

---

## Handoff to Responsive Architect

If build structure is complete but responsive checks remain unresolved, report:

```text
controlled_builder_completion_with_responsive_flags
```

Then list what responsive evidence is still needed.

---

## Final Summary Format

```text
Builder Session Result
- Structure:
- Classes:
- Desktop frontend:
- Responsive:
- Accessibility:
- Export/EDIS:
- Remaining unknowns:
- Recommended next system:
```

The recommended next system is usually:

```text
EV4 Responsive Architect
```

when tablet/mobile repair or validation remains.
