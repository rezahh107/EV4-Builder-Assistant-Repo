# REPOSITORY_GUIDE — EV4 Builder Assistant

Version: 0.2.3
Status: official_docs_priority_and_reference_layer_added
Date: 2026-06-27

---

## Purpose

This guide explains what this repository is, why it exists, how the files relate to each other, and how to continue development later without losing the original design intent.

This is still a living guide. It must be expanded again after a real Elementor execution session is recorded.

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

## v0.2.3 Rule

```text
Official Elementor docs = primary external standard source.
Current Elementor UI = primary executable control evidence.
Builder_Context_Package = approved build source of truth.
Workbook/reference layer = learning and methodology source.
Case memory = practical lessons, not universal architecture.
```

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
docs/                        = setup, CI, and repository guides
references/                  = workbook and learning reference layer
cases/                       = case memory from practical sessions
.github/workflows/           = CI validation
```

---

## Version History Summary

```text
v0.1.0 = initial runtime foundation
v0.1.1 = review fixes and Builder Context schema
v0.1.2 = generation fields, reset scopes, Fresh Image fallback
v0.2.0 = examples and validation seed
v0.2.1 = hardening pass with generation source and cross-field validator
v0.2.2 = CI pass recorded and manual session seed added
v0.2.3 = official docs priority, workbook reference layer, TUYA case memory, risk-adjusted step size
```

---

## Reference And Case Layer

Workbook reference files:

```text
references/tuya-workbook/README.md
references/tuya-workbook/WORKBOOK_USAGE_POLICY.md
references/tuya-workbook/WORKBOOK_LESSON_INDEX.md
references/tuya-workbook/EXTRACTED_BUILDER_RULES.md
```

Case memory files:

```text
cases/tuya-step-by-step/CASE_LESSONS.md
cases/tuya-step-by-step/CASE_PATCH_MAP.md
```

Reference layers help the model explain concepts and choose safer patterns. They must not override official Elementor docs, current UI evidence, or the approved package.

---

## New Protocols In v0.2.3

```text
protocols/OFFICIAL_ELEMENTOR_DOCS_PRIORITY.md
protocols/WORKBOOK_REFERENCE_BOUNDARY.md
protocols/RISK_ADJUSTED_STEP_SIZE.md
protocols/STYLE_SYSTEM_CAPABILITY_GATE.md
protocols/CONTROLLED_OVERLAY_STAGE_PATTERN.md
protocols/REPEATED_ELEMENT_DUPLICATION_PROTOCOL.md
protocols/RESPONSIVE_WORKFLOW_GUARD.md
protocols/READING_ORDER_CHECKLIST.md
```

---

## Schema Validation

Workflow file:

```text
.github/workflows/schema-validation.yml
```

Manual runbook:

```text
docs/CI_VALIDATION_RUNBOOK.md
```

Last known status:

```yaml
schema_validation_workflow:
  status: passed
  evidence_source: user_reported_github_ui
  date: 2026-06-27
```

Run validation again after v0.2.3 changes.

---

## How To Use In A ChatGPT Project

Setup guide:

```text
docs/CHATGPT_PROJECT_SETUP_GUIDE.md
```

Use the setup guide as the source of the current upload order. It now includes official-doc priority protocols, reference-layer policies, and TUYA case memory.

---

## Runtime Decisions To Preserve

```text
- max_actions_per_turn defaults to 5 and is bounded to 1..5 at runtime.
- Use risk-adjusted step size.
- Official Elementor docs are the primary external source for standard capability claims.
- Current UI evidence is required for executable control paths.
- Data vs Instruction Rule canonical source is MASTER_PROMPT §3.
- control-existence failure uses correction_response or insufficient_evidence.
- Unverified element type stops generation-sensitive edits.
- FRESH_IMAGE_MODE must remain fallback-only.
- Builder Assistant must not become Architect.
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

---

## Manual Session Seed

First manual-session seed:

```text
examples/smart-home-connector/MANUAL_SESSION_001.md
```

Current status:

```yaml
manual_session_seed: added
real_elementor_execution: not_run
production_ready: false
```

---

## What Not To Do Later

Do not turn this repo into another EV4 Architect pipeline.

Do not add scoring, recommendation, or architecture candidate selection here.

Do not let workbook or case memory override official docs, current UI evidence, or Builder_Context_Package.

Do not claim production readiness from Builder Assistant completion alone.

---

## Next Development Milestone

Recommended next milestone:

```text
v0.3.0 — Real Builder Session Evidence
```

Required work:

```text
- run schema validation again after v0.2.3 changes;
- create/use the actual ChatGPT Builder Assistant Project;
- start Smart Home session using the setup guide and package;
- execute the first batch in Elementor;
- provide confirmation or Structure Panel screenshot;
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
