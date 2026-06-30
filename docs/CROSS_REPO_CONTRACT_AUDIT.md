# Cross-Repo Contract Audit — CE to Builder

Version: 0.1.0  
Status: active  
Scope: `EV4-Constructability-Engineer-Repo` output compatibility with `EV4-Builder-Assistant-Repo` intake

---

## Purpose

This audit checks whether the Constructability Engineer `builder_executable_package` can be consumed directly by Builder Assistant intake without silent semantic loss.

Boundary rule:

```text
CE may prove that a package is executable, but Builder must still fail closed unless the received input satisfies Builder's own intake contract.
```

---

## Sources Audited

```yaml
constructability_engineer_repo:
  repo: rezahh107/EV4-Constructability-Engineer-Repo
  ref: main
  source_files:
    - schemas/builder_executable_package.schema.json
    - docs/PROTOCOL.md
    - docs/BEHAVIORAL_RULE_COVERAGE.md

builder_assistant_repo:
  repo: rezahh107/EV4-Builder-Assistant-Repo
  ref: main
  source_files:
    - input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md
    - schemas/builder-context-package.schema.json
    - scripts/validate-package.mjs
    - scripts/validate-reference-paradigm-gate.mjs
```

---

## Finding 1 — CE package is not a drop-in Builder_Context_Package

CE emits a `builder_executable_package` with fields such as:

```yaml
builder_package_status: executable_ready
builder_decisions_required: 0
blocking_dependencies: []
selected_candidate_locked: true
selected_candidate_id_unchanged: true
approved_class_names_unchanged: true
confirmation_request: present
first_safe_builder_batch: present
```

Builder intake requires a `Builder_Context_Package` shape with fields such as:

```yaml
schema: ev4-builder-context-package@1.0.0
source_stage: /builder-feed-export
source_handoff_stage: /handoff-export
package_status: ready | ready_with_visible_flags
production_ready_allowed: false
approved_structure_tree: present
class_creation_application_map: present
forbidden_work: present
first_builder_batch: present
confirmation_request.template_id: standard_batch_confirmation
```

Verdict:

```text
A raw CE builder_executable_package must not be treated as an already-authorized Builder_Context_Package.
```

---

## Finding 2 — Reference carrier shape currently differs across repos

CE `paradigm_to_structure_map` is structurally rich:

```yaml
primary_anchor:
  node: string
  role: string
regions:
  - id: string
    distribution: string
    expected_count: integer
    nodes: [string]
repeated_units:
  form: string
  required_children: [string]
connector_layer:
  node: string
  model: string
first_batch_requirements:
  - string
```

Builder's current `paradigm_to_structure_map` contract is flatter:

```yaml
primary_anchor: string
regions: [string]
repeated_units: [string]
connector_layer: string
first_batch_requirements:
  must_establish_primary_anchor: boolean
  must_create_or_stage_left_right_regions: boolean
  must_use_repeated_unit_form: string
  forbidden_composition_starts: [string]
  connector_strategy: string
```

Verdict:

```text
CE-style structured reference carriers need either a normalization adapter or a Builder schema/validator expansion before they can be accepted as Builder intake data.
```

---

## Finding 3 — Confirmation contract differs at the Builder boundary

CE confirmation_request requires:

```yaml
confirmation_id
confirmed_action_ids
expected_user_token
```

Builder confirmation_request additionally requires:

```yaml
template_id: standard_batch_confirmation
```

Verdict:

```text
Builder runtime confirmation text generation remains anchored to Builder's trusted template boundary. CE output must not replace that boundary with template-less confirmation data.
```

---

## Current Safety Posture

```yaml
raw_ce_builder_executable_package_drop_in_compatible: false
builder_accepts_normalized_builder_context_package: true
builder_fails_closed_on_missing_reference_carriers: true
builder_fails_closed_on_current_ce_structured_map_without_normalization: true
regression_fixture_added: tests/invalid-cross-field/ce_structured_reference_map_requires_normalization.json
```

---

## Required Downstream Rule

Builder may enter `APPROVED_HANDOFF_MODE` only when one of these is true:

```text
1. The input is already a valid Builder_Context_Package and passes Builder schema plus cross-field validation.
2. A separate, explicit, CI-tested adapter converts CE builder_executable_package into Builder_Context_Package before runtime intake.
```

Builder must not infer this conversion during the interactive runtime flow.

---

## Recommended Next Patch

```text
Add a CE-to-Builder normalization adapter contract or expand Builder reference carrier schema/validator to accept the CE structured map shape explicitly.
```

Acceptance criteria for that next patch:

```text
- valid CE-style reference carrier fixture passes after explicit normalization or schema support;
- invalid missing/mismatched carrier fixtures fail;
- confirmation_request.template_id remains required at Builder runtime boundary;
- selected_candidate_id and approved class names remain locked;
- production_ready_allowed remains false;
- npm run validate passes in CI.
```
