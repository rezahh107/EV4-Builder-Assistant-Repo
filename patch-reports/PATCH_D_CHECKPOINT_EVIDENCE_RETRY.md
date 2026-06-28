# Patch D — Checkpoint Evidence v0.2 + Retry Policy

## Branch

`patch/d-checkpoint-evidence-retry`

Base branch: `main`

## خلاصه

Patch D مدل checkpoint را از ثبت کلی وضعیت به مدل assertion/evidence ارتقا می‌دهد، در حالی که checkpointهای legacy با `ev4-builder-checkpoint@0.1.0` همچنان معتبر می‌مانند.

## Changed schemas

- `schemas/evidence-record.schema.json`
  - schema جدید برای evidence ledger اضافه شد.
  - `evidence_type` شامل `user_confirmation`, `editor_screenshot`, `structure_panel_screenshot`, `frontend_screenshot`, `diagnostic`, `export_json`, `manual_import` است.
  - هر evidence record فقط claim IDs مشخص‌شده در `supports_claim_ids` را پشتیبانی می‌کند.

- `schemas/checkpoint.schema.json`
  - backward-compatible شد و با `oneOf` از دو نسخه پشتیبانی می‌کند:
    - `ev4-builder-checkpoint@0.1.0`
    - `ev4-builder-checkpoint@0.2.0`
  - checkpoint v0.2 شامل `assertions`, `evidence_ledger`, `confirmed_action_ids`, `unconfirmed_action_ids`, و `retry_policy` است.
  - assertion با `status: confirmed` باید حداقل یک `evidence_refs` داشته باشد.
  - `retry_policy.max_retry_per_action` با مقدار ثابت `3` enforce می‌شود.

## New evidence model

قانون اصلی evidence:

```text
Evidence confirms only the assertions it explicitly supports.
```

نتیجه عملی:

- screenshot فقط assertionهای قابل مشاهده خودش را تأیید می‌کند.
- screenshot ساختار پنل، frontend rendering را تأیید نمی‌کند.
- frontend screenshot، hidden Elementor settings را تأیید نمی‌کند.
- سکوت هیچ چیزی را تأیید نمی‌کند.
- پیام مبهم مثل `done` نباید assertionهای جزئی را confirmed کند مگر اینکه با expected minimal confirmation همان action IDs map شود.

## Retry behavior

Retry policy canonical:

```yaml
MAX_RETRY_COUNT: 3
retry_policy:
  max_retry_per_action: 3
  retry_1: clarify_instruction
  retry_2: request_targeted_screenshot
  retry_3: enter_CORRECTION
```

رفتار runtime:

- retry count per action است، نه per session.
- retry اول instruction و evidence موردنیاز را شفاف می‌کند.
- retry دوم یک screenshot یا diagnostic هدفمند می‌خواهد.
- retry سوم وارد `CORRECTION` می‌شود و downstream actions متوقف می‌شود.
- در این patch hash confirmation از کاربر خواسته نمی‌شود.

## Documentation updates

- `core/SESSION_STATE_MACHINE.md`
  - checkpoint v0.2، assertion status، evidence ledger، و retry policy مستند شد.
  - insufficient evidence به `EVIDENCE_REQUIRED` یا در صورت contradiction/retry_3 به `CORRECTION` route می‌شود.

- `modes/CORRECTION_MODE.md`
  - retry limit و correction types جدید `checkpoint_evidence_conflict` و `retry_limit_reached` اضافه شد.

- `protocols/COMPLETION_GATE.md`
  - completion status از assertion/evidence refs مشتق می‌شود، نه از batch-level confidence.

- `examples/smart-home-connector/MANUAL_SESSION_001.md`
  - نمونه checkpoint به شکل assertion/evidence v0.2 اضافه شد، بدون تغییر معماری یا classهای تأییدشده.

## Fixtures

Valid:

- `tests/valid/checkpoint.json` legacy v0.1 همچنان معتبر است.
- `tests/valid/checkpoint_v0_2.json` مدل assertion/evidence جدید را پوشش می‌دهد.

Invalid:

- `tests/invalid/checkpoint_missing_session_id.json`
- `tests/invalid/checkpoint_v0_2_confirmed_without_evidence.json`
- `tests/invalid/checkpoint_v0_2_retry_count_invalid.json`

## CI / validation updates

- `package.json`
  - `validate:checkpoint` حالا همه `tests/valid/checkpoint*.json` را validate می‌کند.
  - همه `tests/invalid/checkpoint*.json` باید fail شوند.
  - `schemas/evidence-record.schema.json` به Ajv refs اضافه شد.
  - `validate:session-state` نیز evidence-record را register می‌کند.

- `.github/workflows/schema-validation.yml`
  - checkpoint validation از `npm run validate:checkpoint` استفاده می‌کند.
  - session-state compile/validation با `schemas/evidence-record.schema.json` اجرا می‌شود.

## Validation result

GitHub Actions روی PR #6 اجرا شد:

```text
Schema validation run #95: success
```

موارد مربوط به Patch D در CI:

```text
npm run validate:checkpoint: success
validate:session-state with schemas/evidence-record.schema.json: success
Compile session-state schema with checkpoint + evidence-record refs: success
```

## Migration notes

- checkpointهای `ev4-builder-checkpoint@0.1.0` برای compatibility حفظ شدند.
- checkpointهای جدید باید از `ev4-builder-checkpoint@0.2.0` استفاده کنند.
- مهاجرت لازم نیست فوری انجام شود؛ runtime می‌تواند checkpointهای legacy را بخواند و checkpointهای جدید را با assertion/evidence بنویسد.
- این patch Smart Home architecture، `selected_candidate_id` و approved classes را تغییر نداد.
