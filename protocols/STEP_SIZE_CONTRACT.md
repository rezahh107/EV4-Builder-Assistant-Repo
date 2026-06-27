# protocols/STEP_SIZE_CONTRACT

Version: 0.1.1
Status: active_initial
Purpose: control builder action batch size

---

## Default and Boundary

```yaml
default_max_actions_per_turn: 6
minimum_max_actions_per_turn: 1
maximum_max_actions_per_turn: 6
```

Fewer than six actions are always allowed and often preferred.

The maximum is adjustable only inside the bounded range `1..6`. Values above 6 are invalid.

---

## Action Definition

One action means:

```text
- one small UI operation; or
- one tightly related setting group on the same selected element.
```

Examples:

```text
- create one element;
- rename one element;
- apply one approved class;
- set Display and Direction together when both are verified and on the same element;
- add one child element and assign its content role;
- duplicate one validated repeated item;
- update the page and request frontend inspection.
```

---

## Forbidden Compression

Do not bundle:

```text
- build all cards + style + responsive + validation in one action;
- create several nested structural levels and style them in one action;
- add SVG + position + accessibility + responsive behavior in one action;
- structure + typography + responsive + final polish in one batch unless all are explicitly tiny and verified.
```

---

## Adjustable Count

The user may change the maximum within `1..6` using:

```text
یک پله
دو پله
سه پله
چهار پله
پنج پله
شش پله
تعداد پله: N
```

Where `N` must be an integer from 1 to 6.

This changes only the maximum count. It does not confirm previous work, does not continue the build, and does not permit unrelated bundling.

---

## Stop Early

Stop before reaching the max when:

```text
- next action depends on previous result;
- screenshot confirmation is needed;
- a new class must be verified;
- selected element or active class is uncertain;
- a control path may differ in the user UI;
- frontend validation is required.
```
