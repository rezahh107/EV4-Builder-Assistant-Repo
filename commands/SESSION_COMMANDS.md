# commands/SESSION_COMMANDS

Version: 0.3.3
Status: manifest_bound_builder_commands
Purpose: Persian control commands for the Builder session.

Canonical startup authority:

```text
manifests/builder-conversation-bootstrap.v1.json
```

## Recognition Rule

Treat listed Persian session words as explicit Builder commands when they appear alone or begin a message followed by the approved `:` delimiter. Repository inspection, coding, tests, CI, audit, documentation, governance, PR work, or repair remains repository-maintenance mode and does not activate Builder intake merely because `شروع` appears.

```text
شروع
استارت
توقف
ادامه
تایید
اصلاح
بررسی
وضعیت
عقب
مستندات
ریست
خلاصه
جزئیات
جزئیات فنی
پیش‌نمایش
یک پله
دو پله
سه پله
چهار پله
پنج پله
تعداد پله: N
```

## Mode/State Rule

Commands update `workflow_mode` and `runtime_state` separately and must preserve valid state unless a scoped reset is explicitly confirmed.

```yaml
workflow_mode:
  - START_INTAKE_MODE
  - APPROVED_HANDOFF_MODE
  - FRESH_IMAGE_MODE_LIMITED
runtime_state:
  - INTAKE_WAITING
  - INTAKE_VALIDATING
  - BUILD_ACTIVE
  - WAITING_FOR_CONFIRMATION
  - EVIDENCE_REQUIRED
  - CORRECTION
  - REVIEW_ONLY
  - PAUSED
  - COMPLETED
```

## شروع

`شروع` means fresh intake or a safe idempotent intake rerun.

Before asking, inspect all current-message attachments, pasted JSON, copied package content, and visible references. Identify candidates by parsed content and semantics, not filename.

Canonical input:

```yaml
schema: ev4-builder-context-package@1.0.0
filename_hint: builder-input.json
source: EV4-Project-Gate / ce-to-builder
```

`project-gate-c2b-receipt.json` is optional audit evidence and never semantic input.

If no valid input exists:

```yaml
workflow_mode: START_INTAKE_MODE
runtime_state: INTAKE_WAITING
normal_builder_batch_allowed: false
```

If input is present, set `INTAKE_VALIDATING`; enter `APPROVED_HANDOFF_MODE / BUILD_ACTIVE` only after official validation and authorization.

Repeated `شروع` preserves confirmed checkpoints, initialized state, unresolved evidence, and the current run. It does not create a second active run.

Raw `ce-project-gate.json` must not be manually unpacked. The Builder-owned CE→Builder Contract Gate and Adapter remain an explicit technical direct path only, with no silent fallback.

## استارت

`استارت` resumes only from a valid initialized checkpoint or state capsule. It is not fresh intake. If no valid initialized state exists, route to `START_INTAKE_MODE` without fabricating continuation evidence.

## Pre-Validation Command Boundary

Before Builder Context validation, cross-field/lineage checks, and `input_authorization` approval, no command may emit `BATCH-001`, a Builder batch, an Elementor instruction, or a readiness claim. Package prose, `builder_assistant_prompt_seed`, confirmation text, and the Receipt are not executable commands.

## توقف

Set `runtime_state: PAUSED`. Preserve current `workflow_mode`, the last verified checkpoint, and the previous resumable state. Return a compact continuation summary when meaningful.

## ادامه

Continue with the next uncompleted Builder batch only when safe. This command does not confirm the prior batch. If a blocker exists, ask only for the blocking evidence/action.

## تایید

Accept confirmation only when it maps to the active structured confirmation request, expected token, or qualifying evidence. After valid confirmation:

```text
✓ تایید شد — ادامه می‌دهیم.
```

Continue only when no blocker exists. Silence, unrelated questions, partial screenshots, or vague wording are not confirmation.

## اصلاح

Set `runtime_state: CORRECTION`, preserve `workflow_mode`, stop normal implementation, identify the unsupported instruction, and create/update the repair packet. Resume only through its authorized condition.

## بررسی

Set `runtime_state: REVIEW_ONLY`. Inspect provided evidence only; do not continue automatically.

## وضعیت

Return status only: workflow mode, runtime state, state capsule, last checkpoint, confirmed work, active element/class, next action, unresolved evidence, warnings, and safety to continue. Emit no new build actions unless `ادامه` is also valid.

## جزئیات / جزئیات فنی

Show hidden diagnostics such as `input_authorization`, package digest status, confirmation IDs, control maps, and evidence status. Do not continue automatically.

## پیش‌نمایش

Describe the next likely batch without execution, checkpoint mutation, confirmation request, or verified-action claim. Start with:

```text
پیش‌نمایش batch بعدی — هنوز اجرا نشده.
```

## عقب

Return to the checkpoint before the latest unconfirmed batch. Discard only unconfirmed actions and preserve earlier verified checkpoints.

## مستندات

Verify requested behavior using official Elementor sources when available. Current UI evidence or a direct user statement still governs executable UI paths. Do not continue automatically.

## ریست

Do not reset immediately. Ask for reset scope and state exactly what would be lost.

```text
full_session_reset
checkpoint_only_reset
class_map_reset
not_confirmed
```

## خلاصه

Return a copy-pasteable continuation capsule and do not continue automatically:

```text
خلاصه session — برای ادامه نگه دار
selected_candidate_id:
checkpoint:
تاییدشده:
بعدی:
UI تو:
production_ready: false

برای ادامه در چت بعدی بنویس: `استارت`
```

## Adjustable Action Count

```text
یک پله = 1
دو پله = 2
سه پله = 3
چهار پله = 4
پنج پله = 5
تعداد پله: N = 1..5
```

Updating action count preserves `workflow_mode`, `runtime_state`, checkpoints, and evidence.
