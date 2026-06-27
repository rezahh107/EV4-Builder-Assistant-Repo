# protocols/NEW_CHAT_START_INTAKE

Version: 0.3.0
Status: mode_state_intake_foundation_added
Purpose: define what happens when the user starts or reruns a Builder Assistant intake with `شروع`

---

## Trigger

When the user opens a new chat inside the EV4 Builder Assistant Project and writes only:

```text
شروع
```

or starts with:

```text
شروع:
```

enter:

```yaml
workflow_mode: START_INTAKE_MODE
runtime_state: INTAKE_WAITING
```

Do not start building yet.

Repeated `شروع` reruns intake safely. It must not delete initialized state or verified checkpoints.

---

## Inspect Before Asking

Before requesting data, inspect:

```text
- uploaded files
- pasted JSON
- copied Builder_Context_Package text
- visible checkpoint/status summaries
- current Elementor screenshots or references
```

Do not re-request an item that is already valid.

Ask only for blocking missing items.

---

## Intake Inputs

```yaml
intake_inputs:
  Builder_Context_Package:
    required: true
    blocks_if_missing: true

  reference_screenshot:
    required: false
    blocks_if_missing: false
    allowed_use: visual_reference_only

  checkpoint_or_status_summary:
    required: conditional
    blocks_if_missing: only_when_continuation_is_claimed

  elementor_structure_or_editor_screenshot:
    required: false
    blocks_if_missing: false
    allowed_use: current_ui_evidence_when_provided
```

Screenshot is optional unless a specific contract requires it.

---

## If Inputs Are Partial

Output a short `intake_checklist`.

Example:

```yaml
intake_checklist:
  workflow_mode: START_INTAKE_MODE
  runtime_state: EVIDENCE_REQUIRED
  present_inputs:
    - reference_screenshot
  blocking_missing_inputs:
    - Builder_Context_Package
  optional_missing_inputs:
    - elementor_structure_or_editor_screenshot
  next_needed: Builder_Context_Package
```

Do not output a long broad request when only one blocking item is missing.

---

## If Builder_Context_Package Is Missing

Do not build from screenshot alone unless the user explicitly accepts `FRESH_IMAGE_MODE_LIMITED`.

Ask for:

```text
Builder_Context_Package یا خروجی /builder-feed-export
```

If the user only has an image, say that the audited path requires EV4 Architect first, or that `FRESH_IMAGE_MODE_LIMITED` is fallback-only and not audited architecture.

---

## If Package Is Present

Set:

```yaml
workflow_mode: START_INTAKE_MODE
runtime_state: INTAKE_VALIDATING
```

Run:

```text
input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md
```

Then output a compact `intake_result` compatible with:

```text
schemas/intake-result.schema.json
```

If pass, enter:

```yaml
workflow_mode: APPROVED_HANDOFF_MODE
runtime_state: BUILD_ACTIVE
```

If optional evidence is missing but the package is valid, use:

```yaml
decision: approved_with_optional_gaps
```

If blocked, stay in:

```yaml
workflow_mode: START_INTAKE_MODE
runtime_state: EVIDENCE_REQUIRED
```

---

## Distinction From `استارت`

`شروع` is for intake.

`استارت` resumes from an existing checkpoint inside an already initialized session.
