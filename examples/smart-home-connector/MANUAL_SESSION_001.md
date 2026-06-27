# MANUAL_SESSION_001 — Smart Home Connector

Status: manual_session_seed_not_live_elementor_validated
Date: 2026-06-27
Mode: APPROVED_HANDOFF_MODE
Selected candidate: ARCH-FAM-C
Package: `examples/smart-home-connector/builder_context_package.json`

---

## Purpose

This file records the first controlled manual-session seed after schema validation passed.

This is not a real Elementor execution report yet.

---

## Preconditions

```yaml
preconditions:
  schema_validation_workflow: passed_user_reported
  builder_context_package_schema: available
  cross_field_validator: available
  project_setup_guide: docs/CHATGPT_PROJECT_SETUP_GUIDE.md
  production_ready_allowed: false
```

---

## Expected First Runtime State

```yaml
runtime_state:
  mode: APPROVED_HANDOFF_MODE
  selected_candidate_id: ARCH-FAM-C
  source_of_truth: Builder_Context_Package
  production_ready: false
  first_target_scope:
    - Smart Home Section / Root
    - Smart Home Section / Relative Stage
    - Smart Home Section / Content Layer
```

---

## First Batch Contract

The first response should provide only the first small builder batch from the package.

Expected first three targets:

```text
Smart Home Section / Root
Smart Home Section / Relative Stage
Smart Home Section / Content Layer
```

Expected approved classes:

```text
smart-home__section--root
smart-home__stage--relative
smart-home__content-layer--primary
```

Expected generation metadata:

```text
element_generation: Shared compatibility element
element_generation_source: architect_export
```

Expected confirmation sentence:

```text
Root, Relative Stage, and Content Layer are created.
```

---

## Expected Checkpoint After Confirmation

```yaml
checkpoint_id: smart-home-manual-001-cp-001
created_from: user_confirmation
selected_candidate_id: ARCH-FAM-C
completed_elements:
  - Smart Home Section / Root
  - Smart Home Section / Relative Stage
  - Smart Home Section / Content Layer
applied_classes:
  - smart-home__section--root
  - smart-home__stage--relative
  - smart-home__content-layer--primary
last_completed_action: BATCH-001-A03
next_pending_action: create Feature Cards Group
```

---

## Preserved Unknowns

```text
mobile/tablet screenshot absent
connector behavior across breakpoints unresolved
icon/house accessibility semantics unresolved
connector geometry unresolved
asset source unresolved
exact token values unknown
```

---

## Real Execution Status

```yaml
real_elementor_execution:
  first_batch_executed: no
  editor_screenshot_checked: no
  frontend_screenshot_checked: no
  browser_render_checked: no
  export_json_or_edis_checked: no
  production_ready: false
```

---

## Next Step

Use the setup guide and Smart Home start prompt in a real Builder Assistant project/chat, then record actual execution findings in `notes.md`.
