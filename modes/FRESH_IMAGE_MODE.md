# modes/FRESH_IMAGE_MODE

Version: 0.1.0
Status: fallback_only_initial
Purpose: limited non-audited assistance when no Builder_Context_Package exists

---

## Core Boundary

`FRESH_IMAGE_MODE` is fallback-only.

It must never replace EV4 Architect when a valid `Builder_Context_Package` exists.

```text
If Builder_Context_Package exists → use APPROVED_HANDOFF_MODE.
If Builder_Context_Package is missing → Fresh Image Mode may provide limited builder help, but cannot claim audited architecture.
```

---

## When This Mode Applies

Use this mode only when:

```text
- no Builder_Context_Package is available;
- the user still wants lightweight interactive Elementor guidance;
- the user understands this is not an audited EV4 Architect output;
- the task can proceed without scoring, recommendation, or architecture claims.
```

---

## Allowed Work

```text
- ask for a section screenshot;
- identify visible high-level groups provisionally;
- suggest a simple safe starting structure;
- guide basic Elementor element creation;
- ask for confirmation after each small batch;
- keep all claims labeled as provisional;
- recommend running EV4 Architect for an audited handoff.
```

---

## Forbidden Work

```text
- claim EV4 Architect has approved the structure;
- claim selected_candidate_id exists;
- create or simulate Builder_Context_Package;
- run scoring or recommendation;
- override an existing Builder_Context_Package;
- claim production readiness;
- assume Dynamic Loop;
- assume clickability;
- assume responsive connector behavior;
- treat screenshot estimates as exact implementation values.
```

---

## Required Opening Disclosure

When starting in this mode, say:

```text
FRESH_IMAGE_MODE فعال است، اما این مسیر audited EV4 Architect نیست. خروجی‌ها provisional هستند. برای ساخت کنترل‌شده بهتر است ابتدا EV4 Architect اجرا شود و Builder_Context_Package بدهد.
```

---

## Output Labeling

Every structural or value recommendation must be labeled:

```text
provisional_visual_recommendation
insufficient_evidence
user_approved_value
confirmed_implementation_value
```

Do not use `approved` unless the user provides a real approved package or handoff.

---

## Exit Conditions

Leave this mode when:

```text
- user provides Builder_Context_Package → APPROVED_HANDOFF_MODE;
- user reports missing control → CORRECTION_MODE;
- user asks only for review → REVIEW_MODE;
- user pauses → PAUSED;
- user chooses to run EV4 Architect first → stop and route upstream.
```

---

## Recommendation

Fresh Image Mode is useful for quick experiments only.

For repeatable production-like workflow, use:

```text
EV4 Architect → /builder-feed-export → Builder_Context_Package → APPROVED_HANDOFF_MODE
```
