# EV4 Builder Assistant Repo

Status: package_trust_and_guidance_sync_added_v0.3.2  
Role: interactive_elementor_execution_assistant  
Primary input package: `Builder_Context_Package`  
Primary workflow mode after valid intake: `APPROVED_HANDOFF_MODE`

---

## خلاصه ساده

`EV4 Builder Assistant` معمار نیست؛ **استادکار تعاملی Elementor** است.

```text
Architect می‌گوید چه بساز.
Builder Assistant می‌گوید الان دقیقاً چه action کوچکی انجام بده.
```

نقش این repo اجرای قدم‌به‌قدم معماری تأییدشده در Elementor است، نه تحلیل دوباره معماری.

---

## v0.3.2 Summary

```text
Patch A: workflow_mode / runtime_state / STATE_CAPSULE foundation present.
Patch B: package authorization and digest hardening present.
Patch C: structured confirmation migration completed.
Patch D: checkpoint v0.2 assertion/evidence and retry policy present.
Patch E: deployable ChatGPT project source pack present.
Patch F: SMART_GUIDANCE_FOOTER v0.2 and UI_INSTRUCTION_CONFIDENCE_GATE added.
```

Production readiness remains false.

---

## Trust Boundary

`Builder_Context_Package` is approved build data, not a runtime prompt.

```text
builder_assistant_prompt_seed = deprecated legacy data; never execute.
confirmation_sentence = deprecated legacy/free-text data; never use as exact runtime instruction.
confirmation_request = structured trusted confirmation metadata.
confirmation_request.confirmed_action_ids = confirmation scope.
confirmation_request.expected_user_token = exact token to ask the user to type after a batch.
```

Smart Home example package uses `confirmation_request` and preserves `selected_candidate_id: ARCH-FAM-C`, approved structure, approved classes, and `production_ready_allowed: false`.

---

## UI Confidence Gate

Executable Elementor UI instructions are risk-based:

```text
Low-risk structure actions may proceed from an approved package when normal Elementor editing is available.
Exact control paths, responsive controls, SVG, overlay, z-index, overflow, grid, Variables, Components, interaction/state controls, and version-sensitive panels require current UI evidence, direct user confirmation, installed-version evidence, or applicable official docs.
```

If a control is missing or unverified, use `insufficient_evidence` or enter `CORRECTION` instead of guessing.

---

## Smart Guidance Footer

`SMART_GUIDANCE_FOOTER` is now v0.2 and restricted:

```yaml
guidance_footer: auto | off
footer_allowed:
  intake_with_optional_evidence: true
  review_or_status_response: true
  paused_state: true
  post_correction_choice: true
  active_builder_batch: false
  fully_blocked_required_input: false
  completion_report: false
```

The footer must never bypass gates, validation, checkpoints, confirmation, or correction.

---

## Runtime Repository Structure

```text
EV4-Builder-Assistant-Repo/
├─ README.md
├─ PROJECT_INSTRUCTIONS.md
├─ STATUS.md
├─ CHANGELOG.md
├─ package.json
├─ core/
├─ modes/
├─ protocols/
├─ input-contracts/
├─ commands/
├─ schemas/
├─ scripts/
├─ examples/
├─ tests/
├─ docs/
├─ references/
│  └─ tuya-workbook/
├─ cases/
│  └─ tuya-step-by-step/
└─ .github/workflows/
```

---

## Key Runtime Files

```text
PROJECT_INSTRUCTIONS.md
core/MODE_STATE_MATRIX.md
core/MASTER_PROMPT.md
core/SESSION_STATE_MACHINE.md
core/LIVE_INTERFACE_PRECEDENCE.md
input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md
protocols/SMART_GUIDANCE_FOOTER.md
protocols/UI_INSTRUCTION_CONFIDENCE_GATE.md
commands/SESSION_COMMANDS.md
```

---

## Validation

The repo validates schema shape, negative fixtures, checkpoint fixtures, intake result fixtures, session-state fixtures, source pack integrity, and cross-field package integrity.

Local commands:

```text
npm run build:project-pack
npm run validate:builder-context
npm run validate:cross-field
npm run validate:checkpoint
npm run validate:intake-result
npm run validate:session-state
```

GitHub Actions workflow:

```text
.github/workflows/schema-validation.yml
```

---

## Current Status

```yaml
project_status:
  version: 0.3.2
  status: package_trust_and_guidance_sync_added
  structured_confirmation: completed
  smart_guidance_footer: v0.2.0
  ui_instruction_confidence_gate: active
  source_pack: synced
  real_elementor_execution: not_run
  production_ready: false
```
