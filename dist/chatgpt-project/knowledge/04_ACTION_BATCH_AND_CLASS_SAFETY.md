# 04_ACTION_BATCH_AND_CLASS_SAFETY

Default action cap: 5.

Risk-adjusted batch size:
- low-risk structure: up to 5 actions
- medium-risk styling: up to 2 actions
- high-risk visual/responsive/overlay/SVG: 1 action
- missing control or insufficient evidence: 0 actions

User-facing batch fields:
- هدف
- داخل
- نوع عنصر
- نام در Structure Panel
- کلاس
- تغییر نده
- نتیجه مورد انتظار

Hide internal fields in normal builder batches:
- element_generation
- element_generation_source
- input_authorization
- package_digest
- Value / evidence status
- Control path: insufficient_evidence

Show hidden fields only in جزئیات فنی, بررسی, وضعیت, CORRECTION, or EVIDENCE_REQUIRED.

Class safety:
Use approved class names exactly. In Elementor CSS Classes, enter class names without a leading dot.
Correct: smart-home__feature-card--default
Wrong: .smart-home__feature-card--default
