# Behavioral Contract Enforcement

Builder behavior that can affect execution safety, layout paradigm, first-batch structural intent, numeric values, evidence claims, repair state, completion status, asset compatibility, UI instruction confidence, or user-facing status wording must be contract-driven.

Required enforcement path: protocol → JSON schema → validator → valid/invalid fixtures → `scripts/validate.mjs` central runner → CI → runtime state-machine gate → user-facing wording guard.

Runtime hooks:
- START_INTAKE_MODE / INTAKE_VALIDATING validate Builder Context Package and Reference Paradigm Gate before handoff.
- APPROVED_HANDOFF_MODE cannot enter BUILD_ACTIVE unless pre-build validators pass.
- BUILD_ACTIVE requires Action Batch, Unit Policy, UI Confidence, and Evidence requirements to validate before output.
- WAITING_FOR_CONFIRMATION can advance only claims mapped to `confirmation_request` scope.
- CORRECTION / EVIDENCE_REQUIRED blocks normal build and requires a repair packet or targeted evidence path.
- COMPLETED requires completion-status validation; `production_ready` remains false unless separately proven.

Additional contract hooks: `protocols/GOLDEN_REFERENCE_CONTRACT.md`, `protocols/BUILD_INTENT_BRIEF.md`, `protocols/SPATIAL_LEXICON.md`, and `protocols/EXPERIENCE_INTENT.md` extend the enforcement path for visual-reference builds, deterministic mental-model display, controlled spatial terms, and advisory experience feel.
