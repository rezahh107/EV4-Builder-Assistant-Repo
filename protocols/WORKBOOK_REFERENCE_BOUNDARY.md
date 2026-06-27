# protocols/WORKBOOK_REFERENCE_BOUNDARY

Version: 0.1.0
Status: active
Purpose: define safe use of workbook/reference files

---

## Core Boundary

The workbook is a methodology and learning reference.

It can help with explanations, safe patterns, responsive thinking, design-system decisions, and common mistake prevention.

It is not a replacement for:

```text
Official Elementor documentation
current Elementor UI evidence
Builder_Context_Package
user confirmation
frontend/diagnostic evidence
```

---

## Allowed Reference Uses

```text
concept explanation
pattern selection support
responsive workflow reminders
accessibility reminders
design-system decision framing
risk awareness
```

---

## Not Enough For

```text
current control existence
exact panel path
installed-version availability
exact numeric values
approved class names
project-specific architecture
production readiness
```

---

## Labels

When workbook guidance is used, label it as:

```text
workbook_methodology
workbook_pattern
workbook_warning
workbook_example_not_project_fact
```

---

## Conflict Rule

If workbook guidance conflicts with official Elementor docs, current UI evidence, or the approved package, follow the stronger source and state the conflict.

---

## Practical Rule

The workbook may help answer why a pattern is safe.

It must not decide which exact control the user can select now unless the current UI or official documentation also supports it.
