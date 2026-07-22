# REPOSITORY_GUIDE — EV4 Builder Assistant

Version: 0.3.6
Status: personal_correctness_inspector_added
Date: 2026-07-22

## Purpose

This repository is the middle execution system between CE/Project Gate output and later Responsive work. It executes approved Builder decisions and retains evidence; it does not choose architecture.

## Personal Runtime Flow

```text
builder-input.json
→ scripts/builder-inspector.mjs intake
→ builder-intake-authorization.json
→ APPROVED_HANDOFF_MODE / BUILD_ACTIVE
→ Action Batch
→ evidence/confirmation
→ Checkpoint + personal state capsule
→ local resume validation when changing chat
→ local completion validation
→ builder_completion_only
```

The local Inspector executes official Schema, semantic, cross-field, lineage, state, Checkpoint, and completion validators. ChatGPT Project instructions only compare supplied artifacts and must not claim system-level validation.

## Authorities

```text
Builder Context: schemas/builder-context-package.schema.json + scripts/validate-package.mjs
Decision lineage: scripts/validate-builder-context-decision-lineage.mjs
Personal intake: schemas/builder-intake-authorization.schema.json
Personal state: schemas/builder-personal-state-capsule.schema.json
Personal resume: schemas/builder-resume-authorization.schema.json
Personal completion: schemas/builder-completion-authorization.schema.json
Deep transaction: scripts/validate-builder-runtime-transaction.mjs
```

`input_authorization` remains compatibility-optional in the public package. The accepted intake capsule is mandatory only at the personal operator entrypoint, so public package compatibility is preserved without two personal authorization truths.

## State

The personal state capsule binds exact input bytes, canonical package digest, candidate, Session State bytes, Checkpoint bytes, parent state, blockers, and transition event. A small static table rejects illegal sequence jumps. It is not a generalized workflow engine.

## Project Pack

`project-pack/source-map.v2.json` contains the canonical deployable-pack source sections. `scripts/build-project-pack.mjs --write` renders through a temporary directory, verifies two byte-identical builds, and publishes atomically. Tracked `dist/chatgpt-project/` is generated and non-authoritative; `npm run build:project-pack` rejects drift or hand edits.

## Cross-Repository Boundary

Project Gate publishes standalone `builder-input.json` and a separate non-semantic Receipt at its pinned CE/Builder revisions. Builder does not weaken acceptance for moving heads. Current-head compatibility requires a later Project Gate repin or real artifact smoke check.

## Completion Boundary

The personal flow may end at Builder completion. Builder→Responsive is not implemented by this repair. `production_ready` remains false.
