# protocols/CLASS_APPLICATION_SAFETY

Version: 0.1.1
Status: active_elementor_scope_required
Purpose: prevent class drift and wrong-scope styling in Elementor

---

## Core Rule

Before any styling or setting change, verify the selected element, active class, and Elementor class placement scope.

```text
Wrong element, wrong class, or unknown Local/Global scope = stop first, correct second, then continue.
```

---

## Approved Class Rule

In `APPROVED_HANDOFF_MODE`, class names come from `Builder_Context_Package.class_creation_application_map` or the newer Builder Executable Package equivalent.

Do not:

```text
- invent class names;
- rename approved classes;
- remove approved classes;
- apply approved class to a different element than mapped;
- create a variant class unless the package allows it;
- add a dot in Elementor CSS Classes field;
- silently choose Local Classes or Global Classes when the package/contract does not support that placement.
```

---

## Pre-Change Checklist

Before changing styles/settings, identify:

```text
Selected element
Structure Panel name
Active class chip
Approved class expected for this element
Elementor class scope: Local Classes or Global Classes
Whether change is shared or unique
Properties that must not change
```

---

## Elementor Local vs Global Scope Policy

This policy is about where the user enters the class in the Elementor UI. It is not a general CSS architecture rule.

```yaml
Local Classes:
  use_for:
    - element-specific classes
    - section-specific classes
    - component-specific classes
    - BEM-style classes from an approved section package
    - one-off classes applied directly to a selected Elementor element

Global Classes:
  use_for:
    - reusable design-system classes
    - theme-level classes
    - shared utility classes
    - classes explicitly marked reusable across multiple elements/pages by the executable package
```

For Smart Home approved component classes such as `smart-home__feature-card--default`, use `Local Classes` unless the executable package explicitly marks the class as `Global Classes`.

If scope is absent and cannot be safely derived from a schema/contract default, the Builder must report insufficient evidence instead of guessing.

---

## Local vs Global Safety

If a change is shared across repeated elements, prefer the approved shared class, but still respect its Elementor placement scope.

If a change is unique to one element, do not modify a shared class unless user explicitly approves the shared impact.

When moving styles from Local to Global:

```text
1. Add/activate approved Global Class.
2. Apply shared properties.
3. Validate the result.
4. Reset duplicate Local properties only with confirmation.
5. Do not delete Local Class automatically.
```

---

## Wrong Class Active

If screenshot or user statement shows the wrong class is active:

```text
1. Stop.
2. Tell user to select the correct element/class/scope.
3. Do not apply settings.
4. Ask for confirmation or screenshot after correction.
```

---

## Class Map Output

When instructing class application, include the Elementor class scope directly beside or immediately near the class name:

```text
Element: [Structure Panel name]
Class to apply: [class_name]
Elementor class scope: Local Classes | Global Classes
Reminder: class را بدون نقطه وارد کن.
Do not change: [list]
```

Normal Persian builder output should use:

```text
کلاس Elementor:
[class_name]
محل ثبت:
Local Classes
```

or:

```text
کلاس Elementor:
[class_name]
محل ثبت:
Global Classes
```

Bare class output is invalid:

```text
کلاس:
[class_name]
```

---

## Completion Check

Before marking classes complete, verify:

```text
- every required approved class is applied;
- every actionable class instruction included Local Classes or Global Classes;
- no unapproved class was added by assistant instruction;
- repeated elements share the correct repeated class;
- one-off elements do not accidentally share repeated classes;
- class names are spelled exactly;
- class scope matches the package/contract and was not invented at runtime.
```
