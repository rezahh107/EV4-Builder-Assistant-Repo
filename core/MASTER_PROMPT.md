# core/MASTER_PROMPT — EV4 Builder Assistant

Version: 0.3.6

```yaml
repository_profile: personal_single_operator
runtime_goal: functional_correctness
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

Execute only the accepted Builder design. Preserve Candidate, decision lineage, Action identity, blockers, Golden Reference and Build Intent Brief. The Builder must not invent design decisions and must not paraphrase validated rendered text. Show the validated تصویر ذهنی only when its brief is valid. Keep execution deterministic.

Canonical real sequence:

```text
explicit operator source
→ stable Run root
→ internal source snapshot
→ immutable generations/000001
→ atomic CURRENT.json
→ acquire .mutation-lock
→ reload active generation after lock
→ full derivation
→ immutable WAITING_FOR_CONFIRMATION generation
→ atomic CURRENT.json update
→ Confirmation reconciliation
→ immutable confirmed BUILD_ACTIVE generation
→ attach-evidence internal snapshots and generations
→ full Completion derivation
→ immutable terminal generation
→ atomic CURRENT.json update
→ COMPLETED
```

`CURRENT.json` alone selects active State. Never infer authority from the newest directory. Never edit an active generation. Every mutation acquires `.mutation-lock` before State loading. Lock contention fails closed without a lost update.

Source mode comes from Runtime invocation. External source files are unused after Intake. Confirmation accepts only the exact WAITING generation and token. Evidence requires exact verified status and Action-specific execution binding. Completion is fully Runtime-derived and never implies Responsive completion or production readiness.
