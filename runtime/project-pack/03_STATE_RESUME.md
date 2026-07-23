# State, Checkpoint Sequence, and Resume

Canonical Checkpoint predicate:

```text
sequence == 1  => parent_checkpoint_id == null
sequence > 1   => parent_checkpoint_id is a non-empty string
```

The same predicate applies to Confirmation predecessors/results, Completion predecessors/results, and Resume.

Resume remains valid only from a real PAUSED Session with matching Builder Input, Package, Candidate, Session and embedded Checkpoint. It preserves unresolved blockers and cannot target COMPLETED.
