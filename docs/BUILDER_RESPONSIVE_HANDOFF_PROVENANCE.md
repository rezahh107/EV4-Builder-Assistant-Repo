# Builder to Responsive Handoff Provenance

Status: active_contract_carrier_v1  
Schema: `ev4-builder-responsive-handoff-provenance@1.0.0`  
Owner: `EV4-Builder-Assistant-Repo`  
Consumer: `EV4-Responsive-Architect`

## Purpose

This document defines the Builder-owned provenance carrier that travels from Builder to Responsive.

Production flow:

```text
Architect → CE → Builder → Responsive
```

Responsive must not start a production repair or adaptation run from a direct Architect packet. Responsive starts from Builder output and build evidence, plus the preserved CE and visual-governance provenance needed to know what was proven before build.

## Required carrier

Use:

```text
schemas/builder-responsive-handoff-provenance.schema.json
```

The payload schema is:

```text
ev4-builder-responsive-handoff-provenance@1.0.0
```

## Required provenance groups

```yaml
builder_provenance:
  builder_package_schema: ev4-builder-context-package@1.0.0
  builder_output_ref: string
  builder_input_authorization_digest: sha256:<64-hex>
  build_evidence_refs: []

ce_provenance:
  ce_package_schema: ev4-builder-executable-package@1.0.0
  ce_package_ref: string
  constructability_status: executable_ready
  builder_decisions_required: 0
  blocking_dependencies_count: 0

visual_governance_provenance:
  golden_reference_contract_id: string
  golden_reference_contract_hash: sha256:<64-hex>
  spatial_lexicon_version_used: string
  visual_tolerance_policy_ref: string
  build_intent_brief_ref: string
  reference_paradigm_lock_ref: string
  paradigm_to_structure_map_ref: string

builder_validation_claims:
  builder_runtime_intake_authorized: true
  visual_reference_prerequisites_present: true
  build_completed: true|false
  live_render_validated: true|false
  export_validated: true|false
  production_ready_allowed: false
```

## Boundary

This carrier is not the Builder runtime intake package. It records what Builder received, what CE proved, what visual governance was carried, and what build evidence exists.

It must not claim production readiness. Production readiness remains false until final responsive and project-gate evidence proves it.

## Negative case

`tests/invalid/builder_responsive_handoff_provenance_missing_visual_governance.invalid.json` proves that Builder must not hand Responsive a package with missing visual governance provenance.
