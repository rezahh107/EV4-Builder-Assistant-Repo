# CHATGPT_PROJECT_SETUP_GUIDE — EV4 Builder Assistant

Version: 0.2.3
Status: active
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

It must not rerun architecture, score candidates, recommend a new winner, redesign approved structure, change `selected_candidate_id`, add/remove approved classes, or claim production readiness.

---

## Official Docs Priority

Official Elementor documentation is the primary external source for Elementor capability and standard workflow claims.

Upload and use:

```text
protocols/OFFICIAL_ELEMENTOR_DOCS_PRIORITY.md
core/LIVE_INTERFACE_PRECEDENCE.md
```

Workbook and case memory are reference layers only.

---

## Recommended ChatGPT Project Instructions

Use `PROJECT_INSTRUCTIONS.md` as the Project Instructions source.

If the Project Instructions character limit is tight, use only `PROJECT_INSTRUCTIONS.md` in the settings and upload the other files as project knowledge.

---

## Recommended Project Files To Upload

Upload in this order:

```text
1. PROJECT_INSTRUCTIONS.md
2. core/MASTER_PROMPT.md
3. input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md
4. core/SESSION_STATE_MACHINE.md
5. core/LIVE_INTERFACE_PRECEDENCE.md
6. protocols/OFFICIAL_ELEMENTOR_DOCS_PRIORITY.md
7. protocols/WORKBOOK_REFERENCE_BOUNDARY.md
8. modes/APPROVED_HANDOFF_MODE.md
9. modes/CORRECTION_MODE.md
10. protocols/CONTROL_EXISTENCE_FAILURE.md
11. commands/SESSION_COMMANDS.md
12. protocols/PER_ELEMENT_INSTRUCTION.md
13. protocols/CLASS_APPLICATION_SAFETY.md
14. protocols/COMPLETION_GATE.md
15. protocols/STEP_SIZE_CONTRACT.md
16. protocols/RISK_ADJUSTED_STEP_SIZE.md
17. protocols/V3_V4_SEPARATION_GUARD.md
18. protocols/LAYOUT_COMPLETENESS_CHECKLIST.md
19. protocols/STYLE_SYSTEM_CAPABILITY_GATE.md
20. protocols/CONTROLLED_OVERLAY_STAGE_PATTERN.md
21. protocols/REPEATED_ELEMENT_DUPLICATION_PROTOCOL.md
22. protocols/RESPONSIVE_WORKFLOW_GUARD.md
23. protocols/READING_ORDER_CHECKLIST.md
24. schemas/builder-context-package.schema.json
25. schemas/session-state.schema.json
26. schemas/checkpoint.schema.json
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
original/reference section screenshot if available
```

The original section screenshot is only `visual_reference_only` unless it is a current Elementor editor/frontend screenshot used as execution evidence.

---

## Expected First Response Behavior

The first assistant response should:

```text
- activate APPROVED_HANDOFF_MODE;
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
