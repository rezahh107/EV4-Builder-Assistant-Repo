# Builder Runtime Transaction Enforcement

Status: active validation composition
Public contract version impact: none
Canonical validator: `scripts/validate-builder-runtime-transaction.mjs`
Canonical transaction input: `tests/valid/runtime-transaction/complete-transaction.json`
Canonical CI shard: `runtime-transaction`

## Purpose

This layer composes existing Builder contracts. It does not define replacement Builder Context, Action Batch, Session State, Checkpoint, Evidence, Completion, or publication carriers.

Each transaction envelope contains immutable repository-relative references and cross-carrier bindings. Every referenced carrier must independently pass its existing JSON Schema and semantic validator before composite validation begins.

The supported semantic paths remain:

```text
Project Gate builder-input.json
  → exact source-byte parsing
  → canonical Builder Context validation
  → canonical full-package digest

controlled CE package
  → CE-to-Builder Contract Gate
  → independently executed Builder adapter
  → exact comparison with consumed Builder Context Package
  → canonical full-package digest
```

`project-gate-c2b-receipt.json` remains separate audit evidence and cannot become semantic Builder input. Caller-provided `verified=true`, provenance-looking JSON, path-equivalence pass strings, workflow labels, PR state, or commit identity are not Runtime capabilities.

## Canonical Transaction Members

The positive fixture references actual canonical carriers:

- `ev4-builder-context-package@1.0.0`
- `ev4-action-batch@1.0.0`
- initial and final `ev4-builder-session-state@0.1.0` snapshots
- initial and final `ev4-builder-checkpoint@0.2.0` snapshots
- `ev4-completion-status@1.0.0`
- `ev4-completion-gate@0.1.0`
- retained machine-readable execution evidence

Unsafe, absolute, non-canonical, or repository-escaping references fail before child validators are invoked. The source artifact is parsed from exact bytes. On the Project Gate-shaped fixture path, the same bytes are the consumed Builder package.

The canonical package identity is SHA-256 over `canonical_package_without_digest`. The composite digest must match both its own recomputation and `input_authorization.package_digest`, which is independently enforced by the Builder package validator.

## Cross-Carrier Identity

One transaction binds:

- exact source bytes;
- full canonical package digest;
- full ordered canonical action-set digest;
- per-action canonical digests;
- Confirmation ID, user token, Action IDs, and Action bodies;
- initial and final Session State byte hashes;
- initial and final Checkpoint byte hashes;
- Session ID and selected Candidate;
- retained Evidence bytes;
- Completion to the exact final Session State and final Checkpoint.

Action identity is not reduced to `action_id`. Target, element type, class, Local/Global class scope, executable value, evidence requirements, expected result, and decision lineage are part of the canonical Action digest.

## Session Completion Model

```text
WAITING_FOR_CONFIRMATION
→ confirmed canonical Action Batch
→ evidence-backed final Checkpoint
→ COMPLETED
```

Both Session snapshots share the transaction Session ID and full package digest. The final snapshot embeds the exact final Checkpoint. `session_complete=true` or `builder_build_complete=true` fails unless the actual final canonical Session State has both `runtime_state` and `current_state` equal to `COMPLETED`.

A detached completion string or field cannot compensate for a stale Session State carrier.

## Provenance and Equivalence Boundary

The fixture is explicitly `synthetic_validation_only`. It proves contract composition and mutation resistance, not a real Project Gate handoff, real CE handoff, or real Elementor execution.

Validation derives evidence instead of trusting envelope assertions:

- `git ls-files --error-unmatch` proves that the synthetic source fixture belongs to the exact checkout;
- the source byte hash is recomputed;
- every canonical carrier executes its existing Schema and semantic validator;
- the direct CE mutation executes the actual CE-to-Builder normalizer and compares its complete output;
- self-asserted equivalence or provenance fields are rejected;
- `runtime_evidence` fails closed until an independently verified producer-provenance capability exists.

No repository-local label is treated as proof that an artifact was actually emitted by Project Gate or CE.

## Enforced Invariants

- `BUILDER-TRX-001` — exact semantic source isolation
- `BUILDER-TRX-002` — independently executed CE-path comparison and fail-closed Runtime provenance
- `BUILDER-TRX-003` — canonical full-package identity
- `BUILDER-TRX-004` — package prose remains non-executable
- `BUILDER-TRX-005` — exact decision-lineage preservation
- `BUILDER-TRX-006` — no mixed-lineage success
- `BUILDER-TRX-007` — full Confirmation and Action-semantic binding
- `BUILDER-TRX-008` — canonical Action Batch, Session State, and Checkpoint consistency
- `BUILDER-TRX-009` — exact retained machine-evidence binding
- `BUILDER-TRX-010` — fail-closed fallback and Repair Packet behavior
- `BUILDER-TRX-011` — canonical Completion hierarchy and Session State transition
- `BUILDER-TRX-012` — deterministic structural and reference failure
- `BUILDER-TRX-013` — source/output isolation and safe atomic publication
- `BUILDER-TRX-014` — canonical central runner and shard workflow enforcement

## Mutation Coverage

The transaction fixture registry contains 26 negative cross-carrier mutations and one exact positive control. It covers:

- missing canonical Action Batch, Session State, and Checkpoint fields;
- shadow carrier substitution;
- source/package substitution;
- stale or divergent canonical package identity;
- unchanged Action IDs with changed target, class scope, value, or Evidence requirements;
- fabricated provenance and self-asserted path-equivalence fields;
- actual CE adapter-output mismatch;
- Confirmation replay after semantic mutation;
- stale Checkpoint action-set binding;
- incomplete final Session State and detached Completion compensation;
- Session/package identity mismatch;
- Evidence/Action digest mismatch;
- source-byte digest mismatch;
- unsafe carrier references;
- unverified Runtime provenance;
- canonical transaction task removal from the shared validation registry.

The sharding regression suite separately mutates task identity, task count, exact arguments, shard assignment, matrix discovery, matrix consumption, shard execution, exact-SHA checks, and final aggregation.

## Shared Central and CI Enforcement

`scripts/validate.mjs` is the single validation registry. It owns task identity, exact arguments, canonical order, and shard assignment.

`canonicalShardTaskContracts` pins these exact tasks:

```text
node:scripts/validate-builder-runtime-transaction.mjs
  executable: node
  args:
    - scripts/validate-builder-runtime-transaction.mjs
    - tests/valid/runtime-transaction/complete-transaction.json
    - --self-test
  shard: runtime-transaction

node:scripts/validate-builder-runtime-transaction-state.mjs
  executable: node
  args:
    - scripts/validate-builder-runtime-transaction-state.mjs
    - tests/valid/runtime-transaction/complete-transaction.json
  shard: runtime-transaction-state
```

`validateShardExecutionContract()` validates the canonical task identities and the executable workflow topology. The transaction validator imports and calls that same function. It does not maintain a second workflow-string authority.

The `Schema validation` workflow:

```text
discover validation shards
→ validation / runtime-transaction
→ validation / runtime-transaction-state
→ validate
```

Both transaction jobs are required members of the dynamic matrix. They check out the same exact tested SHA as every other shard. The final `validate` job succeeds only if discovery and the complete matrix succeed.

The workflow does not run a serial `npm run validate` followed by duplicate hard-coded transaction commands. Local `npm run validate` remains the complete ordered local interface; GitHub Actions executes the same canonical inventory through required shards.

Focused commands:

```bash
node --check scripts/validate-builder-runtime-transaction.mjs
node --check scripts/validate-builder-runtime-transaction-state.mjs
node scripts/validate-builder-runtime-transaction.mjs tests/valid/runtime-transaction/complete-transaction.json --self-test
node scripts/validate-builder-runtime-transaction-state.mjs tests/valid/runtime-transaction/complete-transaction.json
node scripts/validate.mjs --shard runtime-transaction
node scripts/validate.mjs --shard runtime-transaction-state
node scripts/test-validation-sharding.mjs sharedContractMutations
```

## Compatibility and Limits

- Existing public Schemas and package version `0.3.6` remain unchanged.
- Builder receives no architecture, design-decision, Responsive, deployment, or production authority.
- `production_ready` remains false.
- No real non-synthetic Project Gate or CE handoff is claimed.
- No real Elementor execution is claimed.
- Formal Builder-to-Responsive export remains unimplemented.
- Exact-SHA CI is maintenance correctness evidence, not Runtime authorization.
- Active repository authority sets `independent_review_required: false`, `pr_inspector_required: false`, and `exact_head_runtime_authority: false`.
- Owner review and merge remain maintenance authority.
