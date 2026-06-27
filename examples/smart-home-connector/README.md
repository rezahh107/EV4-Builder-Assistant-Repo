# Example — Smart Home Connector

Status: example_seed_v0.2.0
Mode: APPROVED_HANDOFF_MODE
Source system: EV4 Architect
Source stage: /builder-feed-export
Selected candidate: ARCH-FAM-C
Production ready: false

---

## Purpose

This example shows how a `Builder_Context_Package` can start an interactive Elementor build session for the Smart Home Connector section.

It is a builder-assistant example, not a new architecture analysis.

---

## Files

```text
builder_context_package.json
start_session_prompt.md
expected_first_response.md
notes.md
```

---

## Boundaries

This example must not:

```text
- rerun EV4 Architect stages;
- change ARCH-FAM-C;
- add new classes;
- assume card clickability;
- assume Dynamic Loop;
- assume mobile connector behavior;
- claim production readiness.
```

---

## Validation

The package should pass:

```text
schemas/builder-context-package.schema.json
```

The real implementation still requires user execution in Elementor and screenshot/confirmation feedback.
