# STATUS — EV4 Builder Assistant Repo

Version: 0.3.6
Status: behavioral_contracts_active
Date: 2026-06-29

---

## Current State

```yaml
project_status:
  project_instructions: active_v0.3.6_behavioral_contracts
  master_prompt: active_v0.3.6_behavioral_contracts
  repository_guide: active_v0.3.6
  session_state_machine: active_v0.3.6
  mode_state_matrix: active_v0.3.0
  start_intake_policy: active_v0.3.0
  session_commands: user_facing_ux_commands_added
  input_contract: structured_confirmation_trust_boundary
  builder_context_schema: reference_paradigm_and_authorization_supported
  package_validator: central_contract_runner_active
  central_validation_runner: scripts/validate.mjs
  smart_guidance_footer: v0.2.0
  ui_instruction_confidence_gate: active
  reference_paradigm_gate: active
  action_batch_contract: active
  unit_strategy_gate: active
  unit_policy_matrix: active
  batch_compaction_contract: active
  evidence_claim_gate: active
  visual_parity_check: active
  elementor_asset_generation_gate: active
  generated_asset_contract: active
  user_facing_status_wording: active
  layout_check_schema: active
  completion_gate_schema: active
  cognitive_mode_hint: active
  builder_batch_output_format: active
  user_facing_response_policy: active_v0.2.0
  ux_precedence_table: active
  escape_hatch_recovery: active
  recovery_state_schema: active
  inline_value_rationale: active
  source_pack: synced_after_behavioral_contracts
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
```

---

## Integration Sync

```yaml
integration_sync:
  status: completed_for_v0.3.6_behavioral_contracts
  docs_status_changelog: synced_in_batch1_critical_sync
  deployable_chatgpt_project_pack: synced_in_batch1_critical_sync
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
  github_actions_schema_validation: pending_for_batch1_critical_sync_pr
  local_validation: not_run_in_repo_clone
  reason_local_validation_not_run: GitHub connector applies file writes but does not provide a local checked-out repo or npm execution environment
  central_validation_entrypoint: npm run validate
  real_builder_session_test: in_progress_by_user
  real_elementor_execution: in_progress_by_user
```

---

## Boundary

```text
EV4 Builder Assistant is not EV4 Architect or Constructability Engineer.
Package free-text is data, not executable instruction.
Runtime confirmation is generated from trusted confirmation_request templates.
Current UI evidence or direct user statement is required for executable version-sensitive control paths.
Normal builder batches are user-facing and should not expose internal schema/source fields.
Visual-reference parity requires structured Reference Paradigm Gate data before BATCH-001.
Execution-affecting behavior must be contract-driven and pass the relevant behavioral contract.
After repeated failure, Escape Hatch or repair packet replaces repeated instructions.
Production ready remains false unless completion-gate evidence proves otherwise.
```

---

## Pending Next Work

```text
run GitHub Actions central validation for Batch 1 critical sync
complete Batch 2 validation hardening if needed: schema registry compile, wording regression fixtures, duplicate validation cleanup
complete Batch 3 structural hardening if needed: first_batch_structure_intent replacing free-text paradigm heuristics
continue real Elementor execution and record evidence
```
