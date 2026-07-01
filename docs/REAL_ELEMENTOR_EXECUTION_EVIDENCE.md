# Real Elementor Execution Evidence Protocol

This protocol records the final real-ui execution step for the Smart Home Connector build.

It does **not** authorize production readiness by itself. It defines the evidence that must be collected from an actual Elementor session before any production-ready claim can be considered.

---

## Purpose

The repository already validates Builder packages, Reference Paradigm Gate data, Batch 3 structured first-batch intent, CE adapters, and completion boundaries.

The remaining non-batch work is real Elementor execution evidence:

- real Builder Assistant session reference;
- real Elementor environment notes;
- desktop/tablet/mobile observations when available;
- screenshots, recordings, UI observations, export artifacts, or browser notes;
- verification summary for layout, visual parity, responsive behavior, content visibility, connector behavior, accessibility, and export/front-end checks.

---

## Evidence file

Use this template:

```text
examples/smart-home-connector/real_elementor_execution_evidence.template.json
```

Before claiming production readiness, copy the template to a dated evidence file and replace all placeholder values with real observations.

---

## Validation

The evidence file must satisfy:

```text
schemas/real-elementor-execution-evidence.schema.json
scripts/validate-real-elementor-execution-evidence.mjs
```

Central CI runs the validator through:

```text
scripts/validate.mjs
```

---

## Production readiness boundary

`production_ready_claim=true` is blocked unless:

- `execution_status=completed`;
- every verification summary proof is `confirmed`;
- each confirmed proof has at least one evidence ref;
- each referenced evidence item exists and is also `confirmed`;
- `required_next_action=claim_production_ready`.

If execution exposes a layout, connector, responsive, accessibility, export, or visual-parity problem, create a repair packet instead of claiming production readiness.

---

## Preserved boundaries

```text
No architecture rerun.
No scoring rerun.
No recommendation rerun.
No Constructability Engineer rerun.
No selected_candidate_id mutation.
No approved class-name mutation.
No production-readiness claim without real evidence.
```
