# CE_TO_BUILDER_FIELD_PRESERVATION_CONTRACT

Version: `1.0.0`
Status: `active_on_branch`

This contract protects these CE fields across the CE to Builder adapter boundary:

- `golden_reference_contract`
- `build_intent_brief`
- `spatial_lexicon_version_used`
- `visual_tolerance_policy`

The adapter copies these fields into the Builder context package, computes canonical SHA-256 digests for source and target values, and emits `ce_to_builder_field_preservation_manifest`.

The default rule is `preserve_exact`. Silent omission, rename, type change, or digest mismatch is a blocker.

Validation entrypoint:

```bash
node scripts/validate-ce-builder-field-preservation-contract.mjs
```
