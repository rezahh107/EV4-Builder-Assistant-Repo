# STATUS — EV4 Builder Assistant Repo

Version: 0.3.6
Status: real_execution_evidence_pack_ready_for_ci
Date: 2026-07-01

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
    status: ready_for_ci_on_pr_branch
    branch: final/real-execution-evidence-pack
```

---

## Integration Sync

```yaml
integration_sync:
  status: completed_for_elementor_class_scope_output
  docs_status_changelog: synced_for_class_scope_patch
  deployable_chatgpt_project_pack: synced_for_class_scope_patch
  package_version: 0.3.6
  smart_home_architecture_mutation: none_intended
  selected_candidate_id: ARCH-FAM-C_preserved
  approved_class_mutation: none_intended
  production_ready_allowed_default: false_preserved
```

---

## Validation State

```yaml
validation_state:
  local_validation: not_run_in_repo_clone
  reason_local_validation_not_run: GitHub connector applies file writes but this environment does not provide a checked-out npm workspace
  central_validation_entrypoint: npm run validate
  class_scope_regressions_added: true
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
Real Elementor execution evidence is required before any production-readiness claim.
Execution-affecting behavior must be contract-driven and pass the relevant behavioral contract.
After repeated failure, Escape Hatch or repair packet replaces repeated instructions.
Production ready remains false unless completion-gate evidence proves otherwise.
```

---

## Pending Next Work

```text
Run npm run validate in a checked-out repository or CI for the branch fix/elementor-class-scope-in-builder-output.
Then continue real Elementor UI evidence collection using examples/smart-home-connector/real_elementor_execution_evidence.template.json.
Do not claim production readiness until real execution evidence and completion gate proofs are confirmed.
```
