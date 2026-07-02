# STATUS — EV4 Builder Assistant Repo

Version: 0.3.6
Status: real_execution_evidence_pack_ready_for_ci
Date: 2026-07-02

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
  real_elementor_execution_evidence_schema: active_on_pr_branch
  real_elementor_execution_evidence_validator: active_on_pr_branch
  smart_guidance_footer: v0.2.0
  ui_instruction_confidence_gate: active
  reference_paradigm_gate: structured_first_batch_intent_active
  ce_to_builder_reference_map_adapter: active
  ce_to_builder_package_adapter: active
  ce_to_builder_reference_ir: active_on_branch
  ce_to_builder_transformation_registry: active_on_branch
  ce_connector_layer_projection: node_model_compact_id_enforced_on_branch
  ce_to_builder_field_preservation_contract: active_on_branch
  ce_to_builder_field_preservation_manifest: active_on_branch
  ce_to_builder_field_preservation_exceptions_registry: active_empty_registry_on_branch
  ce_to_builder_field_preservation_schema_sync: pending_builder_context_schema_update
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
      - diagnostic template registry parse hardened
  CE_To_Builder_Field_Preservation:
    status: partial_on_branch
    branch: fix-ce-builder-field-preservation
    notes:
      - CE protected field contract helper added.
      - Empty explicit exception registry added.
      - CE package adapter now exact-copies protected fields and emits SHA-256 preservation manifest before input authorization.
      - Builder package validator now blocks CE-derived visual packages with missing or invalid preservation manifest.
      - Remaining schema sync is pending for builder-context-package.schema.json before full validation can be claimed.
```
