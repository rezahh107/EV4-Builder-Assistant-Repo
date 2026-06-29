# protocols/INLINE_VALUE_RATIONALE

Version: 0.1.0
Status: active
Purpose: require short user-facing reasons beside non-obvious executable values without replacing evidence, validation, or repair gates.

---

## Core Rule

When Builder emits a non-obvious executable value in a user-facing build batch, include a short inline rationale beside the value.

The rationale explains the safe source or intent of an already-safe emitted value. It must not justify an unsafe value, replace evidence, or bypass validation.

Examples:

```text
Width: 32% (relative to overlay; safer than intrinsic px)
Height: AUTO (preserves SVG aspect ratio)
Object fit: Contain (keeps full connector visible)
Position: Absolute (allows independent placement inside overlay holder)
```

---

## Required When

Inline rationale is required for non-obvious values in these categories:

```text
numeric size values
position offsets
unit choices
object fit choices
aspect ratio choices
z-index
transform / scale / rotate
responsive values
overlay / SVG visual calibration values
values derived from temporary calibration, measured layout, user confirmation, or visible UI
```

If the value affects layout, position, overlay geometry, SVG sizing, responsive behavior, or visual calibration, assume the rationale is required unless it is obviously copied from an approved package and not being interpreted.

---

## Optional When

Inline rationale is optional for:

```text
obvious structure actions
class names
element names
values directly copied from an approved package without interpretation
purely mechanical confirmations
```

Do not add rationale noise to every field. Use it only where the user may reasonably ask, “why this value?”

---

## Rationale Length And Style

A rationale must be:

```text
one short phrase only
roughly 12–20 words maximum
Persian user-facing text, with English technical identifiers preserved
based on available evidence or stated strategy
```

A rationale must not be:

```text
a long teaching explanation
hidden chain-of-thought
speculation beyond evidence
a substitute for missing evidence
an excuse for unsafe intrinsic sizing
an extra footer after a batch confirmation token or screenshot request
```

---

## Bad Examples

```text
Width: 480px (because the SVG file is 480 wide)
Height: 144px (because the source SVG is 144 high)
```

Invalid: intrinsic asset size is not layout intent and must not be emitted as executable layout size by itself.

```text
Top: 8% (probably looks good)
```

Invalid: speculative visual preference without evidence, calibration, or scope.

---

## Good Examples

```text
Width: 32% (relative to overlay; safer than intrinsic px)
Height: AUTO (preserves SVG aspect ratio)
Object fit: Contain (keeps full connector visible)
Top: 8% (desktop-only calibration from visible canvas)
Z-index: 1 (keeps connector behind content if layering requires it)
```

---

## Interaction With UNIT_STRATEGY_GATE

`protocols/UNIT_STRATEGY_GATE.md` remains authoritative for numeric layout and position values.

```text
- Inline rationale does not replace unit strategy validation.
- If unit strategy is unresolved, Builder must ask for targeted evidence instead of emitting the value.
- Rationale explains a safe emitted value; it must not justify an unsafe value.
- Intrinsic asset dimensions may inform aspect ratio only; they are not layout intent.
```

If a value cannot pass `UNIT_STRATEGY_GATE`, do not add a rationale and continue. Enter evidence request or `CORRECTION` according to the existing runtime rules.

---

## Interaction With BATCH_COMPACTION_CONTRACT

`protocols/BATCH_COMPACTION_CONTRACT.md` still controls when compact batches are allowed.

```text
- Compact batches may include inline rationales.
- Rationale must remain short so compact batches stay readable.
- Do not split batches only to explain values.
- Do not use rationale to hide unresolved strategy decisions inside a compact batch.
```

---

## Interaction With Active Builder Batch Endings

Inline rationales are allowed inside the batch action fields.

Do not add an extra footer after the required confirmation token or targeted screenshot request. Batch-ending precedence remains controlled by:

```text
protocols/BUILDER_BATCH_OUTPUT_FORMAT.md
protocols/USER_FACING_RESPONSE_POLICY.md
protocols/UX_PRECEDENCE_TABLE.md
```

---

## Minimal Builder Output Pattern

Use compact inline formatting:

```text
Width: 32% (relative to overlay; safer than intrinsic px)
Height: AUTO (preserves SVG aspect ratio)
Object fit: Contain (keeps full connector visible)
```

Do not expand into a separate explanation paragraph unless the user asks for `جزئیات` or `جزئیات فنی`.
