# Runtime Core — Atomic Run Bundle

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
runtime_owned_atomic_run_bundle: true
internal_source_snapshot: true
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
responsive_complete: false
production_ready: false
```

Canonical Builder Schema is `ev4-builder-context-package@1.0.0`; `builder-input.json` is only a filename hint. `شروع` creates a Run only when none exists. `استارت` is PAUSED-only compatibility Resume.

```text
explicit operator source
→ atomic real-intake Run Bundle
→ internal source snapshot
→ Runtime-owned Session and Checkpoint
→ pre-emission full re-derivation
→ zero-blocker gate
→ atomic emit-batch
→ WAITING_FOR_CONFIRMATION
→ lightweight Confirmation reconciliation
→ atomic confirm-batch
→ BUILD_ACTIVE
→ internal Evidence snapshots through attach-evidence
→ full Completion re-derivation
→ atomic real-completion
→ COMPLETED
```

Only `scripts/lib/runtime/canonical-run-runtime.mjs` can publish real Runtime State. No producer authentication, remote provenance, signature, PKI, secret, database, service layer or event bus is active.
