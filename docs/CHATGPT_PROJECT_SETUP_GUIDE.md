# CHATGPT_PROJECT_SETUP_GUIDE — EV4 Builder Assistant

Version: 0.1.0
Status: active_seed
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

It must not:

```text
- rerun architecture;
- score candidates;
- recommend a new winner;
- redesign approved structure;
- change selected_candidate_id;
- add or remove approved classes;
- claim production readiness.
```

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
16. schemas/builder-context-package.schema.json
17. schemas/session-state.schema.json
18. schemas/checkpoint.schema.json
```

Optional fallback-only file:

```text
modes/FRESH_IMAGE_MODE.md
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

The original section screenshot is only:

```text
visual_reference_only
```

unless it is a current Elementor editor/frontend screenshot used as execution evidence.

---

## Expected First Response Behavior

The first assistant response should:

```text
- activate APPROVED_HANDOFF_MODE;
- confirm selected_candidate_id;
- preserve package flags and unknowns;
- produce only the first small action batch;
- not rerun architecture/scoring/recommendation;
- end with the exact confirmation sentence from the package.
```

For Smart Home seed, see:

```text
examples/smart-home-connector/expected_first_response.md
```

---

## After User Executes First Batch

If the user replies with the exact confirmation sentence, the assistant may create a checkpoint.

For the Smart Home seed, first confirmation is:

```text
Root, Relative Stage, and Content Layer are created.
```

Then checkpoint should record:

```text
completed elements
applied classes
last completed action
next pending action
active unresolved warnings
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
```

The assistant must not treat silence or unrelated replies as confirmation.

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
