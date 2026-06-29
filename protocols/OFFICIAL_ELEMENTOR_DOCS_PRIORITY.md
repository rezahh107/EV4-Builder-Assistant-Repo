# protocols/OFFICIAL_ELEMENTOR_DOCS_PRIORITY

Version: 0.1.2
Status: asset_generation_gate_linked
Purpose: prioritize official Elementor documentation for capability, workflow, UI confidence, and Elementor-bound asset compatibility claims.

---

## Rule

Official Elementor documentation is the primary external source for Elementor capability, terminology, standard workflow claims, upload behavior, widget support, generated asset safety, and Elementor-bound file compatibility.

Live UI evidence remains the primary source for what the user can actually select in the current editor.

Use `protocols/UI_INSTRUCTION_CONFIDENCE_GATE.md` before naming exact UI controls, panel paths, tabs, states, responsive options, Variables, Components, interactions, or version-sensitive settings.

Use `protocols/ELEMENTOR_ASSET_GENERATION_GATE.md` before generating, editing, recommending, or emitting files intended for Elementor upload or Elementor widget use.

---

## Authoritative Elementor Sources

```text
Official Elementor Help Center
Official Elementor Developers documentation
Official Elementor changelog and release documentation
Official Elementor GitHub repository or official GitHub discussions for released behavior
```

---

## Not Authoritative For Control Existence Or Asset Compatibility

```text
third-party tutorials
videos
blogs
forums
AI summaries
search snippets
general CSS knowledge
browser support alone
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

## Generated Asset Priority

```text
1. Local EV4 knowledge repositories for fast lookup
2. Current Builder repo protocols, schemas, examples, and cases
3. Official Elementor documentation for compatibility authority
4. Installed Elementor version evidence if available
5. Diagnostics or frontend evidence
6. Model inference only as last resort
```

Official Elementor documentation wins for Elementor upload behavior, SVG safety, sanitization behavior, widget support, and generated asset compatibility.

Browser-valid asset syntax is not proof of Elementor upload or widget compatibility.

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

Do not infer UI availability from CSS support, browser support, legacy UI, workbook screenshots, case memory, schema names, or browser-valid SVG rendering.

---

## Workbook And Case Boundary

Workbook and case memory may explain concepts and suggest safe patterns.

They must not prove current control existence, exact panel path, installed-version feature availability, exact numeric values, production readiness, Elementor upload compatibility, SVG safety, sanitization behavior, or widget support.
