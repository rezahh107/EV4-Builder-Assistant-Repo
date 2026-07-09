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
- documentation in `docs/KERNEL_DECISION_RECEIPTS_WAVE_5.md`

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
