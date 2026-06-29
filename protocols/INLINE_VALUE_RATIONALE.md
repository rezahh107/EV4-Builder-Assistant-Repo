# protocols/INLINE_VALUE_RATIONALE

Version: 0.1.0
Status: active
Purpose: keep Builder numeric/value choices explainable without exposing internal package fields.

---

## Trigger

Use this protocol when a Builder batch asks the user to set a non-obvious value, numeric control, unit, spacing, position, size, timing, z-index, breakpoint, or SVG/layout-related value.

---

## User-Facing Rule

Each non-obvious value should include a short inline reason in Persian.

Use this shape:

```text
Set <control> to <value> — دلیل: <short user-facing reason>.
```

Keep the reason short. Do not include hidden schema fields, package digests, source_payload_ledger internals, or long derivations in normal Builder batches.

---

## Boundaries

```text
Allowed:
- one short reason for a value that affects layout, visual stability, or reversibility
- mention visible evidence or user-confirmed intent
- mention that a value is conservative, reversible, or aligned with the selected strategy

Not allowed in normal batches:
- hidden schema/source fields
- package hashes or payload internals
- long scoring explanations
- speculative claims without evidence
```

---

## Interaction With Existing Gates

```text
UNIT_STRATEGY_GATE must resolve unit/source strategy before numeric layout values.
LAYOUT_CHECK must resolve blocking layout controls before content/style continuation.
COMPLETION_GATE must resolve final proof before production-ready claims.
INLINE_VALUE_RATIONALE explains the chosen value after the relevant gate allows the action; it does not bypass any gate.
```
