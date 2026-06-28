# CHATGPT_PROJECT_SETUP_GUIDE — EV4 Builder Assistant

Version: 0.3.2
Status: deployable_project_pack_added
Date: 2026-06-28

---

## Purpose

This guide explains how to create a ChatGPT Project for `EV4 Builder Assistant` using the compact deployable source pack in:

```text
dist/chatgpt-project/
```

The modular repository remains the source of truth for development. The `dist/chatgpt-project` folder is the compact deployment artifact for ChatGPT Project setup.

---

## Recommended Upload Method

Use the generated pack:

```text
dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt
dist/chatgpt-project/knowledge/
dist/chatgpt-project/SOURCE_PACK_MANIFEST.json
dist/chatgpt-project/BUILD_REPORT.json
```

### Project Instructions

Paste this file into the ChatGPT Project Instructions field:

```text
dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt
```

Do not also upload this file into Knowledge unless a future pack manifest explicitly allows duplication.

### Knowledge files

Upload the files inside:

```text
dist/chatgpt-project/knowledge/
```

Current pack target:

```yaml
knowledge_file_count: 10
knowledge_file_limit: 25
```

---

## Pack Verification

Before uploading, verify the pack:

```bash
npm run build:project-pack
```

The verification checks:

```text
- Project Instructions character count is below the configured limit.
- Knowledge file count is <= 25.
- Every SOURCE_PACK_MANIFEST.json path exists.
- Manifest SHA-256 hashes match file contents.
- PROJECT_INSTRUCTIONS.txt is not duplicated inside Knowledge.
- BUILD_REPORT.json counts match the actual pack.
```

---

## Project Role

The project must behave as:

```text
EV4 Builder Assistant = interactive Elementor execution companion
```

It is not the EV4 Architect pipeline.

It must not rerun architecture, score candidates, recommend a new winner, redesign approved structure, change `selected_candidate_id`, add/remove approved classes, assume clickability, assume Dynamic Loop, assume mobile connector behavior, or claim production readiness.

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
- end with structured confirmation_request.expected_user_token when available.
```

For Smart Home seed, see:

```text
examples/smart-home-connector/expected_first_response.md
```

---

## Evidence Rules

The assistant may treat these as execution evidence:

```text
structured user confirmation token
Elementor editor screenshot
Structure Panel screenshot
frontend screenshot
DOM/computed CSS diagnostic
export JSON / EDIS
official Elementor documentation for standard capability
```

The assistant must not treat silence, workbook examples, legacy package prose, or unrelated replies as confirmation.
