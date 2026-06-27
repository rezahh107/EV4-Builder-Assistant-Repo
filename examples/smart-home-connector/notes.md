# Notes — Smart Home Connector Example

Status: reference_layer_added_v0.2.3

---

## Scope

This example is a builder execution seed for `ARCH-FAM-C`.

It is not a full regenerated EV4 Architect run.

---

## CI Status

```yaml
schema_validation_workflow:
  status: passed
  evidence_source: user_reported_github_ui
  date: 2026-06-27
  note: run again after v0.2.3 reference-layer changes
```

The repository has schema, fixture, checkpoint, and cross-field validation coverage.

---

## v0.2.3 Reference Rules

```text
Official Elementor docs are the primary external source for standard capability claims.
Current Elementor UI evidence is required for executable control paths.
TUYA workbook is a methodology/reference layer.
TUYA step-by-step case is case memory, not a fixed architecture template.
```

Related files:

```text
protocols/OFFICIAL_ELEMENTOR_DOCS_PRIORITY.md
protocols/WORKBOOK_REFERENCE_BOUNDARY.md
references/tuya-workbook/EXTRACTED_BUILDER_RULES.md
cases/tuya-step-by-step/CASE_LESSONS.md
```

---

## Manual Session Seed

Manual session seed file:

```text
examples/smart-home-connector/MANUAL_SESSION_001.md
```

Project setup guide:

```text
docs/CHATGPT_PROJECT_SETUP_GUIDE.md
```

---

## Preserved Unknowns

```text
mobile/tablet screenshot absent
connector behavior across breakpoints unresolved
icon/house accessibility semantics unresolved
connector geometry unresolved
exact asset source/format unknown
exact token values unknown
```

---

## Smart Home Transfer Rules

```text
Feature cards: meaningful flow content.
House visual: visual core.
Connector lines: decoration-only overlay.
Mobile/tablet connector behavior: unresolved until evidence.
Repeated cards: build one, verify, duplicate.
```

---

## Element Generation Labels

This example uses:

```text
Shared compatibility element
```

Generation source:

```text
architect_export
```

In a real builder session, the live Elementor UI can still override practical control paths through `LIVE_INTERFACE_PRECEDENCE`.

---

## Production Boundary

```text
production_ready: false
live Elementor rendering: not checked
real export JSON / EDIS: not checked
exact pixel matching: not checked
```

---

## Next Real Session Fields To Record

```yaml
real_session:
  session_id:
  date:
  first_response_matches_expected: yes/no/partial
  official_docs_checked_when_needed: yes/no/not_needed
  first_batch_executed_in_elementor: yes/no
  checkpoint_created: yes/no
  editor_screenshot_checked: yes/no
  frontend_screenshot_checked: yes/no
  missing_controls:
  drift_found:
  correction_needed:
  next_action:
```
