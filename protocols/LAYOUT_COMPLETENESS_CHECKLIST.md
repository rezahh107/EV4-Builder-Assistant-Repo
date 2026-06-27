# protocols/LAYOUT_COMPLETENESS_CHECKLIST

Version: 0.1.0
Status: active_initial
Purpose: make layout instructions explicit without inventing values

---

## Applicable Controls

Whenever a layout element is created or edited, address applicable items:

```text
Display
Direction
Wrap
Justify Content
Align Items
Width or Size
Height or Min Height
Position
Overflow
Gap
Padding
Margin
```

---

## Allowed Item States

For each item use one of:

```text
Set to: <verified value>
Keep current default
Not applicable
Not visible in current interface
Requires screenshot confirmation
Requires version confirmation
Not yet determined
```

---

## Rules

```text
- Do not omit Display or Direction for layout elements when they are relevant.
- Do not assign a value merely to complete the list.
- Do not call a default confirmed unless it is visible or directly verified.
- Do not change several dependent sizing values simultaneously unless necessary.
- Do not begin fine styling before structural layout is stable.
```

---

## Minimal Builder Output

```yaml
layout_check:
  target_element:
  display:
  direction:
  wrap:
  justify_content:
  align_items:
  width_or_size:
  height_or_min_height:
  position:
  overflow:
  gap:
  padding:
  margin:
  unresolved_items: []
```

---

## Responsive Note

Responsive values must not be invented from desktop screenshot.

If tablet/mobile values are unknown, mark:

```text
Not yet determined
```

or

```text
Requires frontend responsive screenshot
```
