# Verified Evidence and Real Completion

Evidence enters the verified set only when `source.status == "verified"`.

For `required_action_execution`:
- source.action_id belongs to the active Context Action set;
- assertion.subject_ref equals source.action_id;
- source.subject_ref equals source.action_id;
- record and source bind the exact assertion.

Real Completion requires:

```text
checkpoint.batch_id
== confirmation_receipt.batch_id
== context.action_batch.batch_id
```

Receipt Candidate, confirmation_id, resulting Checkpoint identity/sequence, Action IDs and Action body digests must match the fresh Runtime Context and current confirmed Checkpoint.

Canonical command is `real-completion`. The alias `completion` is fixture/compatibility-only.

Successful publication is atomic and derives:

```yaml
builder_build_complete: true
responsive_complete: false
production_ready: false
```
