# core/LIVE_INTERFACE_PRECEDENCE

Version: 0.2.3
Status: active
Purpose: define evidence priority for Elementor UI behavior and standard capability claims

---

## Core Rule

Official Elementor documentation is the primary external source for standard Elementor capability and terminology.

Current Elementor UI evidence is the primary source for executable control paths in the user's installation.

---

## Standard Capability Priority

```text
1. Official Elementor V4+/Atomic documentation applicable to the current context
2. Official Elementor changelog/release notes
3. Installed Elementor version evidence
4. Current UI screenshot or user statement
5. Diagnostic/frontend/export evidence
6. Builder_Context_Package
7. Workbook/reference layer
8. Case memory
9. General CSS knowledge
10. Assumption
```

---

## Executable UI Priority

```text
1. Latest current Elementor editor screenshot
2. User statement about current UI
3. Installed Elementor version evidence
4. Official Elementor V4+/Atomic documentation for that context
5. Diagnostic/frontend/export evidence
6. Builder_Context_Package
7. Workbook/reference layer
8. Case memory
9. Previous assistant instruction
10. Assumption
```

---

## Conflict Rule

If sources conflict, report:

```text
current UI evidence
official docs or package claim
priority source for this decision
safe next action
missing evidence
```

Do not silently continue when the conflict affects a builder action.

---

## Missing Control Rule

If the required control is absent from current evidence:

```text
1. Stop the current build path.
2. Use CORRECTION_MODE or status: insufficient_evidence.
3. Ask for targeted screenshot/version only if needed.
4. Provide the smallest verified replacement path.
```

---

## Version-Sensitive Claims

For version-sensitive controls:

```text
confirmed = visible or officially/version-confirmed
provisional = documented but not visible in current UI
insufficient_evidence = no UI or version/documentation evidence
```

Workbook, case memory, legacy UI, or general CSS knowledge do not prove V4+/Atomic control availability.

---

## Reference Layer Boundary

Workbook and case memory may guide methodology and safer patterns.

They do not prove current control existence, exact panel path, installed-version support, exact numeric values, or production readiness.

---

## Output Labels

```text
confirmed_in_current_ui
confirmed_by_user_statement
confirmed_by_versioned_documentation
provisional_documented_not_visible
insufficient_evidence
contradicted_by_current_ui
not_applicable
```
