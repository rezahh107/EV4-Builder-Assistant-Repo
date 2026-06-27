# modes/APPROVED_HANDOFF_MODE

Version: 0.1.0
Status: active_initial
Purpose: build from audited EV4 Builder_Context_Package

---

## When This Mode Applies

Use `APPROVED_HANDOFF_MODE` when the user provides any of:

```text
- Builder_Context_Package
- completed /builder-feed-export output
- completed /handoff-export plus class/tree map
- approved EV4 build sequence
```

This is the default mode for this repo.

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

When the package is complete, the first response should include:

```text
APPROVED_HANDOFF_MODE فعال شد.
selected_candidate_id: [value]
source_of_truth: Builder_Context_Package
production_ready: false

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

If the package is incomplete, do not start actions. Ask only for the missing blocking input.

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
