# Lean Personal Runtime Control Inventory

```yaml
repository_profile: personal_single_operator
production_ready: false
```

Each material control is classified by the concrete Builder error it prevents.

## Runtime correctness controls

```yaml
- control_id: RUNTIME-INPUT-SCHEMA
  current_source: schemas/builder-context-package.schema.json
  current_enforcement: Lightweight Inspector intake plus normal CI
  real_error_prevented: malformed or wrong-contract Builder input enters execution
  personal_project_value: critical
  runtime_blocking_effect: blocks invalid intake
  classification: RUNTIME_CORRECTNESS_REQUIRED
  action: retain_and_reuse

- control_id: RUNTIME-INPUT-SEMANTICS
  current_source: scripts/validate-package.mjs
  current_enforcement: Lightweight Inspector intake plus regression tests
  real_error_prevented: cross-field contradictions or invalid authorization reach Builder actions
  personal_project_value: critical
  runtime_blocking_effect: blocks semantically invalid intake
  classification: RUNTIME_CORRECTNESS_REQUIRED
  action: retain

- control_id: RUNTIME-PACKAGE-DIGEST
  current_source: scripts/lib/canonical-builder-package.mjs
  current_enforcement: Intake capsule, Resume, Completion and deep transaction tests
  real_error_prevented: stale or changed Builder package is used after validation
  personal_project_value: critical
  runtime_blocking_effect: blocks stale-file continuation
  classification: RUNTIME_CORRECTNESS_REQUIRED
  action: retain_sha256_identity_only

- control_id: RUNTIME-CANDIDATE-CONTINUITY
  current_source: Builder Context, Session State, Checkpoint and Inspector
  current_enforcement: semantic validators and cross-carrier comparisons
  real_error_prevented: actions execute against a different architecture candidate
  personal_project_value: critical
  runtime_blocking_effect: blocks mismatched intake, Resume or Completion
  classification: RUNTIME_CORRECTNESS_REQUIRED
  action: retain

- control_id: RUNTIME-DECISION-LINEAGE
  current_source: scripts/validate-builder-context-decision-lineage.mjs
  current_enforcement: Intake Inspector and lineage-sequence regression
  real_error_prevented: upstream decision context is dropped, replaced or contradicted
  personal_project_value: critical
  runtime_blocking_effect: blocks lineage mismatch
  classification: RUNTIME_CORRECTNESS_REQUIRED
  action: retain

- control_id: RUNTIME-ACTION-SEMANTICS
  current_source: schemas/action-batch.schema.json and scripts/validate-action-batch.mjs
  current_enforcement: Action Batch validation
  real_error_prevented: wrong target, class, responsive scope or unsafe high-risk action is issued
  personal_project_value: critical
  runtime_blocking_effect: blocks invalid Action Batch
  classification: RUNTIME_CORRECTNESS_REQUIRED
  action: retain_and_simplify_metadata

- control_id: RUNTIME-CONFIRMATION-BINDING
  current_source: Action Batch, confirmation request and deep transaction validator
  current_enforcement: checkpointed action requires confirmation scope and exact active binding
  real_error_prevented: stale or unrelated user text confirms the wrong action set
  personal_project_value: critical
  runtime_blocking_effect: blocks state advancement
  classification: RUNTIME_CORRECTNESS_REQUIRED
  action: retain

- control_id: RUNTIME-SESSION-STATE
  current_source: schemas/session-state.schema.json and scripts/validate-session-state.mjs
  current_enforcement: Resume and Completion Inspector
  real_error_prevented: fabricated, contradictory or illegal continuation state
  personal_project_value: critical
  runtime_blocking_effect: blocks invalid Resume or Completion
  classification: RUNTIME_CORRECTNESS_REQUIRED
  action: strengthen_identity_and_mode_rules

- control_id: RUNTIME-CHECKPOINT
  current_source: schemas/checkpoint.schema.json and scripts/validate-checkpoint.mjs
  current_enforcement: checkpoint validation and Inspector comparisons
  real_error_prevented: completed, pending or evidenced actions are misremembered
  personal_project_value: critical
  runtime_blocking_effect: blocks invalid Resume or Completion
  classification: RUNTIME_CORRECTNESS_REQUIRED
  action: strengthen_identity_and_blocker_rules

- control_id: RUNTIME-UNRESOLVED-BLOCKERS
  current_source: Session State, Checkpoint and runtime/state-transitions.v1.json
  current_enforcement: state validator, Resume and Completion Inspector
  real_error_prevented: blocking evidence silently disappears
  personal_project_value: critical
  runtime_blocking_effect: blocks Resume inconsistency and Completion
  classification: RUNTIME_CORRECTNESS_REQUIRED
  action: retain

- control_id: RUNTIME-COMPLETION
  current_source: Completion Status, Completion Gate, Checkpoint, Session State and Inspector
  current_enforcement: completion command and state table
  real_error_prevented: false Builder completion from text, file presence or illegal state
  personal_project_value: critical
  runtime_blocking_effect: blocks false completion
  classification: RUNTIME_CORRECTNESS_REQUIRED
  action: repair_and_strengthen
```

## Maintenance correctness controls

```yaml
- control_id: MAINT-SCHEMA-REGISTRY
  current_source: scripts/validate-schema-registry.mjs
  current_enforcement: normal CI
  real_error_prevented: broken or unresolved Schema contracts merge
  personal_project_value: high
  runtime_blocking_effect: none during a normal Builder Run
  classification: MAINTENANCE_CORRECTNESS_REQUIRED
  action: retain_in_ci

- control_id: MAINT-REGRESSION-FIXTURES
  current_source: tests/valid and tests/invalid
  current_enforcement: scripts/validate.mjs
  real_error_prevented: known input, state, action and completion regressions return
  personal_project_value: high
  runtime_blocking_effect: none during a normal Builder Run
  classification: MAINTENANCE_CORRECTNESS_REQUIRED
  action: retain_and_expand

- control_id: MAINT-DEEP-RUNTIME-TRANSACTION
  current_source: scripts/validate-builder-runtime-transaction.mjs
  current_enforcement: CI regression and diagnostic only
  real_error_prevented: cross-carrier transaction binding regressions
  personal_project_value: high
  runtime_blocking_effect: not required per message or Action Batch
  classification: MAINTENANCE_CORRECTNESS_REQUIRED
  action: preserve_as_deep_regression

- control_id: MAINT-DETERMINISTIC-PROJECT-PACK
  current_source: runtime/project-pack-source-map.v1.json and scripts/build-project-pack.mjs
  current_enforcement: normal CI
  real_error_prevented: stale or hand-edited deployable instructions diverge from canonical runtime
  personal_project_value: high
  runtime_blocking_effect: none in an already deployed normal Run
  classification: MAINTENANCE_CORRECTNESS_REQUIRED
  action: replace_manual_duplication

- control_id: MAINT-VERSION-CONSISTENCY
  current_source: scripts/validate-version-consistency.mjs
  current_enforcement: normal CI
  real_error_prevented: active documentation and package version drift
  personal_project_value: useful
  runtime_blocking_effect: none
  classification: MAINTENANCE_CORRECTNESS_REQUIRED
  action: retain
```

## Useful nonblocking diagnostics

```yaml
- control_id: DIAG-REAL-ELEMENTOR-EVIDENCE
  current_source: scripts/validate-real-elementor-execution-evidence.mjs
  current_enforcement: truthfulness diagnostic and template validation
  real_error_prevented: unsupported real-execution or production-readiness claims
  personal_project_value: useful
  runtime_blocking_effect: does not block ordinary bounded Builder work without a production claim
  classification: USEFUL_NONBLOCKING_DIAGNOSTIC
  action: retain_nonblocking

- control_id: DIAG-CE-PG-BUILDER-SMOKE
  current_source: scripts/smoke-ce-project-gate-builder.mjs
  current_enforcement: fixture-based CI smoke
  real_error_prevented: local adapter or input-boundary regressions are missed
  personal_project_value: useful
  runtime_blocking_effect: none for a previously accepted local package
  classification: USEFUL_NONBLOCKING_DIAGNOSTIC
  action: retain_and_label_fixture_based
```

## Removed industrial or security-only controls

```yaml
- control_id: GOV-EXACT-HEAD-EXTERNAL
  current_source: deleted .github/workflows/governance-exact-head-evidence.yml
  current_enforcement: formerly blocking external workflow evidence
  real_error_prevented: no direct Builder input, candidate, lineage, action, state or completion corruption
  personal_project_value: negligible
  runtime_blocking_effect: created authorization deadlock
  classification: INDUSTRIAL_GOVERNANCE_REMOVE
  action: delete_from_active_ci

- control_id: GOV-PR-INSPECTOR
  current_source: historical governance docs
  current_enforcement: formerly independent review requirement
  real_error_prevented: no direct runtime corruption beyond normal tests and owner review
  personal_project_value: negligible
  runtime_blocking_effect: external process dependency
  classification: INDUSTRIAL_GOVERNANCE_REMOVE
  action: remove_from_runtime_and_ci

- control_id: GOV-REVIEW-RECEIPTS
  current_source: governance and planning history
  current_enforcement: process evidence
  real_error_prevented: none in Builder output correctness
  personal_project_value: none
  runtime_blocking_effect: ceremony and stale evidence failures
  classification: INDUSTRIAL_GOVERNANCE_REMOVE
  action: historical_only

- control_id: GOV-MERGE-EVIDENCE
  current_source: historical governance adoption plan
  current_enforcement: owner merge and exact-main proof
  real_error_prevented: none in a normal Builder Run
  personal_project_value: none
  runtime_blocking_effect: unrelated repository process blocks runtime
  classification: INDUSTRIAL_GOVERNANCE_REMOVE
  action: retire

- control_id: SEC-SIGNATURE-ATTESTATION
  current_source: not implemented in lean runtime
  current_enforcement: none
  real_error_prevented: adversarial producer impersonation outside personal threat model
  personal_project_value: very_low
  runtime_blocking_effect: would add unavailable external authority
  classification: SECURITY_ONLY_REMOVE
  action: do_not_add

- control_id: SEC-PROVENANCE-CHAIN
  current_source: deep historical transaction expectations
  current_enforcement: no longer required per message
  real_error_prevented: adversarial provenance tampering, not ordinary functional continuity
  personal_project_value: low
  runtime_blocking_effect: excessive per-message metadata
  classification: SECURITY_ONLY_REMOVE
  action: keep_only_local_digest_and_deep_diagnostics
```

## Historical controls

```yaml
- control_id: HIST-GOVERNANCE-ADOPTION-PLAN
  current_source: planning/GOVERNANCE_ADOPTION_PLAN.yml
  current_enforcement: none
  real_error_prevented: historical record only
  personal_project_value: contextual
  runtime_blocking_effect: none
  classification: HISTORICAL_ONLY
  action: active_false_runtime_authority_false
```
