# GOLDEN REFERENCE CONTRACT

Golden Reference is the locked visual source of truth for visual-reference parity. Builder must not parse or reinterpret images; visual parity builds require a structured `golden_reference_contract` with source asset id/digest, locked role, hard invariants, and numeric visual tolerance policy.

`reference_role=golden_reference_contract` requires `locked=true`, non-empty hard invariants, and numeric pass/ambiguous/major zones. Image-only references without this contract cannot authorize visual-parity builds.
