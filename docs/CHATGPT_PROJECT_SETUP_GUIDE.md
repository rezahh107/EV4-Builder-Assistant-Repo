# CHATGPT_PROJECT_SETUP_GUIDE — EV4 Builder Assistant

Version: 0.3.0
Status: mode_state_intake_foundation_added
Date: 2026-06-27

---

## Purpose

This guide explains how to create a ChatGPT Project for `EV4 Builder Assistant` and start a controlled interactive Elementor build session from a `Builder_Context_Package`.

---

## Project Role

The project must behave as:

```text
EV4 Builder Assistant = interactive Elementor execution companion
```

It is not the EV4 Architect pipeline.

It must not rerun architecture, score candidates, recommend a new winner, redesign approved structure, change `selected_candidate_id`, add/remove approved classes, assume clickability, assume Dynamic Loop, assume mobile connector behavior, or claim production readiness.

---

## v0.3.0 Runtime Foundation

Use separate values:

```yaml
workflow_mode:
  - START_INTAKE_MODE
  - APPROVED_HANDOFF_MODE
  - FRESH_IMAGE_MODE_LIMITED

runtime_state:
  - INTAKE_WAITING
  - INTAKE_VALIDATING
  - BUILD_ACTIVE
  - WAITING_FOR_CONFIRMATION
  - EVIDENCE_REQUIRED
  - CORRECTION
  - REVIEW_ONLY
  - PAUSED
  - COMPLETED
```

Legacy aliases:

```yaml
CORRECTION_MODE: CORRECTION
REVIEW_MODE: REVIEW_ONLY
```

Use `STATE_CAPSULE` only as a compact one-line public state marker when session state matters.

---

## Recommended ChatGPT Project Instructions

Use `PROJECT_INSTRUCTIONS.md` as the Project Instructions source.

If there is conflict between older legacy mode wording and v0.3.0 runtime files, prefer:

```text
core/MODE_STATE_MATRIX.md
core/SESSION_STATE_MACHINE.md
commands/SESSION_COMMANDS.md
docs/START_INTAKE_POLICY.md
```

---

## Recommended Project Files To Upload

Upload in this order:

```text
1. PROJECT_INSTRUCTIONS.md
2. core/MODE_STATE_MATRIX.md
3. core/MASTER_PROMPT.md
4. core/SESSION_STATE_MACHINE.md
5. input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md
6. docs/START_INTAKE_POLICY.md
7. protocols/NEW_CHAT_START_INTAKE.md
8. core/LIVE_INTERFACE_PRECEDENCE.md
9. protocols/OFFICIAL_ELEMENTOR_DOCS_PRIORITY.md
10. protocols/WORKBOOK_REFERENCE_BOUNDARY.md
11. modes/APPROVED_HANDOFF_MODE.md
12. modes/CORRECTION_MODE.md
13. protocols/CONTROL_EXISTENCE_FAILURE.md
14. commands/SESSION_COMMANDS.md
15. protocols/PER_ELEMENT_INSTRUCTION.md
16. protocols/CLASS_APPLICATION_SAFETY.md
17. protocols/COMPLETION_GATE.md
18. protocols/STEP_SIZE_CONTRACT.md
19. protocols/RISK_ADJUSTED_STEP_SIZE.md
20. protocols/V3_V4_SEPARATION_GUARD.md
21. protocols/LAYOUT_COMPLETENESS_CHECKLIST.md
22. protocols/STYLE_SYSTEM_CAPABILITY_GATE.md
23. protocols/CONTROLLED_OVERLAY_STAGE_PATTERN.md
24. protocols/REPEATED_ELEMENT_DUPLICATION_PROTOCOL.md
25. protocols/RESPONSIVE_WORKFLOW_GUARD.md
26. protocols/READING_ORDER_CHECKLIST.md
27. schemas/builder-context-package.schema.json
28. schemas/session-state.schema.json
29. schemas/checkpoint.schema.json
30. schemas/intake-result.schema.json
```

Optional fallback-only file:

```text
modes/FRESH_IMAGE_MODE.md
```

Reference files:

```text
references/tuya-workbook/README.md
references/tuya-workbook/WORKBOOK_USAGE_POLICY.md
references/tuya-workbook/WORKBOOK_LESSON_INDEX.md
references/tuya-workbook/EXTRACTED_BUILDER_RULES.md
cases/tuya-step-by-step/CASE_LESSONS.md
cases/tuya-step-by-step/CASE_PATCH_MAP.md
```

Example files for Smart Home test:

```text
examples/smart-home-connector/builder_context_package.json
examples/smart-home-connector/start_session_prompt.md
examples/smart-home-connector/expected_first_response.md
examples/smart-home-connector/notes.md
```

---

## First Session Start Prompt

Use the example prompt:

```text
examples/smart-home-connector/start_session_prompt.md
```

Attach or paste:

```text
Builder_Context_Package
reference screenshot if available
checkpoint/status summary only if continuing previous work
current Elementor Structure Panel or editor screenshot if available
```

The original section screenshot is only `visual_reference_only` unless it is a current Elementor editor/frontend screenshot used as execution evidence.

---

## Start Intake Behavior

When the user says `شروع`, the assistant should:

```text
1. enter START_INTAKE_MODE / INTAKE_WAITING;
2. inspect attachments and pasted JSON before asking again;
3. avoid re-requesting valid data already provided;
4. ask only for blocking missing inputs;
5. output a short intake_checklist when inputs are partial;
6. validate Builder_Context_Package when present;
7. produce intake_result when intake is evaluated;
8. enter APPROVED_HANDOFF_MODE / BUILD_ACTIVE only after the package passes the input contract.
```

---

## Expected First Response Behavior After Valid Package

The first assistant response should:

```text
- activate APPROVED_HANDOFF_MODE / BUILD_ACTIVE;
- include STATE_CAPSULE when session state matters;
- confirm selected_candidate_id;
- preserve package flags and unknowns;
- produce only the first small action batch;
- use risk-adjusted step size;
- not rerun architecture/scoring/recommendation;
- end with the exact confirmation sentence from the package.
```

For Smart Home seed, see:

```text
examples/smart-home-connector/expected_first_response.md
```

---

## Evidence Rules

The assistant may treat these as execution evidence:

```text
user exact confirmation sentence
Elementor editor screenshot
Structure Panel screenshot
frontend screenshot
DOM/computed CSS diagnostic
export JSON / EDIS
official Elementor documentation for standard capability
```

The assistant must not treat silence, workbook examples, or unrelated replies as confirmation.

---

## Manual Session Recording

After each real/manual run, record findings in:

```text
examples/smart-home-connector/notes.md
```

Recommended fields:

```yaml
manual_session:
  session_id:
  date:
  package_file:
  workflow_mode:
  runtime_state:
  state_capsule:
  first_response_matches_expected: yes/no/partial
  first_batch_executed_in_real_elementor: yes/no
  checkpoint_created: yes/no
  official_docs_checked_when_needed: yes/no/not_needed
  missing_controls:
  drift_found:
  corrections_needed:
  next_action:
```

---

## Completion Rule

Do not mark the repository or example production-ready after Project setup alone.

Project setup validates the prompt environment only.

Production readiness would require:

```text
live Elementor build evidence
frontend screenshots
responsive screenshots
accessibility checks
export JSON / EDIS validation
browser rendering checks
pixel comparison if needed
```
