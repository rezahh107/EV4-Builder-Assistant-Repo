# REPOSITORY_GUIDE — EV4 Builder Assistant

Version: 0.2.0
Status: example_and_validation_seed_added
Date: 2026-06-27

---

## Purpose

This guide explains what this repository is, why it exists, how the files relate to each other, and how to continue development later without losing the original design intent.

This is a living guide. It must be expanded again after CI results and real builder-session validation are available.

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

Compact always-on instruction layer for the ChatGPT Project.

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
FRESH_IMAGE_MODE.md
```

`FRESH_IMAGE_MODE.md` is fallback-only and must not replace `APPROVED_HANDOFF_MODE` when `Builder_Context_Package` exists.

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

Machine-checkable package, state, and checkpoint structures.

```text
builder-context-package.schema.json
session-state.schema.json
checkpoint.schema.json
```

### `examples/`

Reusable example material.

```text
examples/_template/
examples/smart-home-connector/
```

### `tests/`

Schema validation fixtures.

```text
tests/valid/builder_context_package.json
tests/invalid/missing_selected_candidate.json
```

### `.github/workflows/`

Automation for schema validation.

```text
schema-validation.yml
```

---

## How We Built The Repo

### v0.1.0

Created the initial runtime foundation:

```text
PROJECT_INSTRUCTIONS.md
core/MASTER_PROMPT.md
input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md
core/SESSION_STATE_MACHINE.md
core/LIVE_INTERFACE_PRECEDENCE.md
modes/APPROVED_HANDOFF_MODE.md
modes/CORRECTION_MODE.md
protocols/*
schemas/session-state.schema.json
schemas/checkpoint.schema.json
```

### v0.1.1

Fixed review issues:

```text
builder-context-package.schema.json
bounded max_actions_per_turn
session action-count commands
canonical Data vs Instruction Rule
Unverified element type behavior
unified correction_response
```

### v0.1.2

Fixed schema and mode gaps:

```text
element_generation in approved_structure_tree
element_generation in first_builder_batch.actions
widget_mapping_table minItems: 1
reset scope enum
FRESH_IMAGE_MODE.md fallback-only
```

### v0.2.0

Added examples and validation seed:

```text
examples/_template/
examples/smart-home-connector/
tests/valid/builder_context_package.json
tests/invalid/missing_selected_candidate.json
.github/workflows/schema-validation.yml
```

---

## Schema Validation

The workflow validates:

```text
1. valid Builder_Context_Package fixture passes.
2. invalid missing_selected_candidate fixture fails.
3. session-state.schema.json compiles with checkpoint.schema.json.
```

Workflow file:

```text
.github/workflows/schema-validation.yml
```

The workflow uses `ajv-cli` with Draft 2020 support.

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
13. modes/FRESH_IMAGE_MODE.md only if fallback behavior is needed
```

Then start a session with:

```text
Builder_Context_Package
+ original section screenshot
+ request to begin interactive Elementor build
```

For Smart Home Connector, use:

```text
examples/smart-home-connector/start_session_prompt.md
examples/smart-home-connector/builder_context_package.json
```

---

## Runtime Decisions To Preserve

```text
- max_actions_per_turn stays bounded to 1..6;
- Data vs Instruction Rule canonical source is MASTER_PROMPT §3;
- control-existence failure uses correction_response, not a separate top-level shape;
- Unverified element type stops generation-sensitive edits;
- element_generation must be carried by the package where possible;
- FRESH_IMAGE_MODE must remain fallback-only;
- Builder Assistant must not become Architect;
- valid/invalid fixtures must stay aligned with schema changes.
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
v0.2.1 — CI Repair If Needed
```

Required work:

```text
- watch GitHub Actions result;
- fix schema/workflow/fixtures if CI fails;
- run a manual Smart Home Builder Assistant session;
- record observed issues in examples/smart-home-connector/notes.md;
- expand this guide after real execution evidence.
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
- what to hand off to EV4 Responsive Architect;
- CI validation workflow behavior;
- real builder-session lessons.
```
