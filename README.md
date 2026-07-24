# EV4 Builder Assistant Repo

```yaml
version: 0.3.6
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

The real Runtime owns one stable local Run directory. Intake snapshots exact selected source bytes and creates immutable `generations/000001`. `CURRENT.json` is the sole active State pointer; there are no duplicate mutable top-level Session, Checkpoint, Context or manifest files.

## Canonical Flow

```text
explicit operator source
→ stable Run root
→ internal source snapshot
→ immutable generations/000001
→ atomic CURRENT.json
→ acquire .mutation-lock
→ load active generation after lock
→ emit immutable WAITING_FOR_CONFIRMATION generation
→ atomic CURRENT.json update
→ confirm immutable BUILD_ACTIVE generation
→ attach-evidence internal snapshots and generations
→ derive immutable terminal generation
→ atomic CURRENT.json update
→ COMPLETED
```

```bash
node scripts/builder-inspector.mjs real-intake <project-gate|direct-ce|manual-builder-input> <source-artifact.json|-> <builder-input.json|-> <run-directory>
node scripts/builder-inspector.mjs emit-batch <run-directory>
node scripts/builder-inspector.mjs confirm-batch <run-directory> "<operator-token>"
node scripts/builder-inspector.mjs attach-evidence <run-directory> <evidence-source.json>
node scripts/builder-inspector.mjs real-completion <run-directory>
```

A mutation writer acquires `.mutation-lock` before reading `CURRENT.json`. A competing local process receives `RUN_BUSY_OR_STALE_LOCK`; it cannot commit previously loaded State. Each successful transition publishes a complete successor generation and advances `CURRENT.json` through one atomic same-filesystem rename. A crash before pointer replacement leaves the predecessor active; a crash after replacement leaves the complete successor active. Orphan generations never become authoritative automatically.

The Runtime preserves exact source mode arguments, deterministic Package/Candidate/Batch/Action binding, zero-blocker Action emission, `WAITING_FOR_CONFIRMATION`-only Confirmation, exact verified Action-specific Evidence, and Runtime-derived Completion Status/Gate. Builder Completion never implies Responsive completion or production readiness.

Bootstrap compatibility: `شروع` routes to explicit Intake; `استارت` is compatibility Resume. Canonical input hint: `builder-input.json`; canonical input Schema: `ev4-builder-context-package@1.0.0`.

```bash
npm ci
npm run validate
```
