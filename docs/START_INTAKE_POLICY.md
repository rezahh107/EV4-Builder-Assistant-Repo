# START_INTAKE_POLICY

Version: 0.3.0
Status: subordinate_to_builder_conversation_bootstrap_v1
Purpose: deterministic fresh intake and continuation routing.

Canonical machine authority:

```text
manifests/builder-conversation-bootstrap.v1.json
```

## Triggers

```text
شروع = fresh intake or safe idempotent intake rerun
استارت = resume a valid initialized checkpoint/state capsule
```

Recognize `شروع` when it is the complete trimmed message or begins the message followed by the approved `:` delimiter and current-message input. Do not add broad aliases.

Repository inspection, coding, tests, CI, audit, documentation, governance, PR work, and repair remain repository-maintenance mode; `شروع` inside such a request does not activate a user-facing Builder session.

Repeated `شروع` preserves confirmed checkpoints, initialized state, unresolved evidence, and the current run. It inspects newly supplied input and reruns only necessary checks.

`استارت` never fabricates continuation evidence. Without a valid initialized session, it routes to fresh intake.

## Attachment-First Intake

Before requesting data, inspect all current-message attachments, pasted JSON, copied package content, and visible file references.

Identify Builder input by parsed content and semantics. Filename is only a hint. Do not request a valid item already present. Optional screenshot absence is not a blocker unless a specific contract requires it.

Two or more candidate Builder inputs produce `blocked_ambiguous_builder_input`; automatic selection is forbidden.

## Canonical Input

```yaml
schema: ev4-builder-context-package@1.0.0
filename_hint: builder-input.json
source: EV4-Project-Gate / ce-to-builder
filename_only_acceptance: false
```

Validate against the Builder Context schema, input contract, package/cross-field validators, decision-lineage rules, and `input_authorization`.

`project-gate-c2b-receipt.json` is optional Project Gate audit evidence only. It is not Builder semantic input, is not required, and may not supply, alter, complete, or substitute package fields.

Receipt-only input stays blocked and asks for the standalone Builder input.

Raw `ce-project-gate.json` is not runtime input. Do not manually extract nested `result.output`, `downstream_artifact`, or fields to reconstruct Builder input.

The Builder-owned CE→Builder Contract Gate and Adapter remain available only as an explicit technical direct path, with no silent fallback and mandatory post-adapter Builder Context validation.

## Routing

```yaml
bare_start_no_input:
  route: waiting_for_builder_input
  workflow_mode: START_INTAKE_MODE
  runtime_state: INTAKE_WAITING
  normal_builder_batch_allowed: false

package_present:
  route: validate_builder_context_package
  workflow_mode: START_INTAKE_MODE
  runtime_state: INTAKE_VALIDATING

approved:
  workflow_mode: APPROVED_HANDOFF_MODE
  runtime_state: BUILD_ACTIVE

approved_with_optional_gaps:
  workflow_mode: APPROVED_HANDOFF_MODE
  runtime_state: BUILD_ACTIVE

invalid_wrong_schema_blocked_status_failed_authorization:
  workflow_mode: START_INTAKE_MODE
  runtime_state: EVIDENCE_REQUIRED
  normal_builder_batch_allowed: false

multiple_candidates:
  route: blocked_ambiguous_builder_input
  automatic_selection: false
```

Do not conversationally repair, coerce, normalize, or reinterpret invalid runtime input.

## Screenshot Fallback

Screenshot-only input cannot enter approved mode. `FRESH_IMAGE_MODE_LIMITED` requires explicit user acceptance and states:

```yaml
audited_upstream_architecture: false
ce_constructability_proven: false
canonical_project_gate_handoff_present: false
production_ready: false
```

## Pre-Validation Rule

Before validation and authorization pass, no `BATCH-001`, Builder batch, Elementor instruction, class application, architecture/strategy/lineage/class-scope inference, package-prose execution, prompt-seed execution, confirmation-text execution, Receipt promotion, manual nested extraction, silent direct Adapter invocation, readiness claim, visual-parity claim, Responsive-completion claim, or production-readiness claim is allowed.
