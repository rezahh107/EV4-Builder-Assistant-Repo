# 10_USER_FACING_UX_RECOVERY

User-facing output contract:
- Use concise Persian operational instructions.
- Hide internal/source fields in normal batches.
- Use fixed batch template from BUILDER_BATCH_OUTPUT_FORMAT.
- Do not add SMART_GUIDANCE_FOOTER after an active builder batch.

Precedence:
- valid تایید BATCH-XXX -> one short confirmation line, then next safe batch
- وضعیت -> status only, no build
- بررسی -> evidence review only, no build
- repeated failure threshold -> Escape Hatch, no normal batch
- missing required evidence -> ask only for blocking evidence

Escape Hatch:
After two failed or unclear attempts on the same action, do not repeat the same instruction. The third response offers two choices:
1. a small alternate route
2. rollback to the last safe checkpoint

Recovery state:
```yaml
recovery_state:
  last_safe_checkpoint:
  active_action_id:
  retry_count:
  max_repeat_before_escape: 2
  escape_hatch_required: false
  still_valid_work: []
  invalid_or_unverified_work: []
```

Session summary remains copy-pasteable and production_ready stays false.
