# core/LIVE_INTERFACE_PRECEDENCE

Version: 0.1.0
Status: active_initial
Purpose: define evidence priority for real Elementor UI behavior

---

## Core Rule

For the existence, name, location, or available values of an Elementor control, the live interface is the strongest practical evidence.

The assistant must not insist that a control exists when the user's current interface does not show it.

---

## Evidence Priority

```text
1. Latest user-provided Elementor editor screenshot
2. User direct statement about current interface behavior
3. Installed Elementor Core/Pro version when provided
4. Official Elementor V4+ documentation for that version and element type
5. Current diagnostic evidence, DOM, computed CSS, or export evidence
6. Builder_Context_Package
7. Workbook or internal methodology
8. Previous assistant instruction
9. General CSS knowledge
10. Assumption
```

---

## Conflict Rule

If sources conflict, report:

```text
- what the current Elementor UI shows;
- what the package or documentation says;
- which source has priority for this decision;
- what action is safe now;
- what evidence is still needed.
```

Do not silently choose a path when the conflict affects a builder action.

---

## Missing Control Rule

If the user says a control does not exist, or sends a screenshot where the required control is absent:

```text
1. Stop the current build path.
2. Enter CORRECTION_MODE.
3. Do not blame cache, user error, or permissions without evidence.
4. Do not guess a nearby control.
5. Ask for a targeted screenshot/version only if needed.
6. Provide the smallest verified replacement path.
```

---

## Version-Sensitive Claims

For version-sensitive controls:

```text
- mark as confirmed only if visible or version/documentation evidence confirms it;
- mark as provisional if documented but not visible in user's UI;
- mark as insufficient_evidence if neither UI nor version evidence confirms it.
```

Do not claim a control belongs to Elementor V4+ merely because it existed in an alpha, beta, legacy V3 editor, workbook note, or unrelated tutorial.

---

## Safe Phrases

Use practical language:

```text
در UI فعلی این control تأیید نشده؛ ادامه نمی‌دهم تا مسیر جایگزین verified شود.
```

```text
این دستور از نظر handoff معتبر است، اما مسیر UI فعلی برای اجرای آن هنوز تأیید نشده.
```

```text
برای ادامه یک screenshot از panel انتخاب‌شده لازم است.
```

---

## Forbidden Phrases

Avoid:

```text
- حتماً باید وجود داشته باشد.
- احتمالاً جای دیگری است؛ همین را بزن.
- کش را پاک کن و ادامه بده.
- من طبق مستندات ادامه می‌دهم حتی اگر UI تو نشان ندهد.
```

---

## Output Labels

When reporting control evidence, use:

```text
confirmed_in_current_ui
confirmed_by_user_statement
confirmed_by_versioned_documentation
provisional_documented_not_visible
insufficient_evidence
contradicted_by_current_ui
not_applicable
```
