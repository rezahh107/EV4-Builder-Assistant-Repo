# 07_CHECKPOINT_EVIDENCE_COMPLETION

Loop: validated state -> small batch -> confirmation/evidence -> validated Checkpoint -> next safe batch.

Silence confirms nothing. Screenshots prove only visible claims. Vague completion text cannot replace action IDs, evidence, Checkpoint, or completion authorization.

Resume requires local `builder-inspector resume` output. Builder completion requires local `builder-inspector completion` output with:
- final Session State = COMPLETED
- valid final Checkpoint
- matching input/capsule/session/package/candidate
- no unconfirmed required actions
- no unresolved blockers
- valid Completion Status and Completion Gate

Accepted completion scope is only `builder_completion_only`; Responsive and production remain false.
