# NEW_CHAT_START_INTAKE

Fresh chat intake requires `builder-input.json` and its matching accepted `builder-intake-authorization.json` before `APPROVED_HANDOFF_MODE / BUILD_ACTIVE`.

Create locally:

```bash
node scripts/builder-inspector.mjs intake --input builder-input.json --output builder-intake-authorization.json
```

The ChatGPT Project never claims local validator execution. It compares visible contract/candidate/status fields and blocks on any ambiguity. Exact hashes are verified by local `verify-capsule`, not conversational inference.

New-chat resume uses `استارت` only with matching accepted resume authorization and exact uploaded state carriers. No initialized state means fresh intake. Receipt remains non-semantic. Manual nested extraction and any pre-validation BATCH-001 are forbidden.


Canonical semantic schema: `ev4-builder-context-package@1.0.0`.

Receipt filename hint: `project-gate-c2b-receipt.json`; audit evidence only.
