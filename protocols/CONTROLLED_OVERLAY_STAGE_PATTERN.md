# protocols/CONTROLLED_OVERLAY_STAGE_PATTERN

Version: 0.1.0
Status: active
Purpose: preserve normal flow for meaningful content while allowing controlled decorative overlap

---

## Pattern

Use normal flow for meaningful content.

Use controlled overlay only inside a bounded stage.

---

## Meaningful Content Must Stay In Flow

```text
headings
paragraphs
buttons
cards
lists
forms
logos when meaningful
primary images when semantic
```

Do not use absolute positioning only to copy screenshot coordinates for meaningful content.

---

## Controlled Overlay Stage

Use an overlay stage only when the design requires:

```text
decorative connector lines
floating badges
decorative nodes
visual association lines
intentional layered composition
```

Required structure:

```text
Root Section
└── Relative Stage
    ├── Content Layer
    └── Decorative Overlay Layer
```

---

## Required Checks

Before overlay edits:

```text
reference parent identified
overlay content is decorative or explicitly approved
meaningful content remains readable and editable
overflow behavior known or marked unresolved
z-index order known or marked unresolved
responsive behavior not assumed
```

---

## Smart Home Application

For Smart Home Connector:

```text
feature cards and text: normal flow
central house visual: approved visual layer
connector lines: decorative overlay layer
mobile/tablet connector behavior: unresolved until evidence
```

---

## Completion Status

Overlay work cannot be marked confirmed until frontend evidence or editor evidence verifies the layer relationship.
