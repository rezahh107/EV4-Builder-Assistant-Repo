# Builder Runtime Transaction Enforcement

Status: validation-only canonical composition
Public contract version impact: none
Canonical validator: `scripts/validate-builder-runtime-transaction.mjs`
Canonical transaction input: `tests/valid/runtime-transaction/complete-transaction.json`

## Purpose

This layer composes existing Builder contracts. It does not define replacement Builder Context, Action Batch, Session State, Checkpoint, evidence, completion, or publication carriers.

Each transaction envelope contains immutable repository-relative references and cross-carrier bindings. Every referenced carrier must independently pass its existing JSON Schema and semantic validator before composite validation begins.

The supported semantic paths remain:

```text
Project Gate builder-input.json
  -> exact source-byte parsing
  -> canonical Builder Context validation
  -> canonical full-package digest

controlled CE package
  -> CE-to-Builder Contract Gate
  -> independently executed Builder adapter
  -> exact comparison with consumed Builder Context Package
  -> canonical full-package digest
```

`project-gate-c2b-receipt.json` remains separate audit evidence and cannot become semantic Builder input. Caller-provided `verified=true`, provenance-looking JSON, path-equivalence pass strings, or workflow labels are not capabilities.

## Canonical transaction members

The positive fixture references actual canonical carriers:

- `ev4-builder-context-package@1.0.0`
- `ev4-action-batch@1.0.0`
- initial and final `ev4-builder-session-state@0.1.0` snapshots
- initial and final `ev4-builder-checkpoint@0.2.0` snapshots
- `ev4-completion-status@1.0.0`
- `ev4-completion-gate@0.1.0`
- retained machine-readable execution evidence

Unsafe, absolute, non-canonical, or repository-escaping references fail before child validators are invoked. The source artifact is parsed from exact bytes. On the Project Gate-shaped fixture path, the same bytes are the consumed Builder package.

The canonical package identity is SHA-256 over `canonical_package_without_digest`. The composite digest must match both its own recomputation and `input_authorization.package_digest`, which is independently enforced by the existing Builder package validator.

## Cross-carrier identity

One transaction binds:

- exact source bytes;
- full canonical package digest;
- full ordered canonical action-set digest;
- per-action canonical digests;
- confirmation ID, user token, action IDs, and action bodies;
- initial and final Session State byte hashes;
- initial and final Checkpoint byte hashes;
- session ID and selected candidate;
- retained evidence bytes;
- completion to the exact final Session State and final Checkpoint.

Action identity is not reduced to `action_id`. Target, element type, class, Local/Global class scope, executable value, evidence requirements, expected result, and decision lineage are part of the canonical action digest.

## Session completion model

The transaction stores two canonical Session State snapshots:

```text
WAITING_FOR_CONFIRMATION
  -> confirmed canonical Action Batch
  -> evidence-backed final checkpoint
  -> COMPLETED
```

Both snapshots share the transaction session ID and full package digest. The final snapshot embeds the exact final checkpoint. `session_complete=true` or `builder_build_complete=true` fails unless the actual final canonical Session State has both `runtime_state` and `current_state` equal to `COMPLETED`.

A detached completion string or field cannot compensate for a stale Session State carrier.

## Provenance and equivalence boundary

The fixture is explicitly `synthetic_validation_only`. It proves contract composition and mutation resistance, not a real Project Gate handoff, real CE handoff, or real Elementor execution.

Validation derives evidence instead of trusting envelope assertions:

- `git ls-files --error-unmatch` proves that the synthetic source fixture belongs to the exact checked-out Head;
- the source byte hash is recomputed;
- every canonical carrier executes its existing schema and semantic validator;
- the direct CE mutation executes the actual CE-to-Builder normalizer and compares its complete output;
- self-asserted equivalence or provenance fields are rejected;
- `runtime_evidence` fails closed until an independently verified producer-provenance capability is implemented.

Therefore no repository-local label is treated as proof that an artifact was actually emitted by Project Gate or CE.

## Enforced invariants

- `BUILDER-TRX-001` — exact semantic source isolation
- `BUILDER-TRX-002` — independently executed CE-path comparison and fail-closed runtime provenance
- `BUILDER-TRX-003` — canonical full-package identity
- `BUILDER-TRX-004` — package prose remains non-executable
- `BUILDER-TRX-005` — exact decision-lineage preservation
- `BUILDER-TRX-006` — no mixed-lineage success
- `BUILDER-TRX-007` — full confirmation and action-semantic binding
- `BUILDER-TRX-008` — canonical Action Batch, Session State, and Checkpoint consistency
- `BUILDER-TRX-009` — exact retained machine-evidence binding
- `BUILDER-TRX-010` — fail-closed fallback and Repair Packet behavior remains preserved
- `BUILDER-TRX-011` — canonical completion hierarchy and Session State transition
- `BUILDER-TRX-012` — deterministic structural and reference failure
- `BUILDER-TRX-013` — source/output isolation and safe atomic publication
- `BUILDER-TRX-014` — central and independent workflow enforcement truthfulness

## Mutation coverage

The focused registry contains 26 negative cross-carrier mutations and one exact positive control. It covers:

- missing required canonical Action Batch, Session State, and Checkpoint fields;
- shadow carrier substitution;
- source/package substitution;
- stale or divergent canonical package identity;
- unchanged action IDs with changed target, class scope, value, or evidence requirements;
- fabricated provenance and self-asserted path-equivalence fields;
- actual CE adapter-output mismatch;
- confirmation replay after semantic mutation;
- stale checkpoint action-set binding;
- incomplete final Session State and detached completion compensation;
- session/package identity mismatch;
- evidence/action digest mismatch;
- source-byte digest mismatch;
- unsafe carrier references;
- unverified runtime provenance;
- central validator bypass.

## Central enforcement

`scripts/validate.mjs` explicitly executes the canonical transaction and state validators. The `Schema validation` workflow independently repeats syntax checks, the full canonical transaction validation with mutation self-test, and final-state validation after `npm run validate`.

```text
node --check scripts/validate-builder-runtime-transaction.mjs
node --check scripts/validate-builder-runtime-transaction-state.mjs
node scripts/validate-builder-runtime-transaction.mjs tests/valid/runtime-transaction/complete-transaction.json --self-test
node scripts/validate-builder-runtime-transaction-state.mjs tests/valid/runtime-transaction/complete-transaction.json
```

## Compatibility and limits

- Existing public schemas and package version `0.3.6` remain unchanged.
- Builder receives no architecture, design-decision, Responsive, deployment, or production authority.
- `production_ready` remains false.
- No real non-synthetic Project Gate or CE handoff is claimed.
- No real Elementor execution is claimed.
- Formal Builder-to-Responsive export remains unimplemented.
- Fresh independent PR Inspector review is required for every resulting Head.
