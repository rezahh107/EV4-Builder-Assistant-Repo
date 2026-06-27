# REPOSITORY_GUIDE — EV4 Builder Assistant

Version: 0.2.1
Status: hardening_pass_applied
Date: 2026-06-27

---

## Purpose

This guide explains what this repository is, why it exists, how the files relate to each other, and how to continue development later without losing the original design intent.

This is a living guide. It must be expanded again after CI results and real builder-session validation are available.

---

## Big Picture

```text
EV4 Architect
= decides what should be built.

EV4 Builder Assistant
= helps the user build the approved structure inside Elementor.

EV4 Responsive Architect
= validates and repairs responsive behavior after real implementation evidence exists.
```

This repository is only the middle system.

---

## Main Runtime Flow

```text
Builder_Context_Package
        │
        ▼
Input Contract Check
        │
        ▼
APPROVED_HANDOFF_MODE
        │
        ▼
Action Batch
        │
        ▼
User executes in Elementor
        │
        ▼
Confirmation / screenshot / issue report
        │
        ▼
Checkpoint update or CORRECTION_MODE
        │
        ▼
Next Action Batch
```

---

## File Families

```text
PROJECT_INSTRUCTIONS.md      = compact always-on ChatGPT Project instruction layer
core/                        = always-active runtime behavior
modes/                       = APPROVED_HANDOFF_MODE, CORRECTION_MODE, FRESH_IMAGE_MODE
protocols/                   = runtime guardrails
input-contracts/             = pre-runtime package gates
commands/                    = Persian session commands
schemas/                     = package, session, checkpoint schemas
scripts/                     = cross-field validators
examples/                    = reusable examples and Smart Home seed
tests/                       = valid and invalid fixtures
.github/workflows/           = CI validation
```

---

## Version History Summary

### v0.1.0

Initial runtime foundation.

### v0.1.1

Review fixes: Builder Context schema, bounded action count, canonical Data vs Instruction rule, Unverified element behavior, unified correction response.

### v0.1.2

Schema and mode gaps: generation fields, widget mapping `minItems`, reset scopes, fallback-only Fresh Image mode.

### v0.2.0

Examples and validation seed: example template, Smart Home example, first valid/invalid fixtures, initial CI.

### v0.2.1

Hardening pass:

```text
element_generation_source required
expanded invalid fixtures
checkpoint fixtures added
cross-field validator added
package.json validation scripts added
workflow hardened
Smart Home example hardened
Architect repo schema sync applied
```

---

## Schema Validation

The workflow validates:

```text
1. valid Builder_Context_Package fixture passes.
2. Smart Home example package passes.
3. invalid Builder_Context_Package fixtures fail.
4. valid checkpoint fixture passes.
5. invalid checkpoint fixture fails.
6. session-state.schema.json compiles with checkpoint.schema.json.
7. cross-field package integrity passes.
```

Workflow file:

```text
.github/workflows/schema-validation.yml
```

Cross-field validator:

```text
scripts/validate-package.mjs
```

Local validation commands:

```text
npm run validate:cross-field
npm run validate:builder-context
npm run validate:checkpoint
```

---

## Cross-Field Rules

The validator checks:

```text
- node_id uniqueness
- action_id uniqueness
- child node references
- class map node references
- first batch target references
- action active_class references
- widget class references
- element_generation and element_generation_source consistency
- production_ready_allowed must remain false
- selected_candidate_locked must remain true
```

---

## How To Use In A ChatGPT Project

Upload or paste in this order:

```text
1. PROJECT_INSTRUCTIONS.md
2. core/MASTER_PROMPT.md
3. input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md
4. core/SESSION_STATE_MACHINE.md
5. core/LIVE_INTERFACE_PRECEDENCE.md
6. modes/APPROVED_HANDOFF_MODE.md
7. modes/CORRECTION_MODE.md
8. protocols/CONTROL_EXISTENCE_FAILURE.md
9. commands/SESSION_COMMANDS.md
10. protocols/PER_ELEMENT_INSTRUCTION.md
11. protocols/CLASS_APPLICATION_SAFETY.md
12. protocols/COMPLETION_GATE.md
13. modes/FRESH_IMAGE_MODE.md only if fallback behavior is needed
```

Then start a session with:

```text
Builder_Context_Package
+ original section screenshot
+ request to begin interactive Elementor build
```

For Smart Home Connector, use:

```text
examples/smart-home-connector/start_session_prompt.md
examples/smart-home-connector/builder_context_package.json
```

---

## Runtime Decisions To Preserve

```text
- max_actions_per_turn stays bounded to 1..6.
- Data vs Instruction Rule canonical source is MASTER_PROMPT §3.
- control-existence failure uses correction_response, not a separate top-level shape.
- Unverified element type stops generation-sensitive edits.
- element_generation and element_generation_source must be carried by the package where possible.
- FRESH_IMAGE_MODE must remain fallback-only.
- Builder Assistant must not become Architect.
- valid/invalid fixtures must stay aligned with schema changes.
- Architect repo must remain compatible with the Builder Assistant consumer schema.
```

---

## Upstream Sync

Architect repo synchronization is recorded in:

```text
stages/11_BUILDER_FEED_EXPORT_v1.1_HARDENING_PATCH.md
schemas/ev4-builder-context-package.schema.json
STATUS_0.16.2_BUILDER_FEED_SCHEMA_SYNC.md
```

This prevents `/builder-feed-export` from emitting packages that the Builder Assistant immediately rejects.

---

## What Not To Do Later

Do not turn this repo into another EV4 Architect pipeline.

Do not add scoring, recommendation, or architecture candidate selection here.

Do not let `FRESH_IMAGE_MODE` become the default path when `Builder_Context_Package` exists.

Do not remove correction mode or live interface precedence.

Do not claim production readiness from Builder Assistant completion alone.

---

## Next Development Milestone

Recommended next milestone:

```text
v0.2.2 — CI Result Repair / Manual Session Seed
```

Required work:

```text
- watch GitHub Actions result;
- fix schema/workflow/fixtures if CI fails;
- run a manual Smart Home Builder Assistant session;
- record observed issues in examples/smart-home-connector/notes.md;
- expand this guide after real execution evidence.
```

---

## Final Guide Reminder

Before considering this repo stable, create a full final guide that includes:

```text
- purpose and boundaries;
- file map;
- how to create a ChatGPT Project from these files;
- how to start a builder session;
- example first turn;
- session commands;
- correction workflow;
- checkpoint examples;
- completion report example;
- what to hand off to EV4 Responsive Architect;
- CI validation workflow behavior;
- real builder-session lessons.
```
