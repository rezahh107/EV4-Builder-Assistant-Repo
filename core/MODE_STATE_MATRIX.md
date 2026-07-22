# core/MODE_STATE_MATRIX

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
industrial_governance: removed_from_active_system
security_posture: minimal_nonblocking
production_ready: false
canonical_transition_table: runtime/state-transitions.v1.json
```

## Legal Mode / State Combinations

| workflow_mode | Legal runtime_state values |
|---|---|
| `START_INTAKE_MODE` | `INTAKE_WAITING`, `INTAKE_VALIDATING`, `EVIDENCE_REQUIRED`, `REVIEW_ONLY`, `CORRECTION`, `PAUSED` |
| `APPROVED_HANDOFF_MODE` | `BUILD_ACTIVE`, `WAITING_FOR_CONFIRMATION`, `EVIDENCE_REQUIRED`, `CORRECTION`, `REVIEW_ONLY`, `PAUSED`, `COMPLETED` |
| `FRESH_IMAGE_MODE_LIMITED` | `INTAKE_WAITING`, `EVIDENCE_REQUIRED`, `BUILD_ACTIVE`, `WAITING_FOR_CONFIRMATION`, `CORRECTION`, `REVIEW_ONLY`, `PAUSED` |

`COMPLETED` is forbidden in `START_INTAKE_MODE` and `FRESH_IMAGE_MODE_LIMITED`.

## Canonical Transitions

| From | Trigger | Required guards | To |
|---|---|---|---|
| no initialized state | `شروع` | no active session | `START_INTAKE_MODE / INTAKE_WAITING` |
| any initialized state | repeated `شروع` | preserve session, checkpoint and blockers | same state |
| `START_INTAKE_MODE / INTAKE_WAITING` | Builder input received | candidate unambiguous | `INTAKE_VALIDATING` |
| `START_INTAKE_MODE / INTAKE_VALIDATING` | intake accepted | Schema, semantic, lineage, authorization valid | `APPROVED_HANDOFF_MODE / BUILD_ACTIVE` |
| `START_INTAKE_MODE / INTAKE_VALIDATING` | intake blocked | blocking diagnostic exists | `EVIDENCE_REQUIRED` |
| any initialized non-completed state | `توقف` | prior state recorded | `PAUSED` |
| `PAUSED` | `استارت` | prior state, session, package, candidate, checkpoint and blockers valid | previous legal state |
| `APPROVED_HANDOFF_MODE / BUILD_ACTIVE` | Action Batch emitted | batch valid and confirmation binding created | `WAITING_FOR_CONFIRMATION` |
| `APPROVED_HANDOFF_MODE / WAITING_FOR_CONFIRMATION` | confirmation accepted | active confirmation matches and Checkpoint updates | `BUILD_ACTIVE` |
| any initialized non-completed state | blocking error | Repair Packet created or updated | `CORRECTION` |
| `APPROVED_HANDOFF_MODE / BUILD_ACTIVE` | `completion_validation_passed` | final checkpoint, package, candidate, actions, blockers, status and gate valid | `COMPLETED` |

## Forbidden Transitions

- intake → `COMPLETED`;
- fresh image → `COMPLETED`;
- evidence-required → `COMPLETED`;
- correction → `COMPLETED`;
- a requested completion report → `COMPLETED`;
- `استارت` without a prior initialized PAUSED state;
- repeated `شروع` creating a second Run;
- unresolved blocker disappearing;
- detached success text compensating for invalid state.

## Completion Invariants

```yaml
workflow_mode: APPROVED_HANDOFF_MODE
runtime_state: COMPLETED
final_checkpoint_valid: true
package_digest_matches: true
selected_candidate_matches: true
required_actions_complete: true
unresolved_blocking_evidence_count: 0
completion_status_valid: true
completion_gate_valid: true
responsive_complete: false
production_ready: false
```

The machine-readable JSON table is authoritative when this document and code differ. CI validates that the active documents and the JSON table remain aligned.
