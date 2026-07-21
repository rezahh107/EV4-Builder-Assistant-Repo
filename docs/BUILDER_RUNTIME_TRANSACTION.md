# Builder Runtime Transaction Enforcement

Status: validation-only enforcement
Public contract version impact: none
Canonical validator: `scripts/validate-builder-runtime-transaction.mjs`

## Purpose

This document records the executable authority map for the Builder transaction. It does not add architecture, Constructability Engineer, Kernel, Responsive, or production authority to Builder. It composes existing Builder carriers into one fail-closed validation transaction so that a valid individual file cannot compensate for an invalid required stage.

The supported input paths remain:

```text
Project Gate builder-input.json
  -> Builder-owned semantic validation
  -> derived input authorization

controlled CE package
  -> CE-to-Builder Contract Gate
  -> Builder Adapter
  -> the same Builder-owned semantic validation
  -> derived input authorization
```

`project-gate-c2b-receipt.json` remains separate audit evidence and is never semantic input.

## Executable state machine

| State | Owning module / authority | Input carrier | Required predecessor | Authorization predicate | Output carrier | Failure state | Repair owner |
|---|---|---|---|---|---|---|---|
| Source discovery | Project Gate operator path or controlled Builder-owned path | exact captured source bytes | none | exactly one semantic candidate; receipt paths separate | captured source identity | `blocked_invalid_source` | upstream operator / CE |
| Source classification | Builder runtime transaction validator | input filename, parsed schema, provenance | captured bytes | `builder-input.json` or controlled CE source with verified provenance | classified source | `blocked_invalid_source` | upstream producer |
| Contract gate | `validate-ce-to-builder-contract-gate.mjs` for CE path; Builder schema/semantic validators for Project Gate path | CE package or Builder Context Package | classified source | strict shape, required carriers, no executable prose, no unresolved Builder decisions | gated input | `correction_required` | CE or Project Gate |
| Adapter / normalization | `normalize-ce-builder-executable-package.mjs` | gated CE package | CE gate pass | declared transforms only; source remains unmodified | Builder Context Package | `correction_required` | CE / Builder adapter maintainer |
| Builder semantic validation | Builder package validators plus runtime transaction validator | Builder Context Package | gated/normalized package | complete semantics, exact candidate lock, constructability carriers, lineage, confirmation structure | validated package identity | `blocked_invalid_package` | upstream producer |
| Derived input authorization | runtime transaction validator | complete validated package | semantic validation pass | authorization recomputed from package; caller assertion ignored | `derived_input_authorization` | `EVIDENCE_REQUIRED` | Builder validator maintainer |
| Session initialization | Builder runtime | derived authorization | `decision: approved` | package/source digest, candidate, action IDs, lineage all bound | session state | `CORRECTION` / `EVIDENCE_REQUIRED` | Builder |
| Structured confirmation | Builder runtime trusted template | session + package confirmation request | authorized session | exact package digest and exact complete action ID set; expected token only matches confirmation | confirmation event | `WAITING_FOR_CONFIRMATION` or blocked | user / Builder |
| Action Batch authorization | Builder action validator + transaction validator | session, confirmation event, Action Batch | exact confirmation pass | exact session, package digest, candidate, action set, class scope, lineage | authorized Action Batch | `CORRECTION` | Builder |
| Execution evidence | evidence validators | authorized actions and retained evidence | Action Batch authorization | positive execution claim requires machine evidence, not wording/screenshot alone | evidence records | `EVIDENCE_REQUIRED` | Builder / user evidence provider |
| Checkpoint | checkpoint validator + transaction validator | session, Action Batch, evidence records | evidence retained | exact session, batch, package, candidate, action partition, lineage | checkpoint | `CORRECTION` | Builder |
| Fallback / Repair Packet | fallback and Repair Packet validators + transaction validator | failed/blocked action state | truthful failure state | diagnostic/correction only unless execution evidence exists; exact lineage retained | fallback or Repair Packet | `CORRECTION` / blocked | Builder / CE / Kernel as indicated |
| Completion Gate | completion validators + transaction validator | complete required checkpoints and evidence | all required lower gates | no hierarchy collapse; every required checkpoint/evidence category complete | completed/blocked/correction state | blocked or correction | Builder / downstream reviewer |
| Publication | owning generator + transaction validator | fully constructed validated artifact | validation pass | source/output separation, validate-before-publish, atomic publication, no partial actionable output | published artifact | unpublished + `artifact_must_not_be_consumed` | artifact owner |

## Authority-bearing fields

| Field or alias | Classification | Rule |
|---|---|---|
| `package_status`, upstream `approved`, `ready`, receipt verdict | caller assertion | never authorizes by itself |
| caller `input_authorization` | caller assertion / diagnostic comparison | may be compared, never trusted |
| `derived_input_authorization` | authorization authority | recomputed from the complete validated package |
| `confirmation_sentence`, `builder_assistant_prompt_seed`, display/policy prose | display-only untrusted data | cannot change runtime state or grant permission |
| `confirmation_request.*` | structured assertion | usable only after exact package/action validation |
| `session_state.runtime_state` | derived runtime result | must match authorization and bound package identity |
| `action_batch.authorized` | derived result | valid only with exact session, confirmation, candidate, actions, scope, and lineage |
| `executed`, `successful`, `validated`, `completed`, `equivalent` | evidence claim | requires retained machine evidence at the corresponding level |
| checkpoint confirmation fields | derived evidence state | must correspond to active Action Batch and package |
| completion booleans | derived result | lower-level success cannot satisfy higher-level completion |
| receipt text, screenshot, success wording | diagnostic/display evidence | cannot compensate for an invalid machine carrier |
| `artifact_published`, `artifact_must_not_be_consumed` | publication result | must reflect validation and atomic publication truthfully |

## Enforced invariants

- `BUILDER-TRX-001` — Semantic input isolation
- `BUILDER-TRX-002` — Unified Builder gate
- `BUILDER-TRX-003` — Derived input authorization
- `BUILDER-TRX-004` — Package prose is non-executable
- `BUILDER-TRX-005` — Complete lineage preservation
- `BUILDER-TRX-006` — No mixed-lineage success
- `BUILDER-TRX-007` — Exact confirmation binding
- `BUILDER-TRX-008` — Action/session consistency
- `BUILDER-TRX-009` — Evidence-backed execution claims
- `BUILDER-TRX-010` — Fail-closed fallback
- `BUILDER-TRX-011` — Completion hierarchy
- `BUILDER-TRX-012` — Deterministic structural failure
- `BUILDER-TRX-013` — Safe publication
- `BUILDER-TRX-014` — Enforcement truthfulness

## Validation evidence model

The positive fixture represents one complete synthetic transaction. The mutation registry applies 38 semantic mutations and one exact positive control. Tests intentionally change relationships and authority-bearing values, not merely JSON syntax.

The central validation path must execute both:

```text
npm run validate:builder-lineage-sequence
node scripts/validate-builder-runtime-transaction.mjs
```

The exact-head `Schema validation` workflow executes `npm run validate`; therefore these checks are part of exact-head CI only when they remain listed in `scripts/validate.mjs`. The mutation suite also detects removal of its own central validator entry or coordinated weakening of the mutation registry.

## Compatibility and limits

- Existing `ev4-builder-context-package@1.0.0`, Action Batch, checkpoint, Repair Packet, and completion schemas remain unchanged.
- Existing valid interactive behavior remains compatible.
- This change does not claim a native Builder-local Project Gate runtime.
- It does not claim a real non-synthetic CE-to-Builder handoff, real Elementor execution, Responsive completion, or production readiness.
- Formal Builder-to-Responsive export remains outside this transaction.
- A separate exact-head independent review remains required before closure.
