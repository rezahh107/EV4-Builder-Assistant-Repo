# REPOSITORY_GUIDE — EV4 Builder Assistant

Version: 0.1.0
Status: initial_living_guide
Date: 2026-06-27

---

## Purpose

This guide explains what this repository is, why it exists, how the files relate to each other, and how to continue development later without losing the original design intent.

This is a living guide. It must be expanded again after examples, tests, and real builder-session validation are added.

---

## Big Picture

```text
EV4 Architect
= decides what should be built.

EV4 Builder Assistant
= helps the user build the approved structure inside Elementor.

EV4 Responsive Architect
= validates and repairs responsive behavior after real implementation evidence exists.
```

This repository is only the middle system.

---

## Main Runtime Flow

```text
Builder_Context_Package
        │
        ▼
Input Contract Check
        │
        ▼
APPROVED_HANDOFF_MODE
        │
        ▼
Action Batch
        │
        ▼
User executes in Elementor
        │
        ▼
Confirmation / screenshot / issue report
        │
        ▼
Checkpoint update or CORRECTION_MODE
        │
        ▼
Next Action Batch
```

---

## File Families

### `PROJECT_INSTRUCTIONS.md`

The compact always-on instruction layer for the ChatGPT Project.

It should stay concise and under project instruction limits.

### `core/`

Always-active runtime behavior.

```text
MASTER_PROMPT.md
SESSION_STATE_MACHINE.md
LIVE_INTERFACE_PRECEDENCE.md
```

### `modes/`

Mode-specific behavior.

```text
APPROVED_HANDOFF_MODE.md
CORRECTION_MODE.md
FRESH_IMAGE_MODE.md later
```

### `protocols/`

Runtime guardrails used inside modes.

```text
CONTROL_EXISTENCE_FAILURE.md
CLASS_APPLICATION_SAFETY.md
PER_ELEMENT_INSTRUCTION.md
STEP_SIZE_CONTRACT.md
V3_V4_SEPARATION_GUARD.md
LAYOUT_COMPLETENESS_CHECKLIST.md
COMPLETION_GATE.md
```

### `input-contracts/`

Pre-runtime gates.

```text
BUILDER_CONTEXT_INPUT_CONTRACT.md
```

### `commands/`

Persian session command behavior.

```text
SESSION_COMMANDS.md
```

### `schemas/`

Machine-checkable state and checkpoint structures.

```text
session-state.schema.json
checkpoint.schema.json
```

---

## How We Built v0.1.0

The first runtime foundation was created in this order:

```text
1. PROJECT_INSTRUCTIONS.md
2. core/MASTER_PROMPT.md
3. input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md
4. core/SESSION_STATE_MACHINE.md
5. core/LIVE_INTERFACE_PRECEDENCE.md
6. modes/APPROVED_HANDOFF_MODE.md
7. modes/CORRECTION_MODE.md
8. protocols/CONTROL_EXISTENCE_FAILURE.md
9. commands/SESSION_COMMANDS.md
10. protocols/PER_ELEMENT_INSTRUCTION.md
11. protocols/CLASS_APPLICATION_SAFETY.md
12. protocols/COMPLETION_GATE.md
13. protocols/STEP_SIZE_CONTRACT.md
14. protocols/V3_V4_SEPARATION_GUARD.md
15. protocols/LAYOUT_COMPLETENESS_CHECKLIST.md
16. schemas/session-state.schema.json
17. schemas/checkpoint.schema.json
18. STATUS.md
19. CHANGELOG.md
20. docs/REPOSITORY_GUIDE.md
```

---

## Design Principles Used

The repository follows these principles:

```text
Prompt = Task + Context + Constraints + Format + Validation
```

```text
Reliable Output = Prompt + Data + Tools + Validation + Human Review
```

Runtime behavior is designed with:

```text
- explicit role boundary;
- data-vs-instruction separation;
- forbidden work list;
- stop conditions;
- checkpointing;
- correction mode;
- small reversible steps;
- evidence labels;
- completion gate instead of over-claiming.
```

---

## How To Use In A ChatGPT Project

Upload or paste in this order:

```text
1. PROJECT_INSTRUCTIONS.md
2. core/MASTER_PROMPT.md
3. input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md
4. core/SESSION_STATE_MACHINE.md
5. core/LIVE_INTERFACE_PRECEDENCE.md
6. modes/APPROVED_HANDOFF_MODE.md
7. modes/CORRECTION_MODE.md
8. protocols/CONTROL_EXISTENCE_FAILURE.md
9. commands/SESSION_COMMANDS.md
10. protocols/PER_ELEMENT_INSTRUCTION.md
11. protocols/CLASS_APPLICATION_SAFETY.md
12. protocols/COMPLETION_GATE.md
```

Then start a session with:

```text
Builder_Context_Package
+ original section screenshot
+ request to begin interactive Elementor build
```

---

## What Not To Do Later

Do not turn this repo into another EV4 Architect pipeline.

Do not add scoring, recommendation, or architecture candidate selection here.

Do not let `FRESH_IMAGE_MODE` become the default path when `Builder_Context_Package` exists.

Do not remove correction mode or live interface precedence.

Do not claim production readiness from Builder Assistant completion alone.

---

## Next Development Milestone

Recommended next milestone:

```text
v0.2.0 — Example and Validation Seed
```

Required work:

```text
- add schemas/builder-context-package.schema.json;
- add examples/_template/;
- add examples/smart-home-connector/;
- add tests/valid/builder_context_package.json;
- add tests/invalid/missing_selected_candidate.json;
- update README and STATUS;
- run a real Builder_Context_Package through the assistant prompt manually.
```

---

## Final Guide Reminder

Before considering this repo stable, create a full final guide that includes:

```text
- purpose and boundaries;
- file map;
- how to create a ChatGPT Project from these files;
- how to start a builder session;
- example first turn;
- session commands;
- correction workflow;
- checkpoint examples;
- completion report example;
- what to hand off to EV4 Responsive Architect.
```
