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
3. `PROJECT_INSTRUCTIONS.md`
4. `core/MODE_STATE_MATRIX.md`
5. `schemas/**`
6. relevant semantic validators and fixtures
7. `scripts/validate.mjs`

## Active Runtime Authority

A normal Builder Run may depend only on:

- valid Builder Context input;
- selected candidate continuity;
- decision lineage continuity;
- allowed Action Batch semantics;
- active confirmation binding;
- Session State and Checkpoint consistency;
- unresolved blocker preservation;
- valid Completion conditions.

Do not add PR status, Exact-Head evidence, PR Inspector, independent review, governance receipts, merge evidence, reviewer identity, external attestation, or repository commit identity as runtime authorization.

## State Rules

- `COMPLETED` is legal only in `APPROVED_HANDOFF_MODE`.
- A completion report request is not a completion trigger.
- `شروع` is idempotent when a Run already exists.
- `استارت` resumes only a real prior PAUSED Session State.
- Intake, evidence, correction, or fresh-image states cannot jump directly to Completion.
- Unresolved blockers may not disappear silently.

## Change Policy

- Keep changes focused and functionally justified.
- Preserve candidate identity, decision lineage, class scope, confirmation, Checkpoint, evidence and Completion boundaries.
- Do not implement Builder → Responsive or production deployment.
- Do not add services, databases, event buses, generalized workflow engines, PKI, signatures or attestation chains.
- Historical governance material is non-authoritative and must not enter `dist/chatgpt-project`.

## Validation

Run applicable checks before PR readiness:

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

Use a feature branch and one focused PR. Do not merge or deploy without owner action. Do not claim validation or CI success without evidence.
