# Intake and Builder Input Identity

```bash
node scripts/builder-inspector.mjs intake builder-input.json builder-intake-result.json
node scripts/builder-inspector.mjs verify-capsule builder-input.json builder-intake-result.json
```

Accepted input must be exact parsed `ev4-builder-context-package@1.0.0` content and pass JSON, Schema, semantic/cross-field, lineage, candidate lock, input authorization and canonical package-digest validation.

The Engine recomputes both the source-file SHA-256 and canonical package digest from the actual Builder Input. Resume and Completion always repeat this verification. The Capsule is a diagnostic/cache artifact; it cannot independently authorize a transition.

Receipt-only input, raw Project Gate envelopes, malformed JSON, stale Capsules, edited Capsules, foreign candidates or invalid input remain blocked.
