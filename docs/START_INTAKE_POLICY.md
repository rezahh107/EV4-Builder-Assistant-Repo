# START_INTAKE_POLICY

Version: 0.3.0
Status: mode_state_intake_foundation_added
Purpose: fresh-chat intake rules for `START_INTAKE_MODE`.

---

## Trigger

Start word:

```text
شروع
```

Encoded form when needed:

```text
&#x0634;&#x0631;&#x0648;&#x0639;
```

`شروع` starts or safely reruns intake.

Repeated `شروع` must not delete initialized state, confirmed checkpoints, or unresolved evidence. It may refresh the intake checklist and re-check newly provided inputs.

---

## Required Behavior

Before asking for anything, inspect attachments, pasted JSON, copied package text, and visible file references already provided in the current user message.

Do not re-request a valid item already provided.

Ask only for blocking missing items.

Do not silently resolve unknowns.

Do not start building from image-only input unless the user explicitly accepts `FRESH_IMAGE_MODE_LIMITED`.

---

## Intake Data List

```yaml
intake_inputs:
  Builder_Context_Package:
    required: true
    blocks_if_missing: true

  reference_screenshot:
    required: false
    blocks_if_missing: false
    use: visual_reference_only

  checkpoint_or_status_summary:
    required: conditional
    blocks_if_missing: only_when_continuation_is_claimed

  elementor_structure_or_editor_screenshot:
    required: false
    blocks_if_missing: false
    use: current UI evidence when provided
```

Screenshot is optional unless a specific input contract requires it.

If continuing previous work and no checkpoint/status is provided, classify it as blocking only when continuation is actually claimed.

---

## Short intake_checklist Output

When inputs are partial, output a compact checklist instead of a broad request.

Recommended shape:

```yaml
intake_checklist:
  workflow_mode: START_INTAKE_MODE
  runtime_state: EVIDENCE_REQUIRED
  present_inputs: []
  blocking_missing_inputs:
    - Builder_Context_Package
  optional_missing_inputs:
    - reference_screenshot
    - elementor_structure_or_editor_screenshot
  next_needed: Builder_Context_Package
```

Rules:

```text
- Keep it short.
- Include only relevant missing items.
- Separate blocking from optional inputs.
- If Builder_Context_Package is valid, do not ask for it again.
- Optional screenshot absence must not automatically block intake.
```

---

## Structured intake_result

When intake is evaluated, the structured result should follow:

```text
schemas/intake-result.schema.json
```

Decision routing:

```yaml
approved:
  eligible_workflow_mode: APPROVED_HANDOFF_MODE
  eligible_runtime_state: BUILD_ACTIVE

approved_with_optional_gaps:
  eligible_workflow_mode: APPROVED_HANDOFF_MODE
  eligible_runtime_state: BUILD_ACTIVE
  rule: continue with visible optional gaps

blocked_missing_input:
  eligible_workflow_mode: START_INTAKE_MODE
  eligible_runtime_state: EVIDENCE_REQUIRED

blocked_invalid_package:
  eligible_workflow_mode: START_INTAKE_MODE
  eligible_runtime_state: EVIDENCE_REQUIRED

blocked_conflict:
  eligible_workflow_mode: START_INTAKE_MODE
  eligible_runtime_state: EVIDENCE_REQUIRED

blocked_package_status:
  eligible_workflow_mode: START_INTAKE_MODE
  eligible_runtime_state: EVIDENCE_REQUIRED
```

---

## Validation File

```text
input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md
```

After receiving `Builder_Context_Package`, run the input contract.

If valid, enter:

```yaml
workflow_mode: APPROVED_HANDOFF_MODE
runtime_state: BUILD_ACTIVE
```

If blocked, stay in:

```yaml
workflow_mode: START_INTAKE_MODE
runtime_state: EVIDENCE_REQUIRED
```

---

## Runtime Action Cap

```text
5 actions or fewer
```
