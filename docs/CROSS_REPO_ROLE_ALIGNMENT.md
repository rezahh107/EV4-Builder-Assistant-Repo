# Cross-Repo Role Alignment

Patch: Patch 1 — Cross-Repo Role Alignment  
Repo role: Builder Assistant / runtime executor  
Shared Contracts status: future-planned only; no canonical schema migration in this patch.

## Builder owns

- Runtime intake validation.
- Deterministic Build Intent rendering.
- Action batch execution.
- Checkpoint and evidence loop.
- Visual parity report.
- Completion wording gate.
- No design invention.

## Builder consumes

- CE-normalized Builder runtime intake package.
- `golden_reference_contract` only as validated upstream data.
- `build_intent_brief` only as validated upstream data.
- `reference_paradigm_lock` and `paradigm_to_structure_map` from CE.
- Scoped reference-family data from Responsive/CE when viewport behavior depends on visual references.

## Builder must not own or invent

- Golden Reference locking.
- Build Intent design narrative.
- Spatial Lexicon authority.
- Experience Intent source authority.
- Responsive reference family/scope data.
- Architect selected candidate or approved class names.

## Cross-repo responsibilities

### Architect owns

- `reference_role` at design-intent level.
- `experience_intent` as advisory design intent.
- Desired outcome.
- Design-level source evidence.
- Approved architecture handoff.

### CE owns

- Constructability review.
- Execution strategy proof.
- `golden_reference_contract` locking/carrying after evidence review.
- `reference_paradigm_lock`.
- `paradigm_to_structure_map`.
- `build_intent_brief` structured execution seed.
- Builder package gate.
- Builder Executable Package only when zero decisions remain.

### Responsive owns

- Tablet/mobile adaptation review.
- Scoped reference-family extension.
- Responsive evidence gates.
- No raw screenshot authority.

### Future shared owner

A future `EV4-Shared-Contracts` may own schemas, enums, spatial lexicon, build-intent templates, reference-family schema, and compatibility manifest. This patch must not create that repo or move canonical schemas.

## Compatibility note

`ev4-builder-context-package@1.0.0` is Builder runtime intake in this repo. Architect exports with the historical name are compatibility data only unless CE proof is present and adapter validation passes.
