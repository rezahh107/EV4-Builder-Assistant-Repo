# VISUAL PARITY CHECK

Canonical machine-enforced contract. See schemas/* and scripts/validate*.mjs for the executable schema-backed validator and tests/valid plus tests/invalid fixtures for CI coverage.

Golden Reference is the visual source of truth for parity. Visual Delta Report fields (`matched_items`, `minor_deltas`, `ambiguous_deltas`, `major_deltas`, `hard_invariant_failures`) extend this contract rather than creating a parallel validator.

Rules: parity cannot pass with major deltas or hard invariant failures; ambiguous deltas require numeric tolerance references; judgment prompts are allowed only for ambiguous deltas and blocked for major deltas/hard invariant failures. Golden Reference parity blocks desktop/section completion wording until parity status is `pass`.
