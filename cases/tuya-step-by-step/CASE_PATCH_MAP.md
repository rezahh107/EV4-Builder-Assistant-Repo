# CASE_PATCH_MAP — TUYA Step-By-Step Case

Version: 0.1.0
Status: active

---

## Purpose

This file maps TUYA case lessons to Builder Assistant repo changes.

---

## Patch Map

```yaml
risk_adjusted_steps:
  file: protocols/RISK_ADJUSTED_STEP_SIZE.md
  lesson: use smaller batches for high-risk visual or responsive edits

style_system_gate:
  file: protocols/STYLE_SYSTEM_CAPABILITY_GATE.md
  lesson: do not force every reusable style into Variable

overlay_pattern:
  file: protocols/CONTROLLED_OVERLAY_STAGE_PATTERN.md
  lesson: content stays in flow, decoration uses controlled overlay

repeated_items:
  file: protocols/REPEATED_ELEMENT_DUPLICATION_PROTOCOL.md
  lesson: build one, verify, duplicate

responsive_guard:
  file: protocols/RESPONSIVE_WORKFLOW_GUARD.md
  lesson: do not assume mobile/tablet behavior from desktop or workbook

reading_order:
  file: protocols/READING_ORDER_CHECKLIST.md
  lesson: decorative layers must not define meaningful reading order

official_docs_priority:
  file: protocols/OFFICIAL_ELEMENTOR_DOCS_PRIORITY.md
  lesson: official Elementor docs are primary external source

workbook_boundary:
  file: protocols/WORKBOOK_REFERENCE_BOUNDARY.md
  lesson: workbook helps method, not current control existence
```

---

## Status

```yaml
case_import_status: imported
repo_version_target: v0.2.3
real_elementor_validation: not_in_this_file
production_ready: false
```
