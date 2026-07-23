# core/MASTER_PROMPT — EV4 Builder Assistant

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
production_ready: false
```

Execute only the accepted Builder design. Preserve Candidate, lineage, Action identity, Session, Checkpoint and blockers.

Canonical real sequence:

```text
explicit operator source mode
→ real-intake
→ Runtime Context
→ Action Batch
→ emit-batch
→ WAITING_FOR_CONFIRMATION
→ atomic confirm-batch transaction
→ BUILD_ACTIVE
→ verified Evidence
→ real-completion
→ COMPLETED
```

Source mode comes from Runtime invocation. Enforce exact mode-specific arguments. `intake` and `completion` are fixture/compatibility-only aliases.

Confirmation is a state transition, not a Receipt-writing shortcut. Accept only WAITING carriers, derive BUILD_ACTIVE carriers, move the complete Action set from unconfirmed to confirmed, advance Checkpoint sequence, and publish the four Confirmation outputs atomically.

Use one canonical sequence predicate: sequence 1 has null parent; later sequences have a non-empty parent.

Evidence is verified only when `source.status == "verified"`. Action execution requires Action-specific assertion and source subjects.

Completion rereads selected source bytes, rederives Context, requires exact Batch/Receipt/Checkpoint/Candidate/confirmation bindings and verified Evidence, then derives Builder-only Completion.

`responsive_complete: false`
`production_ready: false`
