# EV4 Builder Assistant Repo

Status: Builder runtime active. Deterministic Builder conversation bootstrap is implemented on a feature branch pending exact-head CI and fresh independent review. Production readiness remains false.

## Role

Builder executes proven Elementor actions. Architect owns architecture. CE owns implementation-strategy proof. Responsive owns post-build responsive validation.

## Quick Start

```text
شروع
→ upload `builder-input.json`
→ validate parsed content as `ev4-builder-context-package@1.0.0`
→ enter `APPROVED_HANDOFF_MODE / BUILD_ACTIVE` only when approved
→ emit the first authorized Builder batch
```

The filename is only an operator hint; semantic acceptance depends on parsed content, official schema/cross-field validation, decision lineage, and `input_authorization`. `project-gate-c2b-receipt.json` is optional Project Gate audit evidence, not Builder semantic input. Screenshot-only fallback is not the canonical path. No Builder batch or Elementor instruction is permitted before validation and authorization.

Fresh intake uses `شروع`. Resume uses `استارت` and requires a valid initialized checkpoint or state capsule. Repeated `شروع` preserves checkpoints, initialized state, and unresolved evidence. Repository-maintenance requests do not activate a user-facing Builder session merely because they contain `شروع`.

## Canonical Bootstrap Contract

```text
manifests/builder-conversation-bootstrap.v1.json
schemas/builder-conversation-bootstrap.v1.schema.json
scripts/validate-builder-bootstrap.mjs
```

The canonical personal operator flow is:

```text
CE output
→ ce-project-gate.json
→ EV4-Project-Gate / ce-to-builder
→ builder-input.json
→ Builder Assistant
```

Do not manually extract nested `result.output`, `downstream_artifact`, or Builder fields from `ce-project-gate.json`. The Builder-owned CE→Builder Contract Gate and Adapter remain preserved as an explicit technical direct path; they are not a silent default.

## Governance Authorities

Repository governance adoption is defined by these non-overlapping authorities:

- `governance/AI_AUTHORITY_POLICY.yml` — AI technical authority, evidence authority, security profile, and prohibited human technical gates.
- `planning/CAPABILITY_MEMORY.yml` — canonical capability IDs and lifecycle memory.
- `planning/GOVERNANCE_ADOPTION_PLAN.yml` — current scope revision, committed scope, dependencies, completion evidence, and progress gates.
- `STATUS.md` — concise mutable repository status.

Live `main`, exact commit/PR evidence, validators, tests, CI, and independent exact-head review remain the evidence sources for implementation claims.

## Current Project Gate Boundary

The external `rezahh107/EV4-Project-Gate` repository provides, at documented pinned scopes:

- a reusable deterministic verifier;
- guarded CE→Builder orchestration;
- standalone `builder-input.json` publication;
- a separate `project-gate-c2b-receipt.json` audit artifact;
- an initial local operator UI.

Builder remains authoritative for the Builder Context contract, CE→Builder Contract Gate, CE→Builder Adapter, package normalization, semantic validation, runtime protocols, fixtures, execution behavior, and build evidence.

The current Builder-owned Contract Gate and Adapter support a direct controlled CE→Builder path. That path is distinct from the canonical personal operator path and must never be silently invoked.

```yaml
version: 0.3.6
builder_conversation_bootstrap:
  contract: ev4-builder-conversation-bootstrap@1.0.0
  fresh_trigger: شروع
  resume_trigger: استارت
  canonical_input_schema: ev4-builder-context-package@1.0.0
  filename_hint: builder-input.json
  receipt_is_semantic_input: false
  attachment_first: true
  filename_only_acceptance: false
  production_ready: false
external_project_gate:
  verifier: implemented_at_documented_scope
  ce_to_builder_transition: implemented_guarded
  standalone_builder_input: implemented
  operator_ui: implemented_initial
builder_repository:
  ce_to_builder_contract_gate: active
  ce_to_builder_adapter: active
  local_project_gate_runtime: not_implemented
operator_path:
  canonical_personal_handoff_source: project_gate_builder_input
  direct_builder_owned_path: technically_supported_controlled_path
evidence:
  real_non_synthetic_ce_to_builder_handoff: insufficient_evidence
  real_elementor_execution: insufficient_evidence
  builder_to_responsive_formal_export: not_implemented
  production_ready: false
```

## Validation

```bash
node scripts/validate-builder-bootstrap.mjs
npm run build:project-pack
npm run validate
```

## Related Repositories

- `rezahh107/EV4-Project-Gate`
- `rezahh107/EV4-Architect-Repo`
- `rezahh107/EV4-Constructability-Engineer-Repo`
- `rezahh107/EV4-Responsive-Architect`
