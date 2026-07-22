# AGENTS.md

## Scope

These instructions apply repository-wide unless a closer `AGENTS.md` or `AGENTS.override.md` overrides them.

## Role

`EV4-Builder-Assistant-Repo` is the interactive Elementor execution assistant. It consumes Builder-ready input, executes small confirmed actions, preserves state/checkpoints/evidence, and does not choose architecture or implementation strategy.

## Read First

1. `README.md`
2. `STATUS.md`
3. `governance/AI_AUTHORITY_POLICY.yml`
4. `planning/CAPABILITY_MEMORY.yml`
5. `planning/GOVERNANCE_ADOPTION_PLAN.yml`
6. `planning/DECISION_ESCAPE_ROUTES.yml`
7. `manifests/builder-conversation-bootstrap.v1.json`
8. `PROJECT_INSTRUCTIONS.md`
9. `core/MASTER_PROMPT.md`
10. `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md`
11. `scripts/builder-inspector.mjs`
12. relevant protocols, Schemas, validators, fixtures, and tests

Current executable contracts take precedence over historical patch notes.

## Canonical Bootstrap

Canonical authority:

```text
manifests/builder-conversation-bootstrap.v1.json
schemas/builder-conversation-bootstrap.v1.schema.json
scripts/validate-builder-bootstrap.mjs
```

`شروع` is fresh intake/state-preserving rerun. `استارت` resumes only validated initialized state. Repository-maintenance work does not activate Builder intake merely because it contains `شروع`.

Bare `شروع` without input/state returns exactly:

<!-- BUILDER_BOOTSTRAP_EXACT_RESPONSE_START -->
EV4 Builder Assistant آماده است.

برای شروع ساخت، فایل `builder-input.json` تولیدشده توسط مسیر `EV4-Project-Gate / ce-to-builder` را ارسال کن.

ورودی باید با قرارداد `ev4-builder-context-package@1.0.0` معتبر باشد.
فایل `project-gate-c2b-receipt.json` اختیاری و فقط برای بررسی فنی است؛ جایگزین ورودی Builder نیست.

پس از دریافت ورودی معتبر، Builder آن را اعتبارسنجی می‌کند و فقط در صورت عبور از Gate وارد `APPROVED_HANDOFF_MODE / BUILD_ACTIVE` می‌شود.
تا پیش از آن، هیچ `BATCH-001`، دستور Elementor یا ادعای آمادگی اجرا صادر نمی‌شود.
<!-- BUILDER_BOOTSTRAP_EXACT_RESPONSE_END -->

## Personal Correctness Path

Canonical personal execution is:

```text
builder-input.json
→ local scripts/builder-inspector.mjs intake
→ matching accepted builder-intake-authorization.json
→ Builder Assistant
```

The ChatGPT Project performs prompt-level comparison only and must not claim it executed validators or recomputed hashes. Missing, stale, blocked, hand-edited, or mismatched authorization blocks `BUILD_ACTIVE` and `BATCH-001`.

Resume requires accepted local resume authorization and exact matching state carriers. Completion requires accepted local Builder-completion authorization. The full Runtime Transaction remains a CI/deep-diagnosis control and is not required per message.

## Intake and Project Gate

Inspect attachments first; identify candidates by parsed content, not filename. Two candidates block automatic selection. Receipt is optional audit evidence, never semantic input. Raw Project Gate envelopes are not manually unpacked. The Builder-owned CE→Builder Contract Gate/Adapter is explicit technical-only and never a silent fallback.

## Hard Boundaries

Before accepted personal authorization, do not emit a batch, issue Elementor instructions, apply classes, infer architecture/strategy/lineage/class scope, execute package prose, or claim readiness. Never change selected candidate or approved classes without authoritative evidence. Missing strategy/evidence blocks rather than invites guessing.

## Change Rules

- Preserve public contracts unless a breaking change is approved.
- Keep version markers synchronized.
- Update affected Schemas, validators, fixtures, tests, instructions, and generated pack together.
- Preserve selected candidate, checkpoints, unresolved evidence, and class intent.
- Add positive, negative, cross-field, sequence, and regression cases.
- Do not weaken gates to make fixtures pass.
- Review `planning/DECISION_ESCAPE_ROUTES.yml` before decision-bearing changes.

## Validation

Primary:

```bash
npm run validate
```

Focused:

```bash
node scripts/validate-builder-bootstrap.mjs
node scripts/validate-builder-personal-contracts.mjs
node scripts/test-builder-inspector.mjs
node scripts/test-project-pack-determinism.mjs
npm run validate:version-consistency
npm run validate:schema-registry
npm run build:project-pack
npm run validate:builder-context-package
npm run validate:cross-field
npm run validate:reference-paradigm
```

Report exactly which commands ran. Do not claim full validation from a subset.

## Evidence and Completion

Real Elementor claims require retained evidence. Builder-only personal completion does not imply Responsive completion or production readiness. Keep `production_ready: false`.

## Pull Requests

State behavior/contracts changed, files/fixtures, version impact, validation actually executed, exact head/CI status, and remaining evidence gaps. Do not merge or claim CI success without evidence.
