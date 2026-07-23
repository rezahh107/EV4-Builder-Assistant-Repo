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
- Project Gate Receipt reduced to deterministic content-binding cross-check;
- Project Gate producer/repository/commit metadata removed from Runtime authority;
- direct CE content digest, Contract Gate, adapter and Builder validation path;
- manual Builder Input accepted only through explicit manual mode;
- manual source recorded as `manual_operator_supplied` without Project Gate or CE origin claim;
- deterministic Runtime Context with `content_binding_status`, `source_selection`, `origin_assurance` and `receipt_binding_status`;
- source files reread and Context fully rederived before real Completion;
- source-byte and stored-Context drift rejection;
- executable `confirm-batch` and functional Confirmation Receipt;
- Evidence byte reading, SHA-256 recomputation and claim compatibility validation;
- Runtime-derived Completion Status and Completion Gate;
- atomic publication of derived Completion carriers;
- 7 executable legacy-path reproductions for authority bypasses B1–B7;
- 54 post-repair truth-spine mutation and preservation tests;
- 11 focused F-001 explicit-source mutation and preservation tests;
- all suites wired into `npm run validate`.

## Functional Boundary

A real Builder Completion requires:

```text
operator-explicit source mode
+ exact selected source bytes
+ mode-specific content derivation
+ deterministic Builder validation
+ freshly rederived Runtime Context
+ valid BUILD_ACTIVE Session and Checkpoint
+ exact Confirmation Receipt
+ verified Evidence bytes and bindings
+ compatible claim coverage
+ zero unresolved blockers
→ derived Builder Completion
```

The Runtime proves content consistency and deterministic derivation. It does not prove who created the source artifact.

The following do not independently authorize a real Completion:

- producer repository or commit metadata;
- a source-mode field inside caller JSON;
- Project Gate Receipt metadata beyond required content-binding values;
- `confirmed_action_ids` without Confirmation Receipt;
- declared `content_sha256` without source-byte verification;
- synthetic or fixture Evidence;
- caller-authored Completion booleans;
- caller-authored proof status.

Manual `builder-input.json` is permitted only when the operator explicitly invokes `manual-builder-input`. It receives the same Builder, Session, Confirmation, Evidence and Completion checks and cannot claim Project Gate or CE origin.

## Context Semantics

Project Gate:

```yaml
source_mode: project-gate
source_selection: operator_explicit
content_binding_status: verified
origin_assurance: not_independently_verified
receipt_binding_status: matched
```

Direct CE:

```yaml
source_mode: direct-ce
source_selection: operator_explicit
content_binding_status: verified
origin_assurance: not_independently_verified
receipt_binding_status: not_applicable
```

Manual Builder Input:

```yaml
source_mode: manual-builder-input
source_selection: operator_explicit
content_binding_status: verified
origin_assurance: manual_operator_supplied
receipt_binding_status: not_applicable
```

## Existing Controls Preserved

- canonical state-transition table;
- `APPROVED_HANDOFF_MODE` and `BUILD_ACTIVE` predecessor requirements;
- PAUSED-only Resume behavior;
- Candidate, Session, Package and Checkpoint continuity;
- exact embedded Checkpoint consistency;
- Action omission, foreign ID, duplicate and unconfirmed rejection;
- terminal predecessor rejection;
- Confirmation Receipt binding;
- Evidence source-byte and claim binding;
- atomic publication and failure cleanup;
- `responsive_complete: false`;
- `production_ready: false`.

## Validation Status

```yaml
connector_write_evidence: confirmed
local_validation_environment: unavailable
local_commands_executed: []
previous_validated_head: 9e937bab6b489587b631464b0ab98a424773f61f
previous_validated_workflow: Schema validation
previous_validated_run_id: 30024931393
previous_validated_result: passed
f001_explicit_source_suite: added_pending_exact_head_ci
current_head_exact_ci: pending
real_elementor_execution: not_verified
owner_local_pilot_required: true
```

No local command is reported as passed. The current F-001 repair requires a fresh GitHub Actions run on the exact new PR Head before the PR returns to Ready for review.

## Remaining Functional Work

- obtain exact-head CI for the current PR Head;
- resolve any evidence-backed CI failure;
- run one Owner Local Pilot using one explicitly selected source mode;
- keep Builder → Responsive, Responsive completion and production readiness outside this PR.
