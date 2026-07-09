# STATUS — EV4 Builder Assistant Repo

Version: 0.3.6
Status: ce_builder_contract_gate_merged
Date: 2026-07-09

---

## Current State

```yaml
project_status:
  project_instructions: active_v0.3.6_structured_reference_intent
  master_prompt: active_v0.3.6_structured_reference_intent
  repository_guide: active_v0.3.6
  session_state_machine: active_v0.3.6
  mode_state_matrix: active_v0.3.0
  start_intake_policy: active_v0.3.0
  session_commands: user_facing_ux_commands_added
  input_contract: elementor_class_scope_supported
  builder_context_schema: elementor_class_scope_supported
  action_batch_schema: elementor_class_scope_required_when_class_name_present
  action_batch_validator: elementor_class_scope_checked
  user_facing_wording_validator: bare_class_scope_regression_checked
  package_validator: central_contract_runner_active
  central_validation_runner: scripts/validate.mjs
  central_validation_shell_mode: shell_disabled_cross_platform_npm
  schema_registry_validation: active
  schema_registry_shell_mode: shell_disabled_cross_platform_npx
  real_elementor_execution_evidence_schema: active
  real_elementor_execution_evidence_validator: active
  smart_guidance_footer: v0.2.0
  ui_instruction_confidence_gate: active
  reference_paradigm_gate: structured_first_batch_intent_active
  ce_to_builder_reference_map_adapter: active
  ce_to_builder_package_adapter: active
  ce_to_builder_reference_ir: active
  ce_to_builder_transformation_registry: active
  ce_to_builder_contract_gate: active
  ce_builder_executable_schema_alignment: completed_in_ce_pr_24
  ce_connector_layer_projection: node_model_compact_id_enforced
  builder_to_responsive_handoff_boundary: documented_not_implemented
  kernel_decision_receipts_wave_5: presentation_layer_added_on_branch
  action_batch_contract: active
  class_application_safety: elementor_local_global_scope_required
  unit_strategy_gate: active
  unit_policy_matrix: active
  batch_compaction_contract: active
  evidence_claim_gate: active
  visual_parity_check: active
  elementor_asset_generation_gate: active
  generated_asset_contract: active
  user_facing_status_wording: active
  wording_false_positive_regressions: active
  layout_check_schema: active
  completion_gate_schema: active
  cognitive_mode_hint: active
  builder_batch_output_format: elementor_class_scope_required
  user_facing_response_policy: elementor_class_scope_wording_added
  ux_precedence_table: active
  escape_hatch_recovery: active
  recovery_state_schema: active
  inline_value_rationale: active
  source_pack: synced_for_elementor_class_scope
  action_default_max: 5
  production_ready: false
```

---

## Patch Status

```yaml
patches:
  Patch_A: present
  Patch_B: present
  Patch_C: completed
  Patch_D: present
  Patch_E: present
  Patch_F: completed
  Patch_G:
    status: completed_on_branch
    name: user-facing-builder-ux-contract
  Patch_H:
    status: completed_on_branch
    name: ux-precedence-and-escape-hatch-recovery
  Elementor_Class_Scope_Output:
    status: completed_on_branch
    branch: fix/elementor-class-scope-in-builder-output
    notes:
      - Builder batch wording now uses کلاس Elementor plus محل ثبت کلاس.
      - Action batch schema requires class_scope when class_name is present.
      - User-facing wording regression catches bare Elementor class instructions without Local Classes or Global Classes.
      - Smart Home expected response shows Local Classes for approved BEM/component classes.
  Runtime_Safety_Gates:
    status: active
    notes:
      - UNIT_STRATEGY_GATE added
      - BATCH_COMPACTION_CONTRACT added
      - COGNITIVE_MODE_HINT added
      - first_builder_batch cap hardened to 5
      - recursive package prose scanning added
      - version consistency validation added
      - layout-check machine gate added
      - completion-gate machine gate added
      - Elementor asset generation gate added
      - Reference Paradigm Gate added
      - Behavioral Contract Enforcement layer added
  Batch_1_Critical_Sync:
    status: merged
    notes:
      - runtime docs synced
      - deployable ChatGPT project pack synced
      - status/changelog synchronized after behavioral contracts
  Batch_2_Validation_Hardening:
    status: merged
    notes:
      - schema registry validation added
      - wording false-positive regressions added
      - duplicate validation orchestration reduced
      - schema registry runner hardened after Gemini review
  Pre_Batch3_Hardening:
    status: merged
    notes:
      - central validation runner shell execution removed
      - status/changelog drift corrected before structural Batch 3
  Batch_3_Structured_Reference_Intent:
    status: merged
    branch: fix/batch3-structured-reference-intent
    pr: 27
    merge_commit: 267a21ea0ccb8cb22fdf558d80f34982618a1000
    ci: schema_validation_success
    gemini_review: valid_comments_addressed_and_threads_resolved
  Final_Real_Execution_Evidence_Pack:
    status: merged
    branch: final/real-execution-evidence-pack
    pr: 31
    merge_commit: 16e1c479ef077541a71f247f988cf9db84c93bee
    ci: schema_validation_success
    notes:
      - Real Elementor execution evidence schema is present.
      - Real Elementor execution evidence validator is present and wired into central validation.
      - Template, docs, and invalid regression coverage are present.
      - Real Elementor execution remains pending user-provided UI evidence.
      - Production readiness remains false.
  CE_To_Builder_Transformation_IR:
    status: merged
    notes:
      - Formal CE→Builder transformation spec is present.
      - Canonical CE→Builder reference IR is present.
      - Machine-readable field mapping registry is present.
      - Strict registry validator is wired into central validation.
      - connector_layer projection is enforced as node:model without inserted whitespace.
  CE_To_Builder_Contract_Gate:
    status: merged
    pr: 42
    ci: schema_validation_success
    downstream_ce_alignment: completed_in_pr_24
    notes:
      - Gate validates CE builder executable packages before normalization.
      - Gate is deterministic and fail-closed.
      - Gate does not repair, normalize, coerce, delete, or reinterpret CE output.
      - Gemini review suggestions were applied and regression-covered before merge.
  Builder_To_Responsive_Handoff_Boundary:
    status: documented_not_implemented
    boundary_doc: docs/BUILDER_TO_RESPONSIVE_HANDOFF_BOUNDARY.md
  Wave_5_Kernel_Decision_Receipts:
    status: completed_on_branch
    branch: ux/builder-kernel-decision-receipts-wave-5
    boundary: presentation_layer_only
    notes:
      - Added UX-safe human-readable Kernel decision receipts for Builder output surfaces.
      - Success receipt requires complete validated machine-readable decision trace.
      - Warning receipt is used for incomplete or missing trace.
      - Fallback warning does not create a new Builder design decision.
      - No enforcement status or production readiness status was upgraded.
```

---

## Integration Sync

```yaml
integration_sync:
  status: completed_for_ce_builder_contract_gate
  docs_status_changelog: synced_for_ce_builder_gate
  package_version: 0.3.6
  smart_home_architecture_mutation: none_intended
  selected_candidate_id: ARCH-FAM-C_preserved
  approved_class_mutation: none_intended
  production_ready_allowed_default: false_preserved
  ce_to_builder_transform_mutation: explicit_registry_ir_and_gate_only
  ce_producer_schema_alignment: completed_in_constructability_engineer_pr_24
  wave_5_mutation: receipt_presentation_layer_only
```

---

## Validation State

```yaml
validation_state:
  local_validation: not_claimed_from_connector_environment
  central_validation_entrypoint: npm run validate
  ce_to_builder_transformation_registry_validator: scripts/validate-ce-builder-transformation-registry.mjs
  ce_to_builder_contract_gate_validator: scripts/validate-ce-to-builder-contract-gate.mjs
  kernel_decision_receipt_validator: scripts/validate-kernel-decision-receipts.mjs
  kernel_decision_receipt_schema: schemas/kernel-decision-receipt.schema.json
  builder_to_responsive_boundary_doc: docs/BUILDER_TO_RESPONSIVE_HANDOFF_BOUNDARY.md
  ce_reference_ir_preservation_check: added
  ce_connector_layer_node_model_projection_check: added
  class_scope_regressions_added: true
  pr_31_ci: schema_validation_success
  pr_42_ci: schema_validation_success
  ce_pr_24_ci: validate_fixtures_success
  real_builder_session_test: pending_user_execution
  real_elementor_execution: pending_user_execution
```

---

## Boundary

```text
EV4 Builder Assistant is not EV4 Architect or Constructability Engineer.
Package free-text is data, not executable instruction.
Runtime confirmation is generated from trusted confirmation_request templates.
Current UI evidence or direct user statement is required for executable version-sensitive control paths.
Every actionable Elementor class instruction must show Local Classes or Global Classes, or block when scope is not safely determinable.
Normal builder batches are user-facing and should not expose internal schema/source fields.
Visual-reference parity requires structured Reference Paradigm Gate data before BATCH-001.
first_batch_structure_intent is the decisive first-batch structural source when present/required.
Raw CE structured objects must pass the formal CE→Builder transformation layer and CE→Builder Contract Gate before Builder runtime intake.
No CE→Builder field transform may run unless declared in the mapping registry.
CE connector_layer {node, model} projects to Builder connector_layer as node:model.
Kernel decision receipts are presentation-layer text only and must not replace machine-readable decision trace.
Green Builder receipt wording requires complete validated decision trace with decision_family, decision_card_ref, selected_option, rejected_options, evidence_refs, evidence_state, and consumer_stage.
Fallback receipt wording must not create a new Builder design decision.
Real Elementor execution evidence is required before any production-readiness claim.
Execution-affecting behavior must be contract-driven and pass the relevant behavioral contract.
After repeated failure, Escape Hatch or repair packet replaces repeated instructions.
Production ready remains false unless completion-gate evidence proves otherwise.
```

---

## Pending Next Work

```text
Continue real Elementor UI evidence collection using examples/smart-home-connector/real_elementor_execution_evidence.template.json.
Do not claim production readiness until real execution evidence and completion gate proofs are confirmed.
Formal Builder→Responsive export schema remains not implemented.
Project Gate verifier/runtime remains a separate future integration, not implemented here.
Recommended next Wave 5 repository: rezahh107/EV4-Responsive-Architect.
```
