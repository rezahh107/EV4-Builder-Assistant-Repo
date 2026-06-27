# Example Template — EV4 Builder Assistant

Status: template_v0.2.0_seed
Purpose: provide a repeatable structure for new Builder Assistant examples

---

## Purpose

Use this folder as the starting point for every new Builder Assistant example.

Each example should show how a `Builder_Context_Package` from EV4 Architect becomes an interactive Elementor build session.

---

## Required Files Per Example

```text
README.md
builder_context_package.json
start_session_prompt.md
expected_first_response.md
notes.md
```

---

## Required Evidence

Each example should declare:

```yaml
example_metadata:
  example_id:
  source_system: EV4 Architect
  source_stage: /builder-feed-export
  builder_mode: APPROVED_HANDOFF_MODE
  selected_candidate_id:
  reference_screenshot_available: true/false
  production_ready_claim_allowed: false
```

---

## Example Rules

Do not use examples to introduce new architecture decisions.

Do not use examples to bypass `Builder_Context_Package` validation.

Do not mark unchecked responsive, accessibility, export, or browser QA items as confirmed.

Keep class names, payload names, schema names, and technical identifiers in English.

---

## Template Flow

```text
1. Put a valid Builder_Context_Package in builder_context_package.json.
2. Put the copy-ready user prompt in start_session_prompt.md.
3. Put the expected first assistant response in expected_first_response.md.
4. Record assumptions and unresolved items in notes.md.
5. Add or update a valid fixture under tests/valid/ when useful.
```

---

## Validation

The package should pass:

```text
schemas/builder-context-package.schema.json
```

Use the repository GitHub Actions workflow after test fixtures are available.
