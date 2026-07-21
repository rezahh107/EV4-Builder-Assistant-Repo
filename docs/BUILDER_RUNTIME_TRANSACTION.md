# Builder Runtime Transaction Enforcement

Status: validation-only canonical composition
Public contract version impact: none
Canonical validator: `scripts/validate-builder-runtime-transaction.mjs`
Canonical transaction input: `tests/valid/runtime-transaction/complete-transaction.json`

## Purpose

This layer composes existing Builder contracts. It does not define replacement Builder Context, Action Batch, Session State, Checkpoint, evidence, completion, or publication carriers.

Each transaction envelope contains only immutable repository references and cross-carrier bindings. The referenced artifacts must independently pass their existing JSON Schema and semantic validators before composite validation begins.

The supported source paths remain:

```text
Project Gate builder-input.json
  -> exact source-byte parsing
  -> canonical Builder Context validation
  -> canonical package digest

controlled CE package
  -> CE-to-Builder Contract Gate
  -> independently executed Builder adapter
  -> exact comparison with consumed Builder Context Package
  -> canonical package digest
```

`project-gate-c2b-receipt.json` remains separate audit evidence and cannot become semantic Builder input. Caller-provided `verified=true`, provenance-looking JSON, path-equivalence pass strings, or workflow labels are not accepted as capabilities.

## Canonical transaction members

The positive transaction uses actual canonical carriers:

- `ev4-builder-context-package@1.0.0`
- `ev4-action-batch@1.0.0`
- initial and final `ev4-builder-session-state@0.1.0` snapshots
- initial and final `ev4-builder-checkpoint@0.2.0` snapshots
- `ev4-completion-status@1.0.0`
- `ev4-completion-gate@0.1.0`
- retained machine-readable execution evidence

The source artifact is parsed from its exact bytes. The same artifact is the consumed Builder package on the Project Gate path. The canonical package identity is SHA-256 over `canonical_package_without_digest`, matching the existing Builder package validator.

## Cross-carrier identity

One transaction binds:

- exact source bytes;
- full canonical package digest;
- full ordered canonical action-set digest;
- per-action canonical digests;
- confirmation ID, user token, action IDs, and action bodies;
- initial and final Session State carrier byte hashes;
- initial and final Checkpoint carrier byte hashes;
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

Canonical validation derives evidence rather than trusting envelope assertions:

- `git ls-files --error-unmatch` proves that the captured source fixture is part of the checked-out exact Head;
- the source byte hash is recomputed;
- the Builder package schema and semantic validator execute as child processes;
- each canonical downstream carrier executes its existing schema and semantic validator;
- the direct CE path executes the actual CE-to-Builder normalizer and compares its output with the consumed Builder package;
- no equivalence claim is accepted unless the relevant executable path is actually run.

## Enforced invariants

- `BUILDER-TRX-001` — exact semantic source isolation
- `BUILDER-TRX-002` — independently executed CE path verification
- `BUILDER-TRX-003` — full canonical package identity
- `BUILDER-TRX-004` — package prose remains non-executable
- `BUILDER-TRX-005` — exact decision-lineage preservation
- `BUILDER-TRX-006` — no mixed-lineage success
- `BUILDER-TRX-007` — full confirmation and action-semantic binding
- `BUILDER-TRX-008` — canonical Action Batch, Session State, and Checkpoint consistency
- `BUILDER-TRX-009` — exact retained machine-evidence binding
- `BUILDER-TRX-010` — fail-closed fallback and Repair Packet behavior remains preserved
- `BUILDER-TRX-011` — canonical completion hierarchy and Session State transition
- `BUILDER-TRX-012` — deterministic structural failure
- `BUILDER-TRX-013` — source/output isolation and safe atomic publication
- `BUILDER-TRX-014` — central enforcement truthfulness

## Mutation coverage

The focused registry contains 23 negative cross-carrier mutations and one exact positive control. It covers:

- missing required canonical Action Batch, Session State, and Checkpoint fields;
- shadow carrier substitution;
- source/package substitution;
- stale full-package identity;
- unchanged action IDs with changed target, class scope, value, or evidence requirements;
- fabricated provenance and self-asserted path-equivalence fields;
- confirmation replay after semantic mutation;
- stale checkpoint action-set binding;
- incomplete final Session State;
- detached completion compensation;
- session/package identity mismatch;
- evidence/action digest mismatch;
- source-byte digest mismatch;
- central validator bypass.

## Central enforcement

`scripts/validate.mjs` explicitly executes:

```text
node scripts/validate-builder-runtime-transaction.mjs tests/valid/runtime-transaction/complete-transaction.json --self-test
node scripts/validate-builder-runtime-transaction-state.mjs tests/valid/runtime-transaction/complete-transaction.json
```

The existing `Schema validation` workflow runs `npm run validate`, so exact-head CI exercises the actual transaction input rather than a validator-owned shadow object.

## Compatibility and limits

- Existing public schemas and package version `0.3.6` remain unchanged.
- Builder receives no architecture, design-decision, Responsive, deployment, or production authority.
- `production_ready` remains false.
- No real CE-to-Builder handoff or Elementor execution is claimed by the synthetic validation fixture.
- Formal Builder-to-Responsive export remains unimplemented.
- Fresh independent PR Inspector review is required for every resulting Head.
