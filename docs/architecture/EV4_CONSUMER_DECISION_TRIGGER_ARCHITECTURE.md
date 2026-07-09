# EV4 Consumer Decision Trigger Architecture — Builder Adoption Baseline

Status: Wave 0 adoption baseline  
Consumer repository: `EV4-Builder-Assistant-Repo`  
Canonical upstream source: `EV4-Decision-Kernel/docs/architecture/EV4_CONSUMER_DECISION_TRIGGER_ARCHITECTURE.md`

## Purpose

This document records Builder adoption of the EV4 Consumer Decision Trigger Architecture as an upstream decision-gate contract. Builder consumes locked upstream decisions and executes evidence-bound Elementor actions; it does not gain new authority to make design decisions, resolve Kernel escape routes, or claim Kernel enforcement from this adoption baseline alone.

## Wave Boundary

This repository is adopting Wave 0 only.

Allowed Wave 0 claims:

- `architecture_document_added`
- `upstream_contract_adopted`

Explicit non-claims for this baseline:

- `escape_routes_audited`
- `schema_enforced`
- `validator_backed`
- `fixture_tested`
- `ci_enforced`
- `sequence_ci_enforced`
- `runtime_monitor_enforced`
- `os_harness_enforced`
- `downstream_contract_enforced`
- `builder_execution_proven`
- `production_ready`

## Builder Boundary

Builder executes locked decisions supplied through Builder-ready packages and retained evidence. If upstream strategy, carriers, or evidence are missing, Builder must reject, request correction, or remain in an evidence-required state rather than inventing geometry, anchors, connector strategy, overlays, z-index, asset policy, responsive strategy, interactions, Dynamic Loop behavior, accessibility completion, class scope, or production readiness.

## Wave 0 State Carrier

The Wave 0 state carrier for Builder is:

```text
planning/DECISION_ESCAPE_ROUTES.yml
```

It begins with `consumer_repo_evidence_state: expected_unverified` and an empty `records` array. That initial state intentionally does not claim audit completion, enforcement, Builder execution proof, or production readiness.

The companion baseline schema is:

```text
planning/decision-escape-routes.schema.json
```

The schema describes the Wave 0 state shape and forbidden authored fields only. Its presence is not a claim that CI, runtime, fixture, validator, downstream, or OS/harness enforcement has been implemented.
