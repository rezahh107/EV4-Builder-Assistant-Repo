# Action Batch and Canonical Confirmation

Canonical transaction:

```text
BUILD_ACTIVE
→ emit-batch
→ WAITING_FOR_CONFIRMATION
→ confirm-batch
→ BUILD_ACTIVE
```

`emit-batch` and `confirm-batch` derive carriers; caller-authored confirmation arrays are not authority.

`confirm-batch` requires:
- matching APPROVED_HANDOFF_MODE / WAITING_FOR_CONFIRMATION Session and Checkpoint;
- matching Context Batch;
- empty confirmed_action_ids;
- complete Context Action set in unconfirmed_action_ids;
- exact operator token.

Atomic output set:

```text
confirmation-receipt.json
checkpoint.json
session-state.json
confirmation-result.json
```

Failure publishes nothing. Receipt binds the resulting Checkpoint identity and sequence.
