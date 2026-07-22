# Intake Inspector

Canonical command:

```bash
node scripts/builder-inspector.mjs intake builder-input.json builder-intake-result.json
```

Accepted input must be exact parsed `ev4-builder-context-package@1.0.0` content and must pass:

- JSON parsing;
- Builder Context Schema validation;
- semantic and cross-field validation;
- decision-lineage validation;
- selected candidate lock and consistency;
- `input_authorization` decision and eligible mode/state;
- canonical package digest validation.

The source file is read-only. Output publication uses a temporary file followed by atomic rename.

Receipt-only input, raw Project Gate envelopes, malformed JSON, wrong Schema, candidate mismatch, lineage mismatch, failed authorization, or stale source bytes remain blocked.

Verify a previously accepted capsule against current source bytes with:

```bash
node scripts/builder-inspector.mjs verify-capsule builder-input.json builder-intake-result.json
```
