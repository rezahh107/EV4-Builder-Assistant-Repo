# STATUS — EV4 Builder Assistant Repo

Version: 0.3.6

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
industrial_governance: removed_from_active_system
security_posture: minimal_nonblocking
independent_review_required: false
pr_inspector_required: false
exact_head_runtime_authority: false
fixture_validation_is_real_completion: false
real_completion_requires_explicit_source_mode: true
real_completion_requires_deterministic_content_binding: true
origin_identity_independently_verified: false
manual_builder_input_mode_enabled: true
real_completion_requires_confirmation_receipt: true
real_completion_requires_verified_evidence_bytes: true
completion_status_runtime_derived: true
completion_gate_runtime_derived: true
builder_to_responsive: out_of_scope
responsive_complete: false
production_ready: false
```

## Current Delivery

```yaml
base_branch: main
verified_starting_main_sha: 45a889ed8a122f3273d2e93c724abb394430cb25
feature_branch: fix/lean-builder-truth-spine
pull_request: 66
pull_request_state: draft_open
delivery_model: exactly_one_feature_branch_and_one_pull_request
merge_performed: false
approval_performed: false
deployment_performed: false
external_repositories_modified: false
```

## Implemented on Feature Branch

- explicit `fixture-validation` and `real-builder-run` operational modes;
- explicit Runtime source modes: `project-gate`, `direct-ce`, `manual-builder-input`;
- source mode selected only through Runtime invocation;
- caller JSON unable to promote itself into another source mode;
- Project Gate Receipt limited to deterministic content-binding cross-check;
- producer repository, commit and artifact metadata removed from Runtime authority;
- direct CE digest, Contract Gate, adapter and Builder validation path;
- manual Builder Input accepted only through explicit manual mode;
- manual source recorded as `manual_operator_supplied` without Project Gate or CE origin claim;
- deterministic Runtime Context with `content_binding_status`, `source_selection`, `origin_assurance` and `receipt_binding_status`;
- selected source files reread and Context fully rederived before real Completion;
- source-byte and stored-Context drift rejection;
- Confirmation Receipt, Evidence byte/hash/claim validation, Runtime-derived Completion and atomic publication preserved;
- 7 executable legacy authority-bypass reproductions;
- 54 truth-spine regression and preservation tests;
- 11 focused F-001 explicit-source mutation and preservation tests;
- all suites wired into `npm run validate`.

## Functional Boundary

```text
operator-explicit source mode
+ exact selected source bytes
+ mode-specific deterministic derivation
+ Builder validation
+ freshly rederived Runtime Context
+ valid BUILD_ACTIVE Session and Checkpoint
+ exact Confirmation Receipt
+ verified Evidence bytes and bindings
+ compatible claim coverage
+ zero unresolved blockers
→ derived Builder Completion
```

The Runtime proves content consistency and deterministic derivation. It does not prove who created the source artifact.

Manual `builder-input.json` is permitted only through explicit `manual-builder-input`; it receives the same Builder, Session, Confirmation, Evidence and Completion checks and cannot claim Project Gate or CE origin.

## Context Semantics

```yaml
project_gate:
  source_mode: project-gate
  source_selection: operator_explicit
  content_binding_status: verified
  origin_assurance: not_independently_verified
  receipt_binding_status: matched

direct_ce:
  source_mode: direct-ce
  source_selection: operator_explicit
  content_binding_status: verified
  origin_assurance: not_independently_verified
  receipt_binding_status: not_applicable
manual_builder_input:
  source_mode: manual-builder-input
  source_selection: operator_explicit
  content_binding_status: verified
  origin_assurance: manual_operator_supplied
  receipt_binding_status: not_applicable
```

## Validation Evidence

```yaml
connector_write_evidence: confirmed
local_validation_environment: unavailable
local_commands_executed: []
validated_implementation_head: 20d40342d3af82bc5950aeee862e6716275fe1cc
validated_workflow: Schema validation
validated_run_id: 30035450978
validated_job_id: 89302182611
validated_result: passed
validated_commands:
  - npm ci
  - npm run validate
authority_bypass_reproduction_suite: passed
truth_spine_regression_suite: passed_54_of_54
f001_explicit_source_suite: passed_11_of_11
real_elementor_execution: not_verified
owner_local_pilot_required: true
```

GitHub Actions checked out the recorded implementation SHA exactly, verified the tested object, installed dependencies and completed the full validation sequence successfully. This Status update contains no Runtime logic change and remains subject to the repository's normal exact-head CI before the PR is returned to Ready for review.

## Existing Controls Preserved

- canonical state-transition table;
- `APPROVED_HANDOFF_MODE` and `BUILD_ACTIVE` predecessor requirements;
- PAUSED-only Resume behavior;
- Candidate, Session, Package and Checkpoint continuity;
- Action omission, foreign ID, duplicate and unconfirmed rejection;
- Confirmation Receipt and Evidence binding;
- atomic publication and failure cleanup;
- `responsive_complete: false`;
- `production_ready: false`.

## Remaining Functional Work

- run one Owner Local Pilot using one explicitly selected source mode;
- keep Builder → Responsive, Responsive completion and production readiness outside this PR.
