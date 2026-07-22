# EV4 Builder Assistant — Lean Personal Runtime

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
industrial_governance: removed_from_active_system
security_posture: minimal_nonblocking
independent_review_required: false
pr_inspector_required: false
exact_head_runtime_authority: false
builder_to_responsive: out_of_scope
production_ready: false
```

## Architecture

```text
builder-input.json
→ Lightweight Intake Inspector
→ accepted | blocked
→ Builder Action Batch
→ explicit user confirmation
→ Checkpoint + Session State
→ optional Pause / Resume validation
→ Repair when required
→ lightweight Completion validation
→ bounded Builder completion
```

The runtime is local and file-based. It does not use a service, server, database, worker, event bus, PKI, signature system, or generalized workflow engine.

## Runtime Authority

A normal Builder Run is authorized only by:

1. valid Builder Context input;
2. selected candidate continuity;
3. decision-lineage continuity;
4. valid Action Batch semantics;
5. active confirmation binding;
6. Session State consistency;
7. Checkpoint consistency;
8. unresolved blocker preservation;
9. valid Completion conditions.

PR state, CI state, Exact-Head evidence, PR Inspector, independent review, immutable review bundles, governance receipts, merge evidence, external attestation, and repository commit identity are repository-process data. They do not authorize or block an ordinary Builder project Run.

## Lightweight Inspector

```bash
node scripts/builder-inspector.mjs intake builder-input.json builder-intake-result.json
node scripts/builder-inspector.mjs verify-capsule builder-input.json builder-intake-result.json
node scripts/builder-inspector.mjs resume builder-intake-result.json session-state.json checkpoint.json resume-result.json
node scripts/builder-inspector.mjs completion builder-intake-result.json session-state.json checkpoint.json completion-status.json completion-gate.json completion-result.json
```

### Intake

Intake parses exact source bytes, validates Schema, semantic and cross-field rules, decision lineage, candidate lock, `input_authorization`, and the canonical package digest. It writes a compact result atomically and never modifies the source.

### Resume

Resume requires matching session, package digest, candidate, Checkpoint, Session State, blocker set, and a legal prior target. `استارت` never initializes a Run.

### Completion

Completion is legal only in `APPROVED_HANDOFF_MODE / COMPLETED`, with a valid final Checkpoint, completed required actions, zero unresolved blockers, matching package/candidate identity, valid Completion Status, and valid Completion Gate.

A request for a completion report, detached success prose, or file presence is not proof.

## State Machine

The machine-readable authority is `runtime/state-transitions.v1.json`.

Key invariants:

- every active state has an entry and exit;
- intake, fresh-image, evidence, and correction states cannot jump directly to Completion;
- repeated `شروع` preserves the current Run;
- `استارت` only resumes an initialized PAUSED state;
- unresolved blockers cannot disappear silently;
- only successful Completion validation reaches `COMPLETED`.

## Action Metadata

Ordinary actions carry execution-critical fields only. Numeric values require `unit` and `value_source`; class actions retain class scope. High-risk or difficult-to-reverse actions additionally require rationale, reversibility, safety decision, evidence requirements, confirmation scope, and forbidden changes.

## Deep Runtime Transaction

The full transaction remains available for:

- CI regression;
- deep consistency diagnosis;
- fixture mutation testing.

It is not required for every chat message or every Action Batch.

## Deterministic Project Pack

Canonical inputs:

```text
runtime/project-pack-source-map.v1.json
runtime/project-pack/**
```

Generated output:

```text
dist/chatgpt-project/**
```

Verification and publication:

```bash
node scripts/build-project-pack.mjs --verify
node scripts/build-project-pack.mjs --write
```

The generator stages output in a temporary directory, validates limits and forbidden stale-governance patterns, records source/output hashes, and publishes atomically. Generated files are non-authoritative and hand edits fail verification.

## Repository Maintenance

Normal CI answers whether Builder contracts and behavior are functionally correct. It retains syntax/Schema/semantic/state/intake/action/confirmation/checkpoint/repair/completion/package/regression checks.

It does not answer whether an independent industrial governance process has formally authorized Merge.

## CE → Project Gate → Builder

The repository owns a fixture-based smoke chain:

```text
CE executable-package fixture
→ Builder-owned CE contract gate and adapter
→ Project Gate-style builder-input fixture
→ Lightweight Intake Inspector
→ accepted | truthfully blocked
```

Receipt-only input remains non-semantic. A real external artifact should later be tested through the same Inspector command without manual nested extraction.

## Owner Local Pilot

1. Obtain `builder-input.json` from Project Gate.
2. Run Inspector intake.
3. Upload the input and accepted capsule to the ChatGPT Project.
4. Execute one small real Action Batch.
5. Confirm it explicitly.
6. Create a Checkpoint.
7. Pause and Resume once.
8. Run Completion validation only when the bounded Builder build is complete.

## Scope Boundary

This architecture does not implement Builder → Responsive, Responsive completion, production deployment, real Elementor automation, or production readiness.
