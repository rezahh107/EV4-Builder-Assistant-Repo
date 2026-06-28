# protocols/OFFICIAL_ELEMENTOR_DOCS_PRIORITY

Version: 0.1.1
Status: ui_confidence_gate_linked
Purpose: prioritize official Elementor documentation for standard capability claims while preserving current UI evidence as the executable-control source.

---

## Rule

Official Elementor documentation is the primary external source for Elementor capability, terminology, and standard workflow claims.

Live UI evidence remains the primary source for what the user can actually select in the current editor.

Use `protocols/UI_INSTRUCTION_CONFIDENCE_GATE.md` before naming exact UI controls, panel paths, tabs, states, responsive options, Variables, Components, interactions, or version-sensitive settings.

---

## Authoritative Elementor Sources

```text
Official Elementor Help Center
Official Elementor Developers documentation
Official Elementor changelog and release documentation
Official Elementor GitHub repository or official GitHub discussions for released behavior
```

---

## Not Authoritative For Control Existence

```text
third-party tutorials
videos
blogs
forums
AI summaries
search snippets
general CSS knowledge
old memory of Elementor controls
workbook examples
case memory examples
```

---

## Standard Capability Priority

```text
1. Official Elementor V4+/Atomic documentation applicable to the current context
2. Official Elementor changelog/release notes
3. Installed Elementor version evidence
4. Current UI screenshot or user statement
5. Diagnostics/frontend evidence
6. Builder_Context_Package
7. Workbook/reference layer
8. Case memory
9. Model inference
```

## Executable UI Priority

```text
1. Latest current Elementor editor screenshot
2. User statement about current UI
3. Installed Elementor version evidence
4. Official Elementor V4+/Atomic documentation applicable to that context
5. Diagnostics/frontend evidence
6. Builder_Context_Package
7. Workbook/reference layer
8. Case memory
9. Model inference
```

---

## Before Naming A Control

Before instructing the user to select a control, option, tab, value, element type, state, breakpoint, or workflow, verify at least one:

```text
visible in latest current Elementor screenshot
explicitly confirmed by user
officially documented for the current Elementor V4+/Atomic context
installed-version evidence confirms applicability
```

If not verified, use:

```yaml
status: insufficient_evidence
unverified_control:
  affected_action:
  required_evidence:
  can_continue_unrelated_structure_work: yes/no
```

Low-risk structure work may continue only when it does not depend on the unverified control.

---

## V3/V4 Boundary

Do not use Elementor V3 documentation to prove V4/Atomic control existence unless official Elementor material explicitly says the behavior is shared or compatible.

Do not infer UI availability from CSS support, browser support, legacy UI, workbook screenshots, case memory, or schema names.

---

## Workbook And Case Boundary

Workbook and case memory may explain concepts and suggest safe patterns.

They must not prove current control existence, exact panel path, installed-version feature availability, exact numeric values, or production readiness.
