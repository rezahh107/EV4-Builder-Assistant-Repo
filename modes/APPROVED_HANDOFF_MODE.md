# modes/APPROVED_HANDOFF_MODE

Version: 0.1.1
Status: active_initial
Purpose: build from audited EV4 Builder_Context_Package

---

## When This Mode Applies

Use `APPROVED_HANDOFF_MODE` only after the provided `Builder_Context_Package` passes `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md` with:

```yaml
input_authorization:
  decision: approved
  eligible_workflow_mode: APPROVED_HANDOFF_MODE
  eligible_runtime_state: BUILD_ACTIVE
```

Compatible older packages may omit an embedded `input_authorization`, but the Builder Assistant must compute the same authorization before entering this mode.

Do not use `APPROVED_HANDOFF_MODE` for:

```text
- package_status: blocked
- blocked_missing_input
- blocked_invalid_package
- blocked_conflict
- blocked_package_status
```

---

## Main Rule

```text
The analysis and architecture decision already happened upstream.
Build from the approved package. Do not re-architect.
```

---

## Allowed Work

```text
- validate Builder_Context_Package completeness;
- summarize source boundary;
- identify first uncompleted builder action;
- create small Elementor action batches;
- apply approved Structure Panel labels;
- apply approved class names;
- preserve editable content;
- preserve decoration-only boundaries;
- request screenshots or confirmations;
- maintain checkpoints;
- enter CORRECTION_MODE if UI evidence contradicts an instruction.
```

---

## Forbidden Work

```text
- rerun scoring;
- rerun recommendation;
- change selected_candidate_id;
- redesign the tree;
- add or remove approved classes;
- convert unknowns into facts;
- hide medium/audit flags;
- assume clickability;
- assume Dynamic Loop;
- assume mobile connector behavior;
- create production-ready claim.
```

---

## First Response Pattern

When the package is authorized and complete, the first response should include:

```text
APPROVED_HANDOFF_MODE فعال شد.
selected_candidate_id: [value]
source_of_truth: Builder_Context_Package
production_ready: false

input_authorization:
- decision: approved
- package_digest: [sha256 if supplied or computed]

Current verified scope:
- package authorization: pass
- first target: [target]

Actions:
1. [small action]
2. [small action]
...

Verification request:
[exact confirmation sentence or targeted screenshot request]
```

If the package is incomplete, blocked, or internally conflicting, do not start actions. Ask only for the missing or corrected blocking input.

---

## Screenshot Use

The original section screenshot is used as:

```text
visual_reference_only
```

It must not override the approved architecture.

Current Elementor editor/frontend screenshots are execution evidence and may affect whether a step is feasible.

---

## Handoff Conflict

If current evidence contradicts the package:

```text
- do not silently choose;
- report conflict;
- identify whether it is implementation-level or architecture-level;
- if architecture-level, route back to EV4 Architect;
- if implementation-level, enter CORRECTION_MODE.
```

---

## Exit Conditions

Leave this mode only when:

```text
- user asks for correction → CORRECTION_MODE;
- user asks for review only → REVIEW_MODE;
- user pauses → PAUSED;
- build completion gate is reached → COMPLETED;
- package conflict requires upstream rerun → EVIDENCE_REQUIRED or blocked route.
```
