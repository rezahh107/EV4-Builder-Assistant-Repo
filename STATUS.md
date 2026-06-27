# STATUS — EV4 Builder Assistant Repo

Version: 0.2.0
Status: example_and_validation_seed_added
Date: 2026-06-27

---

## Current State

```yaml
project_status:
  repo_initialized: true
  README: active_v0.2.0
  PROJECT_INSTRUCTIONS: active_initial_v0.1.1
  MASTER_PROMPT: active_initial_v0.1.1
  input_contracts: active_initial_v0.1.2
  core_runtime_files: active_initial
  modes: all_initial_modes_present
  protocols: partial_initial_v0.1.2
  commands: active_initial_v0.1.2
  schemas: initial_with_element_generation
  examples: template_and_smart_home_seed_added
  tests: valid_and_invalid_seed_added
  schema_validation_workflow: added
  production_ready: false
```

---

## Files Created

```text
PROJECT_INSTRUCTIONS.md
core/MASTER_PROMPT.md
input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md
core/SESSION_STATE_MACHINE.md
core/LIVE_INTERFACE_PRECEDENCE.md
modes/APPROVED_HANDOFF_MODE.md
modes/CORRECTION_MODE.md
modes/FRESH_IMAGE_MODE.md
protocols/CONTROL_EXISTENCE_FAILURE.md
commands/SESSION_COMMANDS.md
protocols/PER_ELEMENT_INSTRUCTION.md
protocols/CLASS_APPLICATION_SAFETY.md
protocols/COMPLETION_GATE.md
protocols/STEP_SIZE_CONTRACT.md
protocols/V3_V4_SEPARATION_GUARD.md
protocols/LAYOUT_COMPLETENESS_CHECKLIST.md
schemas/builder-context-package.schema.json
schemas/session-state.schema.json
schemas/checkpoint.schema.json
examples/_template/README.md
examples/_template/start_session_prompt.md
examples/_template/builder_context_package.template.json
examples/smart-home-connector/README.md
examples/smart-home-connector/builder_context_package.json
examples/smart-home-connector/start_session_prompt.md
examples/smart-home-connector/expected_first_response.md
examples/smart-home-connector/notes.md
tests/valid/builder_context_package.json
tests/invalid/missing_selected_candidate.json
.github/workflows/schema-validation.yml
```

---

## Review Fixes Applied

```yaml
review_fixes:
  bounded_action_count:
    status: clarified
    note: max_actions_per_turn remains intentionally bounded to 1..6
  action_count_commands:
    status: added_to_SESSION_COMMANDS
  builder_context_package_schema:
    status: added
  data_vs_instruction_duplication:
    status: reduced
    canonical_source: core/MASTER_PROMPT.md section 3
  unverified_element_type_protocol:
    status: added
  correction_output_shapes:
    status: unified_under_correction_response
  element_generation_schema_gap:
    status: fixed
    note: approved_structure_tree nodes and first_builder_batch actions now require element_generation
  element_generation_input_contract:
    status: fixed
  widget_mapping_table_min_items:
    status: fixed
  reset_scope_enum:
    status: added
  fresh_image_mode:
    status: added_fallback_only
```

---

## Validation State

```yaml
validation_state:
  markdown_written: true
  builder_context_package_schema_written: true
  element_generation_schema_binding: true
  element_generation_input_contract_binding: true
  valid_fixture_added: true
  invalid_fixture_added: true
  schema_ci: added_waiting_for_github_actions_result
  real_builder_session_test: not_run
  smart_home_example: seed_added
  project_instruction_upload_test: pending
```

---

## Active Role Boundary

```text
EV4 Builder Assistant is not EV4 Architect.
It does not score, recommend, redesign, or claim production readiness.
It executes approved handoffs interactively in Elementor.
```

---

## Pending Next Work

```text
watch schema-validation workflow result
fix CI/schema/fixtures if needed
run a manual Builder Assistant session using examples/smart-home-connector/
expand docs/REPOSITORY_GUIDE.md into final guide after real run evidence
```
