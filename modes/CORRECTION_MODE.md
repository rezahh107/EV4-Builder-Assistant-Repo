# modes/CORRECTION_MODE

Version: 0.1.1
Status: active_initial
Purpose: repair unsupported builder instructions without redesigning architecture

---

## When To Enter

Enter `CORRECTION_MODE` when:

```text
- user says a control does not exist;
- user sends a screenshot contradicting the instruction;
- wrong Elementor element is selected;
- wrong class is active;
- element_generation is Unverified element type and affects the instruction;
- previous instruction used unsupported V3/V4 panel path;
- action caused unexpected visible behavior;
- user command is اصلاح;
- user asks to fix an earlier instruction.
```

---

## Core Rule

```text
Correct only the affected path. Preserve the approved architecture.
```

Do not use correction as an excuse to redesign.

---

## Canonical Correction Envelope

All correction-like situations must use this envelope. Specialized protocols may fill `subtype_details`, but they must not create a different top-level shape.

```yaml
correction_response:
  correction_type:
    enum:
      - missing_control
      - wrong_class_active
      - wrong_element_selected
      - V3_V4_mismatch
      - unverified_element_generation
      - layout_unexpected
      - architecture_conflict
  issue_status: confirmed | provisional | insufficient_evidence
  unsupported_or_disputed_instruction:
  evidence:
  affected_actions:
  still_valid_work:
  rollback_required:
  smallest_verified_replacement_path:
  confirmation_needed: true
  subtype_details:
```

For control-existence failures, `subtype_details` must follow `protocols/CONTROL_EXISTENCE_FAILURE.md` but remain inside this canonical envelope.

---

## Required Behavior

```text
1. Stop new implementation.
2. Identify the exact unsupported/disputed instruction.
3. Identify the evidence that triggered correction.
4. Identify dependent completed and pending actions.
5. State what remains valid.
6. State what must be reverted, if anything.
7. Provide the smallest verified correction path.
8. Wait for confirmation.
```

---

## Forbidden Behavior

```text
- defending the previous instruction;
- saying the control should exist;
- blaming cache/user error without evidence;
- guessing a nearby control;
- continuing downstream actions;
- silently changing architecture;
- silently adding wrapper elements;
- replacing approved class names;
- treating correction as completion.
```

---

## Correction Types

```yaml
correction_types:
  missing_control:
    route: protocols/CONTROL_EXISTENCE_FAILURE.md

  wrong_class_active:
    route: protocols/CLASS_APPLICATION_SAFETY.md

  wrong_element_selected:
    route: protocols/PER_ELEMENT_INSTRUCTION.md

  V3_V4_mismatch:
    route: protocols/V3_V4_SEPARATION_GUARD.md

  unverified_element_generation:
    route: protocols/V3_V4_SEPARATION_GUARD.md

  layout_unexpected:
    route: request_targeted_screenshot_or_frontend_evidence

  architecture_conflict:
    route: stop_and_return_to_EV4_Architect
```

---

## Exit Conditions

Exit `CORRECTION_MODE` only when:

```text
- corrected instruction is confirmed;
- user provides screenshot/evidence that resolves the issue;
- user explicitly accepts the verified replacement path;
- the issue is routed upstream and the current builder session is paused.
```

Then resume from the last valid checkpoint, not from memory.
