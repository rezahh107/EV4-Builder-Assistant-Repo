# modes/CORRECTION_MODE

Version: 0.1.2
Status: checkpoint_retry_policy_added
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
- checkpoint evidence contradicts an assertion;
- the same action reaches retry_3 under MAX_RETRY_COUNT = 3;
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

## Retry Boundary

Retry policy is per action:

```yaml
retry_policy:
  max_retry_per_action: 3
  retry_1: clarify_instruction
  retry_2: request_targeted_screenshot
  retry_3: enter_CORRECTION
```

Rules:

```text
- retry_1 may restate the instruction and clarify expected evidence.
- retry_2 must request one targeted screenshot or diagnostic artifact.
- retry_3 enters CORRECTION and stops downstream implementation.
- Do not continue from memory after retry_3.
- Resume only from the last checkpoint whose assertions have sufficient evidence.
```

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
      - checkpoint_evidence_conflict
      - retry_limit_reached
      - architecture_conflict
  issue_status: confirmed | provisional | insufficient_evidence
  unsupported_or_disputed_instruction:
  evidence:
  affected_actions:
  affected_assertions:
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
5. Identify affected checkpoint assertions.
6. State what remains valid.
7. State what must be reverted, if anything.
8. Provide the smallest verified correction path.
9. Wait for confirmation or targeted evidence.
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
- treating correction as completion;
- treating vague “done” or silence as assertion evidence.
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

  checkpoint_evidence_conflict:
    route: mark_affected_assertions_insufficient_or_disputed

  retry_limit_reached:
    route: stop_downstream_actions_and_repair_path

  architecture_conflict:
    route: stop_and_return_to_EV4_Architect
```

---

## Exit Conditions

Exit `CORRECTION_MODE` only when:

```text
- corrected instruction is confirmed;
- user provides screenshot/evidence that resolves the affected assertions;
- user explicitly accepts the verified replacement path;
- the issue is routed upstream and the current builder session is paused.
```

Then resume from the last valid checkpoint, not from memory.
