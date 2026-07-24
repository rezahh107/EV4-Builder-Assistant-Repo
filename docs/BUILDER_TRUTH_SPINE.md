# Builder Truth Spine — Stable Run Generations

```yaml
repository_profile: personal_single_operator
runtime_owned_atomic_run_bundle: true
external_source_after_intake: not_used
caller_authored_initial_state: forbidden
caller_managed_carrier_selection: forbidden
legacy_runtime_authority: inactive
run_root_replacement: forbidden
active_generation_mutation: forbidden
mutation_without_run_lock: forbidden
state_load_before_lock: forbidden
current_pointer_to_partial_generation: forbidden
lost_update: forbidden
responsive_complete: false
production_ready: false
```

## Authoritative Storage

```text
<run-directory>/
├── source/
├── evidence/
├── generations/000001/
│   ├── run-manifest.json
│   ├── runtime-context.json
│   ├── session-state.json
│   └── checkpoint.json
├── generations/000002/...
├── transitions/
├── outputs/
├── CURRENT.json
└── .mutation-lock/
```

The Run root remains stable. Published generations are immutable. `CURRENT.json` is the sole active State selector and is replaced atomically only after the complete successor generation validates. A crash before the pointer rename leaves the predecessor active; a crash after it leaves the complete successor active. Unselected generations are orphans, not authority.

## Canonical Transaction

```text
acquire .mutation-lock
→ load CURRENT.json
→ validate active generation
→ derive successor
→ write and validate temporary complete generation
→ rename generation into final location
→ write/fsync temporary CURRENT pointer
→ atomically rename CURRENT.json
→ release lock in finally
```

The real flow is `real-intake → emit-batch → WAITING_FOR_CONFIRMATION → confirm-batch → BUILD_ACTIVE → attach-evidence → real-completion → COMPLETED`. Every transition preserves exact source, Context, Package, Candidate, Batch, Action ID/digest, Checkpoint lineage and blocker bindings.

Legacy truth-spine functions are fixture or historical reproduction only and return `BUILDER-LEGACY-AUTHORITY-INACTIVE`; they cannot publish real Session, Checkpoint, Confirmation, Evidence or Completion carriers.
