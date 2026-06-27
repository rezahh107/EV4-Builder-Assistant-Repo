# modes/CORRECTION_MODE

Version: 0.1.0
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

## Required Response

A correction response must include:

```yaml
correction_response:
  issue_status: confirmed | provisional | insufficient_evidence
  unsupported_or_disputed_instruction:
  evidence:
  affected_actions:
  still_valid_work:
  rollback_required:
  smallest_verified_replacement_path:
  confirmation_needed:
```

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
    route: live_interface_precedence

  wrong_class_active:
    route: class_application_safety

  wrong_element_selected:
    route: per_element_instruction_contract

  V3_V4_mismatch:
    route: V3_V4_SEPARATION_GUARD

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
