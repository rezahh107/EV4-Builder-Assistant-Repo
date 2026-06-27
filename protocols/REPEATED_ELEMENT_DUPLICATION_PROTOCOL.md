# protocols/REPEATED_ELEMENT_DUPLICATION_PROTOCOL

Version: 0.1.0
Status: active
Purpose: prevent unnecessary rebuilding and class drift in repeated patterns

---

## Core Rule

Build one representative repeated item first. Validate it. Then duplicate it.

---

## Sequence

```text
1. Build one complete representative item.
2. Verify Structure Panel placement.
3. Verify approved classes.
4. Verify Local vs Global class status.
5. Verify frontend/editor result when needed.
6. Duplicate the verified item.
7. Replace only unique content, icon, asset, or local position.
8. Preserve shared classes.
9. Re-check one duplicated item.
```

---

## Do Not

```text
rebuild every card manually
rename approved shared classes
change shared class settings for one unique item
mix unique content into Global Class
assume Dynamic Loop only because items repeat
assume repeated cards are clickable
```

---

## Unique Changes Allowed After Duplication

```text
text content
image/SVG asset
alt text or aria label when meaningful
local order or local position when approved
local class only when the item is intentionally different
```

---

## Confirmation

After duplicating repeated items, request either:

```text
Structure Panel screenshot
or frontend screenshot
or exact confirmation sentence
```

---

## Smart Home Application

For Smart Home feature cards:

```text
build Feature Card 01
verify card structure and classes
duplicate for remaining cards
replace only unique icon/title/subtitle
preserve shared card classes
```
