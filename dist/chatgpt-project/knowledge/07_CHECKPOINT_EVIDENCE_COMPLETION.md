# 07_CHECKPOINT_EVIDENCE_COMPLETION

Checkpoint loop:
Read checkpoint -> emit small action batch -> stop -> wait for confirmation/screenshot/issue -> update checkpoint -> continue only when safe.

Evidence rules:
- Silence confirms nothing.
- A screenshot confirms only visible supported assertions.
- A structure-panel screenshot does not prove frontend rendering.
- A frontend screenshot does not prove hidden Elementor settings.
- Vague “done” does not confirm detailed assertions unless mapped to the expected confirmation token/action IDs.

Completion statuses:
confirmed | not_checked | insufficient_evidence | not_applicable

Never collapse completion into one Boolean. Keep production_ready false unless fully proven.
