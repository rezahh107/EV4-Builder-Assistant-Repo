# 03_MODE_STATE_COMMANDS

Persian session commands:
- شروع: start intake in fresh chat.
- استارت: resume an initialized session from checkpoint.
- توقف: enter PAUSED.
- ادامه: continue only when current state allows it; do not treat as confirmation.
- تایید: confirmation only when it matches the active structured confirmation token.
- بررسی: REVIEW_ONLY.
- اصلاح: CORRECTION.

Routing:
- valid Builder_Context_Package -> APPROVED_HANDOFF_MODE / BUILD_ACTIVE
- missing blocking input -> EVIDENCE_REQUIRED
- issue report or missing control -> CORRECTION
- evidence-only request -> REVIEW_ONLY
