# Wave 5 — Kernel Decision Receipts

Status: completed on branch `ux/builder-kernel-decision-receipts-wave-5`

## Summary

Added a Builder-specific UX-safe receipt layer for Kernel decision traces.

## Boundary

This is a presentation-layer extension only. It does not replace machine-readable trace, create Builder design authority, claim execution proof, claim downstream enforcement, or change production readiness.

## Added

- `schemas/kernel-decision-receipt.schema.json`
- `scripts/format-kernel-decision-receipt.mjs`
- `scripts/validate-kernel-decision-receipts.mjs`
- valid success/warning/fallback-warning receipt fixtures
- invalid regressions blocking green success receipts without complete trace
- malformed trace type regressions for string/object/empty-array/non-string-array cases
- `repair_packet` fallback-warning formatter coverage
- documentation in `docs/KERNEL_DECISION_RECEIPTS_WAVE_5.md`

## Inspector repair follow-up

The PR Inspector handoff identified four issues. The branch now applies the smallest safe repair:

```yaml
repaired_findings:
  PRF-001:
    repair: decision_trace schema no longer uses overlapping oneOf success-path validation
    evidence: receipt fixtures are AJV-validated against schemas/kernel-decision-receipt.schema.json
  PRF-002:
    repair: formatter requires explicit string and non-empty string-array field types
    evidence: malformed trace type fixtures added
  PRF-003:
    repair: formatter preserves repair_packet for fallback-warning receipts
    evidence: repair_packet fallback-warning fixture added
  PRF-004:
    repair: missing_trace_fields custom comparison is order-insensitive
    evidence: unordered missing_trace_fields warning fixture added
```

## Validation entrypoint

```bash
node scripts/validate-kernel-decision-receipts.mjs
npm run validate
```

## Explicit non-claims

```yaml
non_claims:
  ci_enforced_upgrade: false
  sequence_ci_enforced_upgrade: false
  downstream_contract_enforced_upgrade: false
  runtime_monitor_enforced_upgrade: false
  production_ready_upgrade: false
  builder_execution_proof_from_receipt: false
  builder_design_authority_added: false
```
