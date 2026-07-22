# AGENTS.md

## Repository Profile

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
industrial_governance: removed_from_active_system
security_posture: minimal_nonblocking
production_ready: false
```

## Read First

1. `runtime/personal-runtime-authority.v1.json`
2. `runtime/state-transitions.v1.json`
3. `scripts/lib/runtime-transaction-engine.mjs`
4. `runtime/completion-scopes.v1.json`
5. `PROJECT_INSTRUCTIONS.md`
6. affected Schemas, semantic validators and fixtures
7. `scripts/validate.mjs`

## Canonical Runtime Transaction Authority

`builder-input.json` parsed as `ev4-builder-context-package@1.0.0` is the canonical semantic and identity source. `builder-intake-result.json` is derived evidence and is never sufficient without re-verifying the actual Builder Input.

Critical Resume and Completion transitions are authorized and applied only by `scripts/lib/runtime-transaction-engine.mjs`. The Engine interprets `runtime/state-transitions.v1.json`; validators may check carrier integrity but must not maintain a competing transition matrix.

- `شروع` begins fresh intake only when no active Run exists.
- repeated `شروع` preserves the current session, checkpoint, Ledger and unresolved blockers.
- `استارت` resumes only a real prior `PAUSED` state after Builder Input re-verification.
- Completion starts only from `APPROVED_HANDOFF_MODE / BUILD_ACTIVE`; the Engine generates terminal carriers.
- caller-authored `COMPLETED` Session State or Checkpoint is not a valid Completion input.

## Action and Completion Authority

- `ev4-builder-action-ledger@1.0.0` owns the complete Action universe for the bounded Run.
- `expected_batch_ids` and `expected_required_action_ids` prevent omission from satisfying Completion.
- Checkpoint action summaries must reconcile exactly with the Ledger and its digest.
- `runtime/completion-scopes.v1.json` defines supported Builder completion scopes.
- Completion Gate v0.2 binds session, Builder Input, candidate, predecessor Checkpoint, Action Ledger, Completion Scope and evidence ledger.
- accepted transition outputs publish atomically as one directory transaction.

## Active Runtime Boundary

A normal Builder Run may depend only on valid Builder Input, candidate and decision-lineage continuity, Action semantics, confirmation binding, Session State, Checkpoint, Action Ledger, blocker preservation, Completion Scope and Completion Gate correctness.

Do not add PR status, Exact-Head evidence, PR Inspector, independent review, governance receipts, merge evidence, reviewer identity, external attestation or repository commit identity as runtime authorization.

## Change Policy

- Keep changes focused and functionally justified.
- Preserve candidate identity, decision lineage, class scope, confirmation, Checkpoint, evidence and Completion boundaries.
- Do not implement Builder → Responsive or production deployment.
- Do not add services, databases, event buses, generalized workflow engines, PKI, signatures or attestation chains.
- Historical governance material is non-authoritative and must not enter `dist/chatgpt-project`.

## Validation

```bash
npm ci
npm run validate:version-consistency
npm run validate:schema-registry
npm run validate:builder-context-package
npm run validate:cross-field
npm run validate:builder-lineage-sequence
npm run build:project-pack
npm run validate
```

Deep runtime transaction validation remains a CI regression/diagnostic tool; it is not required per Builder message or Action Batch.

## Delivery

Use one feature branch and one focused PR. Do not merge or deploy without owner action. Do not claim validation or CI success without evidence.
