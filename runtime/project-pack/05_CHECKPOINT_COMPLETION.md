# Checkpoint, Completion Scope and Atomic Completion

Completion starts only from `APPROVED_HANDOFF_MODE / BUILD_ACTIVE`:

```bash
node scripts/builder-inspector.mjs completion builder-input.json builder-intake-result.json session-state.json checkpoint.json action-ledger.json completion-status.json completion-gate.json completion-output-directory
```

The caller does not pre-author terminal carriers. The Engine verifies the exact predecessor Session State and Checkpoint, Builder Input identity, Action Ledger, zero blockers, selected scope and cross-bound Completion Gate.

`runtime/completion-scopes.v1.json` defines required Builder states/evidence and forbidden Responsive/production claims. Completion Gate v0.2 binds session, package, source bytes, candidate, Checkpoint ID/sequence, Action Ledger ID/digest, Completion Scope and evidence-ledger digest.

On success the Engine generates and atomically publishes:

- `transition-result.json`;
- `session-state.json` with `COMPLETED`;
- child `checkpoint.json` with exact parent/sequence continuity;
- `completion-result.json`.

On any failure no terminal carrier is published and temporary outputs are removed. Builder completion remains separate:

```yaml
responsive_complete: false
production_ready: false
```
