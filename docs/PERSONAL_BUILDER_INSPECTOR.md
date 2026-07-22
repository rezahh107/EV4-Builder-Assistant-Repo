# Personal Builder Inspector

Version: 1.0.0  
Status: Draft PR implementation  
Scope: controlled single-operator Builder use

## Purpose

The ChatGPT Project cannot execute repository Node/AJV/Python validators. The personal workflow therefore uses a small local Inspector and supplies its result to the conversation:

```text
builder-input.json
→ scripts/builder-inspector.mjs intake
→ builder-intake-authorization.json
→ ChatGPT Project
```

The local Inspector performs system-level validation. The model performs prompt-level comparison of supplied artifacts only and must never claim it executed validators or recomputed hashes.

## Intake

```bash
node scripts/builder-inspector.mjs intake \
  --input builder-input.json \
  --output builder-intake-authorization.json
```

The accepted capsule binds exact input bytes, canonical package digest, Builder Context Schema, selected candidate, validator identity, validation profile, and initialized session.

For the canonical personal path, `builder-input.json` alone cannot authorize `APPROVED_HANDOFF_MODE / BUILD_ACTIVE`. Missing, blocked, stale, edited, or mismatched authorization keeps `START_INTAKE_MODE / EVIDENCE_REQUIRED` and permits no `BATCH-001`.

Verify an existing capsule:

```bash
node scripts/builder-inspector.mjs verify-capsule \
  --input builder-input.json \
  --capsule builder-intake-authorization.json
```

`project-gate-c2b-receipt.json` remains optional non-semantic audit evidence. Receipt-only input and raw Project Gate/CE envelopes are blocked. Manual nested extraction is forbidden.

## State Snapshot and Resume

A personal state capsule binds exact intake authorization, Session State bytes, Checkpoint bytes, package digest, selected candidate, blocker set, parent state, and transition event.

Create a state snapshot:

```bash
node scripts/builder-inspector.mjs snapshot \
  --input builder-input.json \
  --capsule builder-intake-authorization.json \
  --session-state session-state.json \
  --checkpoint checkpoint.json \
  --event batch_emitted \
  --previous-state-capsule previous-state.json \
  --output builder-personal-state.json
```

Authorize resume:

```bash
node scripts/builder-inspector.mjs resume \
  --input builder-input.json \
  --capsule builder-intake-authorization.json \
  --state-capsule builder-personal-state.json \
  --session-state session-state.json \
  --checkpoint checkpoint.json \
  --output builder-resume-authorization.json
```

`استارت` cannot initialize a new session. Another session, input bytes, package digest, candidate, stale carrier, illegal transition, or dropped unresolved blocker blocks resume.

## Transition Scope

The Inspector uses a static table for the active personal flow. It is not a generalized workflow engine. It prevents two individually valid snapshots from representing an illegal sequence and blocks direct completion jumps without accepted completion validation.

## Completion

```bash
node scripts/builder-inspector.mjs completion \
  --input builder-input.json \
  --capsule builder-intake-authorization.json \
  --previous-state-capsule previous-state.json \
  --state-capsule final-state.json \
  --session-state final-session-state.json \
  --checkpoint final-checkpoint.json \
  --completion-status completion-status.json \
  --completion-gate completion-gate.json \
  --output builder-completion-authorization.json
```

Completion requires final `COMPLETED` Session State, valid final Checkpoint, matching identities, required actions confirmed, no unresolved blockers, and valid Completion Status/Gate.

Accepted scope is only:

```yaml
completion_scope: builder_completion_only
responsive_complete: false
production_ready: false
```

## Deep Runtime Transaction

The existing full Runtime Transaction and mutation suite remain CI/deep-diagnosis controls. They are not required on every conversation turn. The lightweight personal checks are intake, resume, and completion.

## Project Pack

`project-pack/source-map.v2.json` contains the canonical deployable source sections. `scripts/build-project-pack.mjs --write` renders through temporary directories, requires two byte-identical builds, validates the output set, records source/output hashes, and publishes atomically. Tracked `dist/chatgpt-project/**` is generated and non-authoritative.

## Boundaries

This work does not implement Builder→Responsive, Responsive completion, deployment proof, or production readiness. It does not add signatures, PKI, RBAC, database state, remote services, distributed locking, or mandatory reviewers.
