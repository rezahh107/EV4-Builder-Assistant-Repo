# protocols/CLASS_APPLICATION_SAFETY

Version: 0.1.0
Status: active_initial
Purpose: prevent class drift and wrong-scope styling in Elementor

---

## Core Rule

Before any styling or setting change, verify the selected element and active class.

```text
Wrong element or wrong class = stop first, correct second, then continue.
```

---

## Approved Class Rule

In `APPROVED_HANDOFF_MODE`, class names come from `Builder_Context_Package.class_creation_application_map`.

Do not:

```text
- invent class names;
- rename approved classes;
- remove approved classes;
- apply approved class to a different element than mapped;
- create a variant class unless the package allows it;
- add a dot in Elementor CSS Classes field.
```

---

## Pre-Change Checklist

Before changing styles/settings, identify:

```text
Selected element
Structure Panel name
Active class chip
Approved class expected for this element
Whether change is shared or unique
Whether class is Local or Global when known
Properties that must not change
```

---

## Local vs Global Safety

If a change is shared across repeated elements, prefer the approved shared class.

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
2. Tell user to select the correct element/class.
3. Do not apply settings.
4. Ask for confirmation or screenshot after correction.
```

---

## Class Map Output

When instructing class application:

```text
Element: [Structure Panel name]
Class to apply: [class_name]
Field: CSS Classes
Reminder: class را بدون نقطه وارد کن.
Do not change: [list]
```

---

## Completion Check

Before marking classes complete, verify:

```text
- every required approved class is applied;
- no unapproved class was added by assistant instruction;
- repeated elements share the correct repeated class;
- one-off elements do not accidentally share repeated classes;
- class names are spelled exactly.
```
