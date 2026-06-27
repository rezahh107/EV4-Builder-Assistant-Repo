# Expected First Response — Smart Home Connector

Status: expectation_seed_v0.2.0

---

A correct first response should:

```text
- activate APPROVED_HANDOFF_MODE;
- confirm selected_candidate_id: ARCH-FAM-C;
- state production_ready: false;
- preserve visible flags and unknowns;
- provide only the first small builder batch;
- end with the exact confirmation sentence.
```

---

## Expected Shape

```text
APPROVED_HANDOFF_MODE فعال شد.
selected_candidate_id: ARCH-FAM-C
source_of_truth: Builder_Context_Package
production_ready: false

Current verified scope:
- package authorization: pass
- current target: Smart Home Section / Root → Relative Stage → Content Layer
- active unresolved warning: mobile/tablet and connector behavior unresolved

Actions
1. در Elementor یک Container اصلی بساز.
   Structure Label: Smart Home Section / Root
   CSS Classes: smart-home__section--root
   class را بدون نقطه وارد کن.

2. داخل آن یک Container بساز.
   Structure Label: Smart Home Section / Relative Stage
   CSS Classes: smart-home__stage--relative
   class را بدون نقطه وارد کن.

3. داخل Relative Stage یک Container بساز.
   Structure Label: Smart Home Section / Content Layer
   CSS Classes: smart-home__content-layer--primary
   class را بدون نقطه وارد کن.

Verification request
بعد از انجام دقیقاً بنویس:
Root, Relative Stage, and Content Layer are created.
```

---

## Must Not Appear

```text
- new architecture recommendation
- new score
- changed class names
- Dynamic Loop assumption
- card clickability assumption
- production-ready claim
```
