# State Transitions and Resume

`runtime/state-transitions.v1.json` is the only transition definition. `scripts/lib/runtime-transaction-engine.mjs` loads it, verifies every registered guard, rejects registry drift and generates the next carriers.

`استارت` requires actual Builder Input and this CLI:

```bash
node scripts/builder-inspector.mjs resume builder-input.json builder-intake-result.json session-state.json checkpoint.json resume-output-directory
```

Resume is allowed only from a real `PAUSED` Session State. It verifies source SHA-256, package digest, selected candidate, session ID, exact Checkpoint, legal resume target and unresolved blocker preservation. Resume to `COMPLETED`, fabricated initialization, stale Checkpoint or Capsule-only authorization is forbidden.

Accepted output is generated atomically as transition result, next Session State, next Checkpoint and Resume result.
