# CE Builder Package Adapter Contract

Version: 0.1.0  
Status: active  
Scope: explicit conversion from Constructability Engineer `builder_executable_package` into Builder `Builder_Context_Package`

---

## Purpose

This contract defines the package-level adapter boundary between:

```text
EV4-Constructability-Engineer-Repo
EV4-Builder-Assistant-Repo
```

The adapter converts a CE `builder_executable_package` into a Builder `Builder_Context_Package` only when the CE package is already executable and carries all Builder-required payload data.

```text
CE builder_executable_package -> Builder_Context_Package
```

The adapter is implemented in:

```text
scripts/normalize-ce-builder-executable-package.mjs
```

The CI validator is:

```text
scripts/validate-ce-builder-package-adapter.mjs
```

Central validation entrypoint:

```text
scripts/validate.mjs
```

---

## Fail-Closed Rule

The adapter must fail before Builder intake when any of these are true:

```text
builder_package_status != executable_ready
builder_decisions_required != 0
blocking_dependencies is not empty
selected_candidate_locked != true
selected_candidate_id_unchanged != true
approved_class_names_unchanged != true
architect_contract selected_candidate_id does not match package selected_candidate_id
architect_contract approved_class_names does not exactly match package approved_class_names
required Builder carrier data is missing
confirmation_request does not match the normalized Builder action batch
first_safe_builder_batch requires any unresolved decision
```

The adapter must not invent missing Builder carriers.

---

## Required CE Input Carriers

A CE package can be normalized only when it includes Builder-required carriers:

```text
approved_structure_tree
class_creation_application_map
widget_mapping_table
editable_content_map
decoration_only_map
asset_replacement_map
scoped_css_need_map
responsive_qa_seed
forbidden_work
first_safe_builder_batch
confirmation_request
```

For visual parity packages, the adapter also requires:

```text
reference_paradigm_lock
paradigm_to_structure_map
```

The existing CE reference map adapter then produces:

```text
paradigm_to_structure_map
first_batch_structure_intent
```

---

## Builder Output

The normalized package has Builder intake identity fields:

```yaml
schema: ev4-builder-context-package@1.0.0
source_stage: /builder-feed-export
source_handoff_stage: /handoff-export
package_status: ready
selected_candidate_locked: true
production_ready_allowed: false
```

The adapter also adds a trusted Builder confirmation template boundary:

```yaml
confirmation_request:
  template_id: standard_batch_confirmation
```

and computes:

```yaml
input_authorization:
  decision: approved
  eligible_workflow_mode: APPROVED_HANDOFF_MODE
  eligible_runtime_state: BUILD_ACTIVE
  package_digest:
    algorithm: sha256
    scope: canonical_package_without_digest
```

---

## Non-Goals

```text
- No architecture rerun.
- No scoring rerun.
- No candidate selection change.
- No selected_candidate_id mutation.
- No approved class-name mutation.
- No production-ready claim.
- No runtime conversation inference path.
```

---

## Validation Contract

The validator proves:

```text
1. A valid CE builder_executable_package normalizes into a Builder_Context_Package.
2. The normalized package passes Builder JSON schema validation.
3. The normalized package passes Builder cross-field validation.
4. Invalid CE packages fail before they can become Builder_Context_Package data.
```

Fixtures:

```text
tests/valid/ce_builder_package_adapter_valid.json
tests/invalid/ce_builder_package_adapter_not_executable_ready.json
tests/invalid/ce_builder_package_adapter_missing_carriers.json
```

---

## Boundary Note

This adapter creates an explicit CI-tested bridge. Builder runtime must still consume only the normalized `Builder_Context_Package`; it must not infer conversion from a raw CE package during an interactive session.
