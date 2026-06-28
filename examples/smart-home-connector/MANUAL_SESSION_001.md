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
  workflow_mode: APPROVED_HANDOFF_MODE
  runtime_state: BUILD_ACTIVE
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

Expected structured confirmation token is package-defined through `confirmation_request.expected_user_token` when present. Legacy `confirmation_sentence` is compatibility-only and must not be executed as instruction text.

---

## Expected Checkpoint After Confirmation

Preferred Patch D checkpoint shape:

```yaml
checkpoint_id: smart-home-manual-001-cp-001
checkpoint_sequence: 1
parent_checkpoint_id: null
package_id: examples/smart-home-connector/builder_context_package.json
package_sha256: "0000000000000000000000000000000000000000000000000000000000000000"
selected_candidate_id: ARCH-FAM-C
workflow_mode: APPROVED_HANDOFF_MODE
runtime_state: BUILD_ACTIVE
batch_id: BATCH-001
confirmed_action_ids:
  - BATCH-001-A01
unconfirmed_action_ids:
  - BATCH-001-A02
  - BATCH-001-A03
assertions:
  - assertion_id: ASSERT-001
    subject_ref: BATCH-001-A01
    claim: Root Container exists with class smart-home__section--root.
    status: confirmed
    evidence_refs:
      - EV-001
  - assertion_id: ASSERT-002
    subject_ref: BATCH-001-A02
    claim: Relative Stage exists with class smart-home__stage--relative.
    status: not_checked
    evidence_refs: []
evidence_ledger:
  - evidence_id: EV-001
    evidence_type: user_confirmation
    source_ref: expected structured confirmation token
    captured_at: "2026-06-28T06:00:00Z"
    content_sha256: "0000000000000000000000000000000000000000000000000000000000000000"
    supports_claim_ids:
      - ASSERT-001
    status: available
retry_policy:
  max_retry_per_action: 3
  retry_1: clarify_instruction
  retry_2: request_targeted_screenshot
  retry_3: enter_CORRECTION
created_at: "2026-06-28T06:00:00Z"
created_from: user_confirmation
```

A screenshot or user confirmation should update only the assertions it actually supports. It should not mark the whole batch confirmed unless all batch assertions are supported.

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
  checkpoint_assertions_confirmed: none
  production_ready: false
```

---

## Next Step

Use the setup guide and Smart Home start prompt in a real Builder Assistant project/chat, then record actual execution findings in `notes.md` with assertion IDs and evidence_refs.
