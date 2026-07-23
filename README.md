# EV4 Builder Assistant Repo

```yaml
version: 0.3.6
repository_profile: personal_single_operator
runtime_goal: functional_correctness
industrial_governance: removed_from_active_system
security_posture: minimal_nonblocking
independent_review_required: false
pr_inspector_required: false
exact_head_runtime_authority: false
fixture_validation_is_real_completion: false
real_completion_requires_source_bound_input: true
real_completion_requires_confirmation_receipt: true
real_completion_requires_verified_evidence_bytes: true
completion_status_runtime_derived: true
completion_gate_runtime_derived: true
builder_to_responsive: out_of_scope
responsive_complete: false
production_ready: false
```

این ریپو Runtime شخصی Builder برای اجرای Action Batchهای کوچک و قابل Resume است. یک فایل مستقل و caller-authored با نام `builder-input.json` فقط می‌تواند برای fixture، preview، diagnostics و compatibility inspection استفاده شود؛ چنین فایلی به‌تنهایی Run واقعی را authorize نمی‌کند.

## Active Runtime Truth Spine

```text
Authoritative upstream source artifact
→ Builder Source Resolver
→ Runtime-owned Verified Builder Context
→ Builder Action Batch
→ explicit confirm-batch command
→ Confirmation Receipt
→ source-bound Evidence byte verification
→ Runtime-derived Completion Status
→ Runtime-derived Completion Gate
→ COMPLETED
```

Sourceهای واقعی پشتیبانی‌شده:

- `project-gate`: یک `ev4-project-gate-c2b-receipt@1.0.0` که SHA-256 دقیق bytes فایل Builder Input و canonical package digest را bind می‌کند؛
- `direct-ce`: یک CE Builder package که توسط adapter رسمی همین ریپو normalize می‌شود و digest محتوای CE آن بررسی می‌شود.

`شروع` فقط intake جدید را در نبود Run فعال آغاز می‌کند. `شروع` تکراری state را حفظ می‌کند. `استارت` فقط Session واقعی و `PAUSED` را Resume می‌کند و نمی‌تواند Run بسازد.

Builder completion فقط پایان محدوده Builder است و Responsive completion یا production readiness را اثبات نمی‌کند.

## Real and Fixture Modes

| Capability | `fixture-validation` | `real-builder-run` |
|---|---:|---:|
| validate standalone Builder Input | yes | no |
| report `would_complete: true` | yes | n/a |
| create source-bound Context | no | yes |
| create Confirmation Receipt | no | yes |
| verify Evidence source bytes | no | yes |
| set `builder_build_complete: true` | never | only after all derived predicates pass |
| enter `COMPLETED` | never | only after all derived predicates pass |

Fixture terminal semantics remain:

```yaml
synthetic_validation_passed: true
would_complete: true
builder_build_complete: false
runtime_state: NOT_A_REAL_RUN
```

## Builder Inspector Commands

### Fixture validation

```bash
node scripts/builder-inspector.mjs \
  fixture-validation \
  builder-input.json \
  fixture-result.json
```

The legacy alias `intake` has the same fixture-only authority.

### Real intake from Project Gate

```bash
node scripts/builder-inspector.mjs \
  real-intake \
  project-gate \
  project-gate-c2b-receipt.json \
  builder-input.json \
  verified-builder-context.json \
  real-intake-result.json
```

### Real intake from direct CE package

```bash
node scripts/builder-inspector.mjs \
  real-intake \
  direct-ce \
  ce-source-wrapper.json \
  - \
  verified-builder-context.json \
  real-intake-result.json
```

### Confirm the active Action Batch

```bash
node scripts/builder-inspector.mjs \
  confirm-batch \
  verified-builder-context.json \
  session-state.json \
  checkpoint.json \
  "تایید BATCH-001" \
  confirmation-receipt.json
```

The token must match the active Runtime-derived batch. `checkpoint.confirmed_action_ids` is only a mirror and is insufficient without the validated Receipt.

### Real Completion

```bash
node scripts/builder-inspector.mjs \
  real-completion \
  project-gate \
  project-gate-c2b-receipt.json \
  builder-input.json \
  verified-builder-context.json \
  session-state.json \
  checkpoint.json \
  confirmation-receipt.json \
  completion-output
```

For direct CE intake, replace `project-gate` with `direct-ce`, use the CE wrapper as the source artifact, and pass `-` for the Builder Input argument.

### Legacy compatibility

```bash
node scripts/builder-inspector.mjs verify-capsule builder-input.json legacy-intake-result.json
node scripts/builder-inspector.mjs resume builder-input.json legacy-intake-result.json session-state.json checkpoint.json resume-output
```

Legacy Capsule verification remains for diagnostics and existing Resume compatibility. It cannot authorize real Completion.

## Confirmation Binding

The local functional Confirmation Receipt binds:

- exact `session_id`;
- exact canonical `package_digest`;
- exact selected candidate;
- exact verified Context digest;
- exact `batch_id`;
- complete Action ID set;
- canonical digest of every Action body;
- exact operator token.

No signature, PKI, external ledger or independent reviewer is required.

## Evidence Verification

Normal real Completion performs all of the following for every consequential Evidence Record:

1. resolve a safe repository-relative `source_ref`;
2. read the actual source bytes;
3. recompute SHA-256;
4. compare it with `content_sha256`;
5. parse the Evidence source as machine-readable JSON;
6. verify Evidence type, claim ID and claim class compatibility;
7. verify subject, Session and Package bindings;
8. verify Action identity for execution claims;
9. reject synthetic or fixture Evidence in `real-builder-run`;
10. retain missing, incompatible or unverified Evidence as Completion blockers.

The compact canonical claim classes are:

```text
required_action_execution
scaffold_built
structure_built
content_filled
desktop_layout_established
layout_verified
export_checked
export_verified
```

One Evidence item cannot satisfy unrelated claim classes unless the explicit compatibility mapping permits the pair.

## Derived Completion

Caller-authored `completion-status.json` or `completion-gate.json` cannot force Completion. Real Completion derives and atomically publishes:

```text
completion-status.json
completion-gate.json
checkpoint.json
session-state.json
completion-result.json
```

Completion requires:

- a freshly re-derived source-bound Builder Context;
- `APPROVED_HANDOFF_MODE / BUILD_ACTIVE` predecessor state;
- exact Session, Package, Candidate and Checkpoint continuity;
- no unresolved blockers;
- a valid Confirmation Receipt;
- verified execution Evidence for every required Action;
- compatible verified Evidence for all required Completion claims;
- successful atomic publication validation.

## Repository Maintenance

```bash
npm ci
npm run validate:version-consistency
npm run validate:schema-registry
npm run validate:builder-context-package
npm run validate:cross-field
npm run validate:builder-lineage-sequence
node scripts/test-builder-truth-spine.mjs
npm run build:project-pack
npm run validate
```

`npm run validate` includes the 54 focused mutation and preservation tests in `scripts/test-builder-truth-spine.mjs`.

Deep Runtime Transaction remains available for CI regression and diagnostics. It is not required per message or per Action.

## Deterministic Project Pack

Canonical source map:

```text
runtime/project-pack-source-map.v1.json
```

Build verification:

```bash
node scripts/build-project-pack.mjs --verify
```

Regeneration:

```bash
node scripts/build-project-pack.mjs --write
```

Generated files in `dist/chatgpt-project` are non-authoritative. Hand edits or stale generated files cause validation failure.

## Out of Scope

- Builder → Responsive runtime handoff
- Responsive completion
- production deployment
- real Elementor automation
- production readiness claim
- cryptographic signatures or external attestations
- databases, services, event buses or a second state machine

## Owner Local Pilot

1. Publish a real Project Gate receipt and exact Builder Input bytes, or provide a direct CE package wrapper.
2. Run `real-intake` and retain the generated Verified Builder Context.
3. Initialize or preserve the exact Session State and Checkpoint.
4. Execute one bounded Action Batch in Elementor.
5. Run `confirm-batch` with the exact operator token.
6. Capture non-synthetic source-bound Evidence files with correct hashes and bindings.
7. Run `real-completion`.
8. Confirm only Builder completion; keep Responsive and production flags false.

Detailed contract and examples are documented in `docs/BUILDER_TRUTH_SPINE.md`.
