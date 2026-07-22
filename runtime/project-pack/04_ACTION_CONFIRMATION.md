# Action Batch and Confirmation

Ordinary actions carry only execution-critical metadata:

```yaml
required_for_normal_action:
  - target_node
  - element_type
  - control_family
  - control_name
  - value when applicable
  - unit and value_source for numeric values
  - responsive_scope
  - class_scope when class_name is present
  - expected_result
```

Extended metadata is conditional:

```yaml
risk_conditioned:
  - rationale
  - reversibility_analysis
  - safety_decision
  - evidence_required
  - confirmation_scope
  - forbidden_changes
```

It is required for `risk_level: high` or `difficult_to_reverse: true`.

Never weaken target identity, `selected_candidate_id`, decision lineage, class scope, or active confirmation binding.

A checkpointed action must carry a non-empty `confirmation_scope`. Only the active structured confirmation token can advance the state.

For the active bounded Run, `builder-input.json:first_builder_batch.actions` defines the complete expected Action set. Completion must reconcile every expected Action ID with the final Checkpoint; deleting an Action from `unconfirmed_action_ids` cannot make it complete. No separate Action Ledger is active.
