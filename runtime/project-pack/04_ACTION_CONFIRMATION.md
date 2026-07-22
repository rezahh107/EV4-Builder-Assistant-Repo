# Action Ledger and Confirmation

Ordinary Action metadata remains execution-focused. Candidate identity, decision lineage, target identity, class scope and active confirmation binding are never weakened.

The authoritative machine-readable Ledger uses Schema `ev4-builder-action-ledger@1.0.0` and binds:

- `session_id`;
- Builder Input source SHA-256 and package digest;
- `selected_candidate_id`;
- Ledger and Checkpoint sequence;
- complete expected Batch IDs;
- complete expected required Action IDs;
- exactly one disposition for every required Action.

Checkpoint confirmed/pending summaries must reconcile exactly with the Ledger digest. Confirmed Actions require `confirmation_ref`. Cancelled or not-applicable Actions require explicit reason and authorization. Omitting an Action or an entire Batch cannot satisfy Completion.
