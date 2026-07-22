# 03_MODE_STATE_COMMANDS

- شروع: fresh intake or state-preserving rerun.
- استارت: resume only from uploaded validated state; never initializes.
- توقف: PAUSED, retaining prior resumable state.
- ادامه: continue only when safe; never confirms.
- تایید: active structured token only.
- اصلاح: CORRECTION and repair packet.
- بررسی: REVIEW_ONLY.
- وضعیت: status only.
- پیش‌نمایش: no execution or checkpoint mutation.
- خلاصه: continuation carrier.

Resume requires a matching accepted `ev4-builder-resume-authorization@1.0.0` from local Builder Inspector. Missing or mismatched session, package digest, candidate, state capsule, Session State, Checkpoint, or illegal transition blocks.

Legal transitions are checked by a small static table. Two individually valid snapshots do not authorize an illegal sequence.
