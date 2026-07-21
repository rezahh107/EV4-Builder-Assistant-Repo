# EV4 Builder Assistant Repo

Status: Builder runtime active. External Project Gate capability is available at bounded documented scopes. Builder-local Project Gate runtime integration is not implemented.

## Role

Builder executes proven Elementor actions. Architect owns architecture. CE owns implementation-strategy proof. Responsive owns post-build responsive validation.

## Governance Authorities

Repository governance adoption is defined by these non-overlapping authorities:

- `governance/AI_AUTHORITY_POLICY.yml` — AI technical authority, evidence authority, security profile, and prohibited human technical gates.
- `planning/CAPABILITY_MEMORY.yml` — canonical capability IDs and lifecycle memory, including deferred capabilities that must not be silently deleted.
- `planning/GOVERNANCE_ADOPTION_PLAN.yml` — current scope revision, committed scope, dependencies, completion evidence, and progress gates.
- `STATUS.md` — concise mutable repository status; it must not duplicate detailed capability lifecycle or scope calculations.

Live `main`, exact commit/PR evidence, validators, tests, CI, and independent exact-head review remain the evidence sources for implementation claims. These authority files do not prove their own enforcement.

## Current Project Gate Boundary

The external `rezahh107/EV4-Project-Gate` repository currently provides, at documented pinned scopes:

- a reusable deterministic verifier;
- guarded CE→Builder orchestration;
- standalone `builder-input.json` publication;
- a separate `project-gate-c2b-receipt.json` audit artifact;
- an initial local operator UI.

The intended personal operator flow is:

```text
CE output
→ ce-project-gate.json
→ EV4-Project-Gate / ce-to-builder
→ builder-input.json
→ Builder Assistant
```

After an accepted transition, only `builder-input.json` is supplied as Builder semantic input. `project-gate-c2b-receipt.json` remains separate Project Gate audit evidence and must not be merged into Builder input.

Builder receives only executable-ready input with a locked selected candidate, explicit implementation strategy, structured confirmation, a safe first batch, explicit class scope, and no blocking dependency.

Builder does not choose geometry, anchors, connector strategy, overlay policy, responsive strategy, interaction, Dynamic Loop, accessibility completion, or production readiness.

This repository remains authoritative for the Builder Context contract, CE→Builder Contract Gate, CE→Builder Adapter, package normalization, semantic validation, runtime protocols, fixtures, execution behavior, and build evidence. Project Gate may execute those official Builder-owned tools; it does not replace Builder contracts, silently repair upstream data, or invent build evidence.

The current Builder-owned Contract Gate and Adapter also support a direct controlled CE→Builder path. That path is technically supported but distinct from the canonical personal operator path through the external Project Gate. External Project Gate implementation does not imply that this repository contains a native Project Gate runtime, embedded verifier, or operator UI.

```yaml
version: 0.3.6
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

## Related Repositories

- `rezahh107/EV4-Project-Gate`
- `rezahh107/EV4-Architect-Repo`
- `rezahh107/EV4-Constructability-Engineer-Repo`
- `rezahh107/EV4-Responsive-Architect`
