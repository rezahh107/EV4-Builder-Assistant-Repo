# READ_ONLY_DIAGNOSTIC_EVIDENCE

Version: 0.1.0
Status: active
Purpose: allow supplemental rendered DOM/computed-style evidence without runtime JavaScript generation.

---

## Core Rule

Builder may request console diagnostic JSON only in evidence/correction flows:

```text
CORRECTION
EVIDENCE_REQUIRED
insufficient_evidence
repair
claim_level_verification
```

Diagnostic JavaScript must come only from `data/diagnostic-templates.v1.json`.

Builder must not invent a new IIFE, custom JavaScript, selector logic, mutation logic, or delayed code in normal runtime responses.

---

## Evidence Sources

Screenshot evidence proves visible Elementor UI claims:

```text
selected element name
visible Local Classes / Global Classes UI
active panel controls
responsive mode
panel-only values
```

Console diagnostic JSON may support rendered DOM/computed-style claims:

```text
classList
bounding box
computed padding / width / min-height
display / flex / grid
transform
z-index
overflow
rendered icon size and offset
```

Console JSON does not prove hidden Elementor panel values unless reflected in DOM/CSS or shown in screenshot.

---

## Template Registry

Allowed template registry:

```text
data/diagnostic-templates.v1.json
```

Current template:

```yaml
template_id: elementor_rendered_dom_computed_v1
mode: read_only
tokens:
  - label
  - selector
```

All templates are validated by:

```text
scripts/validate-diagnostic-templates.mjs
schemas/diagnostic-template.schema.json
```

---

## Token Sanitization

Before outputting a diagnostic snippet, Builder must validate tokens.

Selector allowlist:

```text
^[A-Za-z0-9_.#\- >]+$
```

Valid selectors:

```text
.smart-home__feature-card--default
.smart-home__card-icon--default
#smart-home-section .smart-home__feature-card--default
.a > .b
```

Invalid selectors include quotes, semicolons, brackets, equals signs, colon, comma, slash, backslash, newline, or script/network/storage terms.

Labels must be short plain human-readable text and must not contain code delimiters or control characters.

If a token fails validation, do not provide the snippet. Route to `insufficient_evidence` / `CORRECTION` and ask for a corrected selector or screenshot.

---

## Read-Only Boundary

The template may read rendered DOM, classList, selected safe attributes, getComputedStyle, getBoundingClientRect, viewport, and execution context.

It must not mutate DOM, CSS, classes, storage, cookies, forms, editor state, or network.

Forbidden in templates:

```text
fetch(
XMLHttpRequest
sendBeacon
WebSocket
eval(
new Function
localStorage.setItem
sessionStorage.setItem
document.cookie =
classList.add / remove / toggle
.style =
insertAdjacentHTML
innerHTML = / outerHTML =
appendChild
remove()
click()
submit()
wp.data.dispatch
setTimeout(
setInterval(
```

---

## Diagnostic Output

Pasted diagnostic JSON must validate against:

```text
schemas/diagnostic-evidence-output.schema.json
scripts/validate-diagnostic-evidence-schema.mjs
```

Required output includes:

```text
diagnosticType
templateId
templateVersion
timestamp
url
executionContext
viewport
limitation
targets[].label
targets[].selector
targets[].matchCount
targets[].matches
targets[].truncated
```

If any target has `matchCount: 0`, evidence is insufficient. Ask for corrected context, selector, or screenshot. Do not treat it as confirmation.

---

## User-Facing Request Shape

Keep Persian concise:

```text
برای این مرحله screenshot لازم است؛ ولی برای مقدارهای rendered مثل padding، width، min-height، transform و box size کافی نیست.

لطفاً دو چیز بفرست:
1. screenshot هدفمند از Elementor panel
2. خروجی JSON کد diagnostic زیر از Console

این کد read-only است و چیزی را تغییر نمی‌دهد.
خروجی آن فقط rendered DOM/computed-style evidence است و hidden Elementor panel values را ثابت نمی‌کند، مگر اینکه در screenshot دیده شوند یا در DOM/CSS منعکس شده باشند.
```

Do not include diagnostic code in normal active builder batches.
