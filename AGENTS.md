# AGENTS.md

## Repository Profile

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

Read `runtime/personal-runtime-authority.v1.json`, `runtime/state-transitions.v1.json`, `PROJECT_INSTRUCTIONS.md`, relevant Schemas, validators and tests before changing Runtime code.

## Canonical Real Runtime

```text
explicit operator source
→ stable Run root creation
→ internal source snapshot
→ immutable generations/000001
→ atomic CURRENT.json
→ acquire .mutation-lock
→ reload active generation after lock
→ full pre-emission derivation
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

Only these commands have real Runtime authority:

```bash
node scripts/builder-inspector.mjs real-intake <project-gate|direct-ce|manual-builder-input> <source-artifact.json|-> <builder-input.json|-> <run-directory>
node scripts/builder-inspector.mjs emit-batch <run-directory>
node scripts/builder-inspector.mjs confirm-batch <run-directory> "<operator-token>"
node scripts/builder-inspector.mjs attach-evidence <run-directory> <evidence-source.json>
node scripts/builder-inspector.mjs real-completion <run-directory>
```

`CURRENT.json` is the sole active State selector. Published generations are immutable. Every mutation acquires `.mutation-lock` before reading State. Lock contention fails closed as `RUN_BUSY_OR_STALE_LOCK`; stale locks are removed only by explicit `recover-run-lock` after active Run validation.

Source modes and content binding, exact Package/Candidate/Batch/Action bindings, zero-blocker emission, WAITING-only Confirmation, exact verified Action-specific Evidence, Runtime-derived Completion Status/Gate, `responsive_complete: false`, and `production_ready: false` must be preserved.

Bootstrap compatibility: `شروع` routes to explicit Intake; `استارت` is compatibility Resume. Canonical input hint: `builder-input.json`; canonical input Schema: `ev4-builder-context-package@1.0.0`.

Do not add a database, service layer, daemon, event bus, distributed lock, authentication, signatures, PKI, secrets, remote attestation, multi-tenant support, generalized event sourcing or workflow platform.

## Validation

```bash
npm ci
npm run validate
node scripts/test-builder-run-concurrency.mjs
node scripts/test-builder-run-crash-recovery.mjs
node scripts/validate-canonical-run-artifacts.mjs <run-directory>
```

Do not claim validation, merge, approval or deployment without direct evidence.
