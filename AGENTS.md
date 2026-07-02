# AGENTS.md

## Scope

These instructions apply to the whole repository unless a closer nested `AGENTS.md` or `AGENTS.override.md` overrides them.

## Role

`EV4-Builder-Assistant-Repo` is the interactive Elementor execution assistant. It consumes only Builder-ready input, executes small confirmed actions, maintains state and checkpoints, and retains build evidence for Responsive review.

It does not choose architecture or implementation strategy.

## Read First

1. `README.md`
2. `STATUS.md`
3. `PROJECT_INSTRUCTIONS.md`
4. `core/MASTER_PROMPT.md`
5. `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md`
6. relevant protocols, schemas, validators, fixtures, and tests

Current executable contracts take precedence over historical patch notes or proposals.

## Project Gate Handoff

```text
CE output → EV4 Project Gate → Builder Input Package
Builder output and evidence → EV4 Project Gate → Responsive Input Package
```

Project Gate integration is documented, but its verifier and UI are not implemented yet. It must not replace Builder contracts, invent execution evidence, or redesign upstream work.

## Hard Boundaries

Do not decide geometry, anchors, connector strategy, overlays, z-index, asset policy, responsive strategy, interaction, Dynamic Loop, accessibility completion, class scope without evidence, or production readiness.

If strategy or evidence is missing, reject or enter correction rather than guess.

## Change Rules

- Preserve public contracts unless a breaking change is approved.
- Keep version markers synchronized across all version-bearing files.
- Update affected schemas, validators, protocols, fixtures, and tests together.
- Preserve selected-candidate identity, class intent, checkpoints, and valid evidence.
- Add valid, invalid, cross-field, and regression cases for changed behavior.
- Avoid unrelated refactoring and never weaken gates merely to make a fixture pass.

## Validation

Primary validation:

```bash
npm run validate
```

Useful focused checks:

```bash
npm run validate:version-consistency
npm run validate:schema-registry
npm run build:project-pack
npm run validate:builder-context-package
npm run validate:cross-field
npm run validate:reference-paradigm
```

Report exactly which commands ran. Do not claim full validation from a partial subset.

## Evidence and UX

Real Elementor claims require retained evidence. A package or screenshot proves only what it directly supports. Use `insufficient_evidence` or correction instead of guessing.

Normal Builder instructions are concise Persian. Keep hashes, schema details, and diagnostics hidden unless technical detail is requested.

## Pull Requests

State the behavior or contract changed, affected files and fixtures, version impact, validation executed, and remaining evidence gaps.
