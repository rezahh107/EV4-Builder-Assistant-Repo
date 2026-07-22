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

## Startup Boundary

The canonical personal input is `builder-input.json` parsed as `ev4-builder-context-package@1.0.0`.

- `شروع` begins fresh intake only when no active Run exists.
- repeated `شروع` preserves the current session, checkpoint and unresolved blockers.
- `استارت` resumes only a real prior PAUSED state and cannot fabricate a Run.
- receipt-only input and raw Project Gate envelopes remain non-semantic.

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

## Temporary Shared UX/UI Policy

For Builder execution involving UX/UI obligations, read and silently apply:

```text
policies/EV4_TEMP_CROSS_REPO_UX_UI_STANDARDS_POLICY_r001.md
```

Pinned identity:

```yaml
policy_id: EV4-TEMP-CROSS-REPO-UX-UI-STANDARDS-POLICY-r001
revision: r001
sha256: fd023d9b815b6d525539d595700a1768245ae83cca401c71fb61ba22d4f76483
git_blob_sha: b52182c54577189d1b7832199fb699ee67f7d7fb
```

Apply only Rule IDs already relevant to the accepted Builder-ready strategy and current action. Preserve required states, semantics, focus behavior, responsive intent, recovery behavior, tokens, and evidence obligations without selecting a competing architecture or implementation strategy.

If an applicable `HARD_GATE` or `REQUIRED_DEFAULT` cannot be implemented from the accepted package, stop that bounded action and return the issue to the correct upstream owner. `HEURISTIC` and `PREFERRED_DEFAULT` rules do not independently authorize changes or block execution. Do not claim runtime behavior, accessibility completion, or standards conformance without the required observed evidence.

Do not add unsupported fields, wrapper Artifacts, Builder states, or action outputs solely to carry this policy. This temporary policy is supplemental and becomes historical only after an explicitly adopted, pinned Kernel replacement exists.
