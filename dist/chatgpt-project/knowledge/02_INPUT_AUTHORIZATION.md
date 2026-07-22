# 02_INPUT_AUTHORIZATION

Canonical semantic input: `ev4-builder-context-package@1.0.0`.

Personal execution additionally requires a matching accepted:
`ev4-builder-intake-authorization@1.0.0`.

Create it locally:
`node scripts/builder-inspector.mjs intake --input builder-input.json --output builder-intake-authorization.json`

Verify it locally:
`node scripts/builder-inspector.mjs verify-capsule --input builder-input.json --capsule builder-intake-authorization.json`

The capsule binds exact input bytes, canonical package digest, selected candidate, contract identity, validator identity, and one initialized session. A hand-edited, stale, blocked, or mismatched capsule fails.

`project-gate-c2b-receipt.json` remains non-semantic audit evidence. Receipt-only input and raw Project Gate envelopes block.
