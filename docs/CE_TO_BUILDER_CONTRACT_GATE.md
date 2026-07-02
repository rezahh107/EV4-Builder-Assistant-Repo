# CE→Builder Contract Gate

Version: 1.0.0  
Status: active  
Gate ID: `ce_to_builder_contract_gate`

---

## Purpose

This gate validates Constructability Engineer output before it can be normalized into Builder runtime intake.

It is a strict validation, classification, and blocking layer. It does not repair, normalize, coerce, rewrite, default, delete, or reinterpret CE output.

---

## Contract Boundary

```text
CE builder_executable_package
→ ce_to_builder_contract_gate
→ scripts/normalize-ce-builder-executable-package.mjs
→ Builder_Context_Package
→ Builder schema and cross-field validation
→ Builder execution
```

Boundary artifacts:

```yaml
ce_output_artifact: ce_builder_executable_package
ce_contract_version: ev4-builder-executable-package@1.0.0
builder_adapter: scripts/normalize-ce-builder-executable-package.mjs
builder_intake_schema: schemas/builder-context-package.schema.json
builder_cross_field_validator: scripts/validate-package.mjs
gate_validator: scripts/validate-ce-to-builder-contract-gate.mjs
```

The gate runs before `normalizeCeBuilderExecutablePackage` performs any Builder-side projection. A failed gate blocks normalization and therefore blocks Builder execution.

---

## Pass Conditions

A CE package passes only when all of these are true:

1. `schema` is present and equals `ev4-builder-executable-package@1.0.0`.
2. Required Builder-bound carriers are present with the expected JSON types.
3. `builder_package_status` is `executable_ready`.
4. `builder_decisions_required` is `0`.
5. `blocking_dependencies` is an empty array.
6. `selected_candidate_locked`, `selected_candidate_id_unchanged`, and `approved_class_names_unchanged` are all `true`.
7. `selected_candidate_id` matches `architect_contract.selected_candidate_id`.
8. `approved_class_names` exactly matches `architect_contract.approved_class_names`.
9. Required structure, class, action, and confirmation references resolve deterministically.
10. Visual-reference packages preserve CE structured reference carriers, including `paradigm_to_structure_map.connector_layer: { node, model }`.
11. Package text remains data and contains no blocking prompt-injection-like markers.
12. No blocking failure code is emitted.

---

## Fail Conditions

The gate fails closed when any blocking diagnostic is emitted, including:

- missing or unsupported CE contract version
- malformed CE package shape
- missing required carrier or Builder execution context
- wrong field type
- unsupported execution status or unresolved Builder decision
- candidate/class identity mismatch
- unresolved node, class, action, or confirmation reference
- ambiguous active class scope with no explicit or contract-safe default
- CE/Builder contract drift, such as CE emitting Builder compact connector strings
- prompt-injection-like content inside package data
- unknown or forbidden top-level execution-boundary fields

---

## Non-Mutation Guarantee

The validator treats CE output as read-only data. Self-tests compare the serialized fixture before and after validation to prove the gate does not mutate input payloads.

`normalizeCeBuilderExecutablePackage` creates a separate `Builder_Context_Package` only after the gate passes. The gate itself never creates normalized data.

---

## Determinism Guarantee

For the same CE output and the same gate version, the validator returns the same:

- `result`
- `blocking`
- `contract_version`
- ordered error list
- error codes
- JSON paths
- severity values
- remediation hints

Self-tests run the gate twice per fixture and assert identical structured reports.

---

## Failure Classification Taxonomy

| Code | Severity | Blocking | Meaning | Remediation |
|---|---:|---:|---|---|
| `CONTRACT_VERSION_MISSING` | blocker | true | CE package has no supported executable-package contract version. | Add `schema: ev4-builder-executable-package@1.0.0`. |
| `CONTRACT_VERSION_UNSUPPORTED` | blocker | true | CE package declares a version Builder does not support. | Use the supported version or update the gate deliberately. |
| `SCHEMA_INVALID` | blocker | true | Payload cannot be validated as an object-shaped CE package. | Emit a JSON object under `ce_builder_executable_package` or pass the raw package object. |
| `REQUIRED_FIELD_MISSING` | blocker | true | Required CE→Builder field is absent. | Regenerate the complete CE Builder Executable Package. |
| `FIELD_TYPE_INVALID` | blocker | true | Required field has the wrong JSON type. | Fix producer shape; do not rely on coercion. |
| `FIELD_VALUE_INVALID` | blocker | true | Field value is unsupported for Builder execution. | Correct the CE output value. |
| `FORBIDDEN_FIELD_PRESENT` | blocker | true | Runtime-authority or prompt-seed field appears at the boundary. | Remove executable prose fields from CE output. |
| `UNKNOWN_FIELD_PRESENT` | blocker | true | Undeclared top-level field appears in strict boundary data. | Declare the field in the contract and add fixtures before use. |
| `SEMANTIC_INVARIANT_FAILED` | blocker | true | Cross-field execution invariant failed. | Fix locked identity, approved classes, status, or confirmation data. |
| `REFERENCE_MISSING` | blocker | true | Required evidence/reference carrier is missing. | Provide the missing structured carrier from CE evidence. |
| `REFERENCE_UNRESOLVED` | blocker | true | Node/class/action/confirmation reference does not resolve. | Fix the reference or produce the missing carrier upstream. |
| `BUILDER_REQUIRED_CONTEXT_MISSING` | blocker | true | Builder-required execution context is absent. | Regenerate CE output with full Builder context. |
| `UNSUPPORTED_BUILDER_MODE` | blocker | true | Package asks Builder to run in an unsupported mode. | Return to CE correction/evidence collection. |
| `AMBIGUOUS_CE_OUTPUT` | blocker | true | Output is ambiguous enough to alter Builder behavior. | Add explicit structured data; do not rely on prose. |
| `PROMPT_INJECTION_RISK_IN_DATA` | blocker | true | Package data contains instruction-like override text. | Remove/quarantine the text; never execute it. |
| `INTERNAL_CONTRACT_DRIFT` | blocker | true | CE output conflicts with Builder adapter/runtime contract. | Update both sides of the explicit CE→Builder contract with matching tests. |
| `VALIDATOR_INTERNAL_ERROR` | blocker | true | Validator failed unexpectedly. | Fix the validator; do not allow Builder execution. |

---

## Structured Error Report

```json
{
  "gate": "ce_to_builder_contract_gate",
  "gate_version": "1.0.0",
  "result": "pass | fail",
  "blocking": true,
  "contract_version": "ev4-builder-executable-package@1.0.0",
  "errors": [
    {
      "code": "REQUIRED_FIELD_MISSING",
      "severity": "blocker",
      "path": "$.ce_builder_executable_package.approved_structure_tree",
      "message": "approved_structure_tree is required.",
      "expected": "present",
      "actual": "missing",
      "blocking": true,
      "remediation_hint": "Regenerate the complete CE Builder Executable Package with all required carriers.",
      "evidence": "contract"
    }
  ]
}
```

---

## Manual Validation

Validate all CE→Builder gate fixtures:

```bash
node scripts/validate-ce-to-builder-contract-gate.mjs
```

Validate one CE package and print its structured report:

```bash
node scripts/validate-ce-to-builder-contract-gate.mjs path/to/ce_builder_executable_package.json
```

Run central validation:

```bash
npm run validate
```

---

## Future Contract Changes

Any future CE output contract change must update all of these together:

1. `docs/CE_TO_BUILDER_CONTRACT_GATE.md`
2. `scripts/validate-ce-to-builder-contract-gate.mjs`
3. `scripts/normalize-ce-builder-executable-package.mjs` only if adapter behavior changes
4. valid and invalid fixtures under `tests/valid` and `tests/invalid`
5. `docs/CE_BUILDER_PACKAGE_ADAPTER_CONTRACT.md` if the adapter boundary changes
6. central validation wiring in `scripts/validate.mjs` if a new validator is added

Do not weaken or bypass the gate to make a fixture pass.
