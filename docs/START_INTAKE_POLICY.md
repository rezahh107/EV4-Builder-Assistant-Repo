# START_INTAKE_POLICY

`شروع` is fresh intake/state-preserving rerun. Intake is attachment-first and semantic, not filename-based.

Canonical personal path:

```text
EV4-Project-Gate / ce-to-builder
→ builder-input.json
→ node scripts/builder-inspector.mjs intake
→ builder-intake-authorization.json
→ Builder Assistant
```

The local Inspector is system-level validation. The model performs prompt-level artifact comparison only and must not claim it ran validators. Missing, blocked, stale, edited, ambiguous, or mismatched authorization blocks normal Builder actions.

`project-gate-c2b-receipt.json` is optional audit evidence. Raw Project Gate output and manual nested extraction are forbidden. Pre-validation and pre-authorization batches are forbidden.

Repeated `شروع` preserves valid state and unresolved evidence. `استارت` is resume-only and requires accepted resume authorization.


Canonical semantic schema: `ev4-builder-context-package@1.0.0`.
