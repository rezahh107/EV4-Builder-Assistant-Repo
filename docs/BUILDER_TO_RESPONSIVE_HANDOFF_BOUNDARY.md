# Builder → Responsive Handoff Boundary

Status: documented boundary only  
Version: 0.1.0  
Runtime behavior changed: no  
Formal Responsive handoff export implemented: no

## Purpose

This document identifies what Builder can currently provide for a future Project Gate Builder → Responsive route without inventing Responsive input, responsive correctness, or production readiness.

```text
Builder execution output and build evidence
→ future Project Gate verification
→ Responsive input package
```

## Current Builder artifacts

Builder currently has several local-authoritative artifacts that may be pinned by a future Project Gate transition.

```yaml
builder_runtime_input:
  schema: ev4-builder-context-package@1.0.0
  schema_file: schemas/builder-context-package.schema.json
  validator: scripts/validate-package.mjs
  fixture_examples:
    - examples/smart-home-connector/builder_context_package.json
    - tests/valid/builder_context_package*.json

builder_action_batch:
  schema: ev4-action-batch@1.0.0
  schema_file: schemas/action-batch.schema.json
  validator: scripts/validate-action-batch.mjs
  validation_command: npm run validate:action-batch

layout_check:
  schema: ev4-layout-check@0.1.0
  schema_file: schemas/layout-check.schema.json
  validator: scripts/validate-layout-check.mjs
  validation_command: npm run validate:layout-check

completion_gate:
  schema: ev4-completion-gate@0.1.0
  schema_file: schemas/completion-gate.schema.json
  validator: scripts/validate-completion-gate.mjs
  validation_command: npm run validate:completion-gate

real_elementor_execution_evidence:
  schema: ev4-real-elementor-execution-evidence@1.0.0
  schema_file: schemas/real-elementor-execution-evidence.schema.json
  validator: scripts/validate-real-elementor-execution-evidence.mjs
  positive_fixture:
    - examples/smart-home-connector/real_elementor_execution_evidence.template.json
  negative_fixtures:
    - tests/invalid/real_elementor_execution_evidence_claim_without_proof.json
    - tests/invalid/real_elementor_execution_evidence_duplicate_ref.json
    - tests/invalid/real_elementor_execution_evidence_conflicting_next_action.json
    - tests/invalid/real_elementor_execution_evidence_repair_next_action_conflict.json
```

## Not implemented yet

Builder does not currently define a single formal export package named `ev4-builder-to-responsive-handoff`.

```yaml
builder_to_responsive_handoff_export:
  status: not_implemented
  schema_file: null
  validator: null
  fixture_suite: null
```

A future Project Gate transition must therefore either:

1. remain fail-closed until a formal Builder export exists; or
2. package pinned Builder artifacts as Project Gate transport metadata without treating that package as a Builder-owned schema.

## Trust boundary

Builder may provide execution-state evidence. Builder must not provide Responsive conclusions.

```yaml
builder_may_emit_or_retain:
  - confirmed action batch records
  - layout check records
  - completion gate records
  - real Elementor execution evidence records
  - screenshots, observations, export artifacts, and notes only as evidence items

builder_must_not_claim:
  - responsive_correctness
  - frontend_correctness
  - accessibility_completion
  - export_validation_completion
  - production_readiness
  - Responsive repair eligibility
```

## Responsive handoff candidate rule

A future Builder → Responsive package candidate is eligible only when evidence exists and production readiness remains false unless all completion-gate proofs support otherwise.

```yaml
responsive_handoff_candidate:
  requires_real_elementor_execution_evidence: true
  requires_completion_gate_reference: true
  requires_layout_check_reference: true
  production_ready_claim_allowed_by_this_boundary: false
  responsive_correctness_claim_allowed_by_this_boundary: false
```

## Validation entrypoint

Current central validation includes the relevant Builder validators through:

```bash
npm run validate
```

Focused checks:

```bash
npm run validate:action-batch
npm run validate:layout-check
npm run validate:completion-gate
node scripts/validate-real-elementor-execution-evidence.mjs
```

## Project Gate note

Project Gate may later pin and hash these Builder-owned files. Project Gate must not copy these schemas into itself as canonical Builder contracts, generate Builder runtime output, or invent missing real Elementor evidence.
