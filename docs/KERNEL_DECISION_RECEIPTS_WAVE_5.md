# Kernel Decision Receipts — Builder Wave 5

Status: presentation-layer only  
Runtime behavior changed: no  
Enforcement status upgraded: no  
Production readiness changed: no

## Purpose

Wave 5 adds a human-readable receipt layer for Builder-facing outputs while preserving the machine-readable Kernel decision trace as the source of truth.

The receipt is a label on top of trace evidence. It is not the evidence itself.

```text
machine-readable decision trace
→ receipt formatter
→ concise Persian user-facing receipt
```

## Covered Builder surfaces

```yaml
receipt_surfaces:
  - intake
  - action_batch
  - fallback
  - repair_packet
  - handoff
```

## Success receipt

A success receipt may be emitted only when the machine trace has a complete validated Builder trace:

```yaml
required_trace_fields:
  - decision_family
  - decision_card_ref
  - selected_option
  - rejected_options
  - evidence_refs
  - evidence_state
  - consumer_stage
```

Trace field typing is part of the receipt gate:

```yaml
trace_field_types:
  decision_family: non_empty_string
  decision_card_ref: non_empty_string
  selected_option: non_empty_string
  rejected_options: non_empty_array_of_non_empty_strings
  evidence_refs: non_empty_array_of_non_empty_strings
  evidence_state: validated
  consumer_stage: builder
```

User-facing text:

```text
✅ این Builder action به decision card کرنل وصل است؛ Builder فقط تصمیم قفل‌شده را به گام اجرایی تبدیل کرده و lineage حفظ شده است.
```

## Warning receipt

If any required trace field is missing, incomplete, malformed, or not validated, the output must use warning wording rather than a green success receipt.

```text
⚠️ این Builder action هنوز رسید معتبر کرنل ندارد؛ بدون machine-readable trace کامل نباید به‌عنوان تصمیم اجرایی معتبر عبور کند.
```

## Fallback warning

Fallback may explain that a fallback path was used, but it must not turn that fallback into a new Builder design decision. Formatter output preserves `repair_packet` when the fallback warning is emitted for that surface.

```text
⚠️ fallback اجرا شد، اما تصمیم جدید محسوب نمی‌شود؛ برای انتخاب جایگزین، decision trace معتبر لازم است.
```

## Explicit non-claims

Wave 5 does not claim:

```yaml
non_claims:
  - new Builder design authority
  - Builder execution proof from receipt text
  - downstream contract enforcement
  - runtime monitor enforcement
  - CI or sequence enforcement upgrade
  - production readiness
  - authored resolved fields
  - authored production_ready fields
```

## Files

```yaml
schema: schemas/kernel-decision-receipt.schema.json
formatter: scripts/format-kernel-decision-receipt.mjs
validator: scripts/validate-kernel-decision-receipts.mjs
fixtures:
  valid:
    - tests/valid/kernel_decision_receipt_builder_action_success.json
    - tests/valid/kernel_decision_receipt_intake_warning_missing_card.json
    - tests/valid/kernel_decision_receipt_fallback_warning_untraced.json
    - tests/valid/kernel_decision_receipt_repair_packet_fallback_warning.json
    - tests/valid/kernel_decision_receipt_warning_missing_fields_unordered.json
  invalid:
    - tests/invalid/kernel-receipts/success_missing_decision_card_ref.json
    - tests/invalid/kernel-receipts/success_missing_evidence_refs.json
    - tests/invalid/kernel-receipts/action_success_without_trace.json
    - tests/invalid/kernel-receipts/fallback_success_without_trace.json
    - tests/invalid/kernel-receipts/receipt_claims_builder_design_authority.json
    - tests/invalid/kernel-receipts/malformed_trace_rejected_options_string.json
    - tests/invalid/kernel-receipts/malformed_trace_evidence_refs_string.json
    - tests/invalid/kernel-receipts/malformed_trace_decision_family_object.json
    - tests/invalid/kernel-receipts/malformed_trace_empty_arrays.json
    - tests/invalid/kernel-receipts/malformed_trace_array_contains_empty_or_non_string.json
```

## Validation

```bash
node scripts/validate-kernel-decision-receipts.mjs
npm run validate
```

`npm run validate` includes the receipt validator through `scripts/validate.mjs`. The receipt validator also validates all receipt fixtures against `schemas/kernel-decision-receipt.schema.json` through AJV before applying the custom no-overclaim checks.
