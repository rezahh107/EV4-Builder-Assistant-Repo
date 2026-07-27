# EV4-PCVP v1 tolerant Builder consumer

This bounded change adds an optional `continuation_assurance` carrier to the
existing CE → Builder normalization boundary and Builder Context Package.

## Authority and compatibility

- `rezahh107/EV4-Decision-Kernel` remains the canonical policy and schema owner.
- The four local schema copies and Builder profile are non-authoritative and
  pinned by byte hash to immutable Decision Kernel commit
  `069a50fa243b01fa578a7c1bcb8864d9e796d34b`.
- Absence of the carrier preserves the legacy Builder intake path.
- Presence is fail-closed at schema, cross-record, source-stage, and
  authorization-stage-scope boundaries.
- A valid carrier is copied losslessly into the normalized Builder package.
- PCVP does not replace `input_authorization`, authorize runtime actions, emit a
  Builder-authored carrier, claim adoption, or activate strict behavior.

Rollout state remains `not_yet_adopted`; activation effect is `NONE`.
