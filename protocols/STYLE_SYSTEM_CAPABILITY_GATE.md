# protocols/STYLE_SYSTEM_CAPABILITY_GATE

Version: 0.1.0
Status: active
Purpose: prevent unsupported Variable/Class/Component assumptions

---

## Purpose

Before turning a reusable style into a Variable, Global Class, Local Class, Component, or CSS rule, classify the reuse type.

---

## Reuse Classification

Ask:

```text
Is this only a repeated value?
Is this a repeated style bundle?
Is this a repeated structure?
Is this a one-off local override?
Is the feature officially supported in the current Elementor context?
```

---

## Decision Map

```yaml
repeated_value:
  preferred_tool: Variable
  evidence_required: official Elementor support or visible UI

repeated_style_bundle:
  preferred_tool: Global Class
  evidence_required: active class workflow confirmed

repeated_structure:
  preferred_tool: Component candidate or duplicated verified pattern
  evidence_required: user approval and current tool support

one_off_exception:
  preferred_tool: Local Class or scoped local setting
  evidence_required: reason documented

unsupported_or_unclear_style_type:
  preferred_tool: approved Global Class or css_needed_later
  evidence_required: do not force Variable
```

---

## Shadow / Compound Style Rule

Do not assume compound styles such as complex shadows, effects, or multi-part visual treatments are supported as Variables.

If official docs or current UI do not confirm a Variable type, store the reusable style in an approved Global Class or mark it as `css_needed_later`.

---

## Anti-Patterns

```text
Variable everything
Component too early
class explosion
Local styles for every repeated element
CSS before native controls are checked
```

---

## Output Label

For style-system decisions, include:

```yaml
style_system_decision:
  reuse_type:
  selected_tool:
  evidence_source:
  reason:
  fallback_if_unavailable:
```
