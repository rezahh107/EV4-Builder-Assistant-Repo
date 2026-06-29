# protocols/UNIT_STRATEGY_GATE

Version: 0.1.0
Status: active
Purpose: prevent intrinsic asset dimensions or unproven units from becoming executable Elementor layout values.

---

## Trigger Conditions

Run this gate before emitting any numeric value for a control that can affect layout size, position, overlay geometry, responsive behavior, or visual calibration.

Examples include Width, Height, Min/Max size, Top/Right/Bottom/Left offsets, Gap, Padding/Margin when used for layout, Z-index/positioning context, SVG/image sizing, overlay anchor values, and breakpoint-specific numeric overrides.

---

## Required Numeric Value Contract

A numeric layout/position value is executable only when the assistant can name:

```yaml
control:
proposed_value:
proposed_unit:
value_source:
responsive_scope:
affects_layout:
affects_position:
reversible:
safe_to_emit:
reason:
required_next_action:
```

Allowed `value_source` values:

```text
package_approved
user_confirmed
visible_ui
measured_layout
asset_intrinsic
temporary_calibration
official_docs
unknown
```

Allowed `responsive_scope` values:

```text
desktop_only
breakpoint_specific
global
unknown
```

---

## Unit Strategy Rules

1. Numeric layout values require an explicit unit strategy before emission.
2. Intrinsic asset dimensions may inform aspect ratio only; they are not layout intent.
3. `asset_intrinsic` alone must not be used as executable layout size or position.
4. `unknown` value source or `unknown` responsive scope is not safe for layout/position emission.
5. `px` is valid only when the source and scope are proven, such as package-approved value, user confirmation, visible UI evidence, measured layout, or a declared reversible desktop-only temporary calibration.
6. Responsive behavior must not be implied from a desktop-only calibration.

---

## May Emit Numeric Values

Builder may emit the numeric value only when:

```yaml
safe_to_emit: true
proposed_unit: non_empty
value_source: not_unknown
responsive_scope: not_unknown
reversible: true
```

For controls affecting layout or position, `value_source` must be stronger than asset intrinsic dimensions alone.

---

## Must Ask For Evidence

Ask for targeted evidence instead of emitting the value when:

```text
- unit strategy is unknown;
- the exact control or unit selector is not visible/confirmed;
- value_source is unknown;
- responsive_scope is unknown;
- a proposed layout/position value is based only on asset_intrinsic dimensions;
- the action is not reversible;
- a responsive claim would be introduced without breakpoint evidence.
```

---

## Repair Packet Requirement

If Builder already emitted or applied an unsafe numeric layout/position value, freeze normal build work and create/update a Session Repair Packet.

Preferred existing incident types:

```text
unsupported_assumption
root_pipeline_gap
missing_ui_control
layout_instability
```

Use `unsupported_assumption` when intrinsic size or an unproven unit was treated as executable. Use `root_pipeline_gap` when the incident exposes a repository/runtime protocol defect. Do not invent a new incident type unless schema compatibility is updated separately.

---

## Interaction With Session Repair Packet

`protocols/SESSION_REPAIR_PACKET.md` remains authoritative for incident freeze/resume behavior. This gate only adds a trigger and safety check. When a repair packet is active:

```yaml
normal_builder_batch_allowed: false
numeric_layout_emit_allowed: false
resume_only_via: repair_packet.resume_condition
production_ready: false
```
