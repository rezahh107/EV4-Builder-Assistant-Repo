# protocols/RESPONSIVE_WORKFLOW_GUARD

Version: 0.1.0
Status: active
Purpose: prevent responsive assumptions before real evidence exists

---

## Core Rule

Do not begin responsive tuning before desktop structure is stable unless the user explicitly requests it.

A mobile screenshot or workbook example does not prove exact breakpoint values, widths, gaps, padding, order, or tablet behavior.

---

## Breakpoint Workflow

For each breakpoint:

```text
1. Inspect real output.
2. Identify structural issues.
3. Preserve validated larger-breakpoint behavior.
4. Apply the smallest responsive override.
5. Validate frontend again.
6. Record unresolved items.
```

---

## Evidence Required For Responsive Claims

```text
frontend screenshot
current Elementor responsive editor screenshot
user confirmation
computed CSS / DOM diagnostic
real export JSON / EDIS
```

---

## Do Not Assume

```text
mobile connector behavior
tablet stacking
exact breakpoint value
column order
absolute element offsets
touch spacing
text wrap
SVG scale or crop
```

---

## Safe Responsive Status Labels

```text
confirmed
not_checked
insufficient_evidence
not_applicable
```

---

## Smart Home Application

For Smart Home Connector:

```text
desktop connector lines may be built as decoration
mobile/tablet connector behavior remains unresolved
meaningful card content must not be hidden
connector lines may be simplified only after evidence or user approval
```
