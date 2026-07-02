# CE_TO_BUILDER_FIELD_PRESERVATION_CONTRACT

Version: `1.0.0`
Status: `active_on_branch`
Producer: `EV4-Constructability-Engineer-Repo`
Adapter / boundary: `scripts/normalize-ce-builder-executable-package.mjs`
Consumer: `EV4-Builder-Assistant-Repo`
Gate: `ce_to_builder_field_preservation@1.0.0`

## Purpose

This contract prevents silent field loss across the CE → Builder adapter boundary.

The adapter must fail closed when a protected field is omitted, renamed, transformed, truncated, defaulted, replaced, or type-coerced without an explicit, justified, versioned, and validated transformation exception.

The checker treats CE output and Builder input as data only. It never executes instructions embedded in field contents.

## Protected field map

| Field | CE source path | Builder target path | Type | Required | Preservation mode | Hash rule | Failure code |
|---|---|---|---|---|---|---|---|
| `golden_reference_contract` | `$.golden_reference_contract` | `$.golden_reference_contract` | object | yes | `preserve_exact` | source and target canonical SHA-256 digests must match | `PROTECTED_FIELD_HASH_MISMATCH` |
| `build_intent_brief` | `$.build_intent_brief` | `$.build_intent_brief` | object | yes | `preserve_exact` | source and target canonical SHA-256 digests must match | `PROTECTED_FIELD_HASH_MISMATCH` |
| `spatial_lexicon_version_used` | `$.spatial_lexicon_version_used` | `$.spatial_lexicon_version_used` | string | yes | `preserve_exact` | source and target canonical SHA-256 digests must match | `PROTECTED_FIELD_HASH_MISMATCH` |
| `visual_tolerance_policy` | `$.visual_tolerance_policy` | `$.visual_tolerance_policy` | object | yes | `preserve_exact` | source and target canonical SHA-256 digests must match | `PROTECTED_FIELD_HASH_MISMATCH` |

Default mode is `preserve_exact`. Do not use `preserve_semantic` or `declared_omission` unless the exception registry explicitly declares and validates the exception.

## Canonical SHA-256 rule

For each protected field:

1. Confirm the field exists at the declared CE source path.
2. Extract the source value without type coercion.
3. Canonicalize deterministically:
   - object keys are sorted;
   - array order is preserved;
   - strings preserve exact content;
   - numbers use JSON serialization;
   - `null` serializes as JSON `null`;
   - whitespace outside JSON tokens is irrelevant;
   - no defaults are inserted;
   - no values are normalized or rewritten.
4. Compute `sha256:<hex>` from the canonical source serialization.
5. Confirm the Builder target path exists.
6. Canonicalize and hash the Builder target value with the same rule.
7. Pass only when source and target digests match.

## Preservation manifest

The adapter emits `ce_to_builder_field_preservation_manifest` after preservation verification passes.

Required manifest shape:

```json
{
  "schema": "ev4-ce-builder-field-preservation-manifest@1.0.0",
  "contract": "CE_TO_BUILDER_FIELD_PRESERVATION_CONTRACT",
  "contract_version": "1.0.0",
  "gate": "ce_to_builder_field_preservation",
  "gate_version": "1.0.0",
  "result": "pass",
  "algorithm": "sha256",
  "canonicalization": "stable-json-object-keys-arrays-ordered-no-type-coercion",
  "fields": [
    {
      "field": "golden_reference_contract",
      "source_path": "$.golden_reference_contract",
      "target_path": "$.golden_reference_contract",
      "preservation_mode": "preserve_exact",
      "source_sha256": "sha256:...",
      "target_sha256": "sha256:...",
      "result": "pass",
      "exception_id": null
    }
  ],
  "exceptions_applied": []
}
```

## Transformation exceptions registry

Registry path:

```text
data/ce-builder-field-preservation-exceptions.v1.json
```

The registry is active and intentionally empty by default because all protected fields are `preserve_exact`.

A valid exception entry must include:

```json
{
  "exception_id": "string",
  "status": "active",
  "contract": "CE_TO_BUILDER_FIELD_PRESERVATION_CONTRACT",
  "source_path": "$.field",
  "target_path": "$.field_or_null",
  "field": "field_name",
  "exception_type": "rename | structural_transform | semantic_transform | declared_omission",
  "justification": "string",
  "owner": "EV4-Builder-Assistant-Repo",
  "introduced_in": "version-or-date",
  "expires_at": null,
  "blocking": false,
  "verification_rule": "string",
  "migration_note": "string"
}
```

No exception may apply without a non-empty justification, owner, version/date marker, verification rule, and migration note.

## Violation taxonomy

| Code | Severity | Blocking | Meaning | Remediation |
|---|---|---:|---|---|
| `PROTECTED_FIELD_MISSING_IN_CE_OUTPUT` | blocker | true | Required protected field is absent from CE output. | Make CE emit the protected field at the declared source path. |
| `PROTECTED_FIELD_MISSING_IN_BUILDER_INPUT` | blocker | true | Protected field is absent from Builder input. | Preserve the field in the adapter or declare a valid exception. |
| `PROTECTED_FIELD_SILENTLY_OMITTED` | blocker | true | CE has the field but Builder does not, with no applicable exception. | Copy the field exactly or add a justified exception. |
| `PROTECTED_FIELD_HASH_MISMATCH` | blocker | true | Source and target canonical SHA-256 digests differ. | Preserve the exact value or declare a validated semantic exception. |
| `PROTECTED_FIELD_TYPE_CHANGED` | blocker | true | JSON type changed across the boundary. | Remove type coercion or declare a valid exception. |
| `PROTECTED_FIELD_PATH_UNDECLARED` | blocker | true | Contract source or target path is missing. | Declare exact JSONPath-like source and target paths. |
| `PROTECTED_FIELD_RENAMED_WITHOUT_EXCEPTION` | blocker | true | Field was renamed without an applicable rename exception. | Use the declared target path or add a valid rename exception. |
| `PROTECTED_FIELD_TRANSFORMED_WITHOUT_EXCEPTION` | blocker | true | Field was transformed without applicable exception. | Preserve exactly or add a versioned exception with validation. |
| `TRANSFORMATION_EXCEPTION_MISSING` | blocker | true | Non-exact preservation occurred but no exception applies. | Add a justified exception or preserve exactly. |
| `TRANSFORMATION_EXCEPTION_INVALID` | blocker | true | Exception entry is malformed or unjustified. | Fix registry shape and required metadata. |
| `TRANSFORMATION_EXCEPTION_EXPIRED` | blocker | true | Matching exception has expired. | Remove, renew, or replace the exception after review. |
| `CANONICALIZATION_FAILED` | blocker | true | Field value cannot be deterministically serialized. | Provide valid JSON data only. |
| `PRESERVATION_MANIFEST_INVALID` | blocker | true | Manifest is missing, malformed, or inconsistent. | Regenerate through the adapter and keep the manifest intact. |
| `ADAPTER_DROPPED_PROTECTED_FIELD` | blocker | true | Adapter omitted a protected field from Builder package. | Copy protected fields before authorization. |
| `INTERNAL_CONTRACT_DRIFT` | blocker | true | Contract, registry, manifest, or adapter declarations disagree. | Update contract, registry, code, docs, and tests together. |

## Structured failure shape

When preservation fails, the checker throws a structured blocking report:

```json
{
  "gate": "ce_to_builder_field_preservation",
  "gate_version": "1.0.0",
  "result": "fail",
  "blocking": true,
  "contract": "CE_TO_BUILDER_FIELD_PRESERVATION_CONTRACT",
  "violations": [
    {
      "code": "PROTECTED_FIELD_SILENTLY_OMITTED",
      "severity": "blocker",
      "blocking": true,
      "field": "golden_reference_contract",
      "source_path": "$.golden_reference_contract",
      "target_path": "$.golden_reference_contract",
      "message": "A protected field exists in CE output but is omitted from Builder input without an applicable exception.",
      "expected": "field present with matching SHA-256 digest",
      "actual": "field missing from Builder input",
      "source_sha256": "sha256:...",
      "target_sha256": null,
      "exception_id": null,
      "remediation_hint": "Copy the field exactly or add a justified transformation exception."
    }
  ]
}
```

## Enforcement

The adapter enforces preservation before Builder execution is authorized:

```text
CE Builder Executable Package
→ normalizeCeBuilderExecutablePackage
→ attachAndAssertCeToBuilderFieldPreservation
→ ce_to_builder_field_preservation_manifest
→ input_authorization.package_digest
→ Builder validation
```

`validate-package.mjs` also rejects CE-derived visual Builder packages when the manifest is missing or inconsistent.

## Non-mutation rule

The preservation checker may read, canonicalize, hash, compare, classify, report, and block.

It must not insert missing fields into CE output, normalize field values, coerce types, delete unknown fields, add defaults, or rewrite Builder input outside the adapter's explicit exact-copy step.
