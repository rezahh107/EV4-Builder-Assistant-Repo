# Patch D — Checkpoint Evidence v0.2 + Retry Policy

## Branch

`patch/d-checkpoint-evidence-retry`

Base branch: `main`

## خلاصه

Patch D مدل checkpoint را از ثبت کلی وضعیت به مدل assertion/evidence ارتقا می‌دهد، در حالی که checkpointهای legacy با `ev4-builder-checkpoint@0.1.0` همچنان معتبر می‌مانند.

## Commits

Implementation commits:

```text
cc36af4e5588c8e23d3014301015c3e524b06fd1 Patch D: add evidence record schema
e42f038dc00c6d6d6aee69d125b864a1aa0373b6 Patch D: upgrade checkpoint schema with v0.2 evidence model
1b7b16a8d6eae50b84629ff1db943d134b0a791b Patch D: add valid checkpoint v0.2 fixture
b00e1bfdf725a82bd1a2e9a26fba3a54a8cea757 Patch D: add invalid confirmed assertion without evidence fixture
0ffd8132877b71d1c83957f98494aadfa3b93aba Patch D: add invalid retry policy fixture
ffe7c559e358134109f09d6c422159303fdac5f2 Patch D: add checkpoint invalid fixture referenced by CI
861de995bb837acaed741847e9ac0b3f9410616c Patch D: update checkpoint validation scripts
18886951cad9a4ab55368c1f62f35165dcf0bde5 Patch D: add checkpoint evidence schema to CI
c88caa3f79e80f47fb237f1ed512a0da06b126f1 Patch D: document assertion checkpoints and retry policy
65f026abde4c923413da67f5d866255fb77478cd Patch D: add retry limit behavior to correction mode
2f24b62d71f7d19851adff55bb3c5e28f9f183eb Patch D: align completion gate with assertion evidence
89ee204c53036ea5842e0a23fb0cd117a1650337 Patch D: update manual session checkpoint example
25d2dfff89b0592d2fb4ae0a2b65e2be54b3e8f8 Patch D: add Persian patch report
a8305a9d0d3cfbf6da40753dcd6f4db67af91f4f Patch D: update report with CI result
```

Audit hardening commits:

```text
fbad79567ed1eb2317643ec47cd06c8451be8551 Patch D audit: add checkpoint cross-field validator
95694a34ae594182bdf38ab5886ff5fad90711e7 Patch D audit: add invalid checkpoint evidence-ref fixture
f54fa9ae66a56bf0fdfbc18138baf76e255334e4 Patch D audit: wire checkpoint cross-field validation
```

## Files changed

```text
.github/workflows/schema-validation.yml
core/SESSION_STATE_MACHINE.md
examples/smart-home-connector/MANUAL_SESSION_001.md
modes/CORRECTION_MODE.md
package.json
patch-reports/PATCH_D_CHECKPOINT_EVIDENCE_RETRY.md
protocols/COMPLETION_GATE.md
schemas/checkpoint.schema.json
schemas/evidence-record.schema.json
scripts/validate-checkpoint.mjs
tests/invalid/checkpoint_missing_session_id.json
tests/invalid/checkpoint_v0_2_confirmed_without_evidence.json
tests/invalid/checkpoint_v0_2_retry_count_invalid.json
tests/invalid-checkpoint-cross-field/checkpoint_v0_2_unknown_evidence_ref.json
tests/valid/checkpoint_v0_2.json
```

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

Audit hardening:

```text
scripts/validate-checkpoint.mjs
```

این validator cross-field بررسی می‌کند که:

- `assertions[].evidence_refs[]` به `evidence_ledger[].evidence_id` واقعی اشاره کند.
- evidence referenced شده همان `assertion_id` را در `supports_claim_ids` داشته باشد.
- assertion تأییدشده به evidence با `status: available` متکی باشد.
- `confirmed_action_ids` و `unconfirmed_action_ids` overlap نداشته باشند.
- `assertion_id` و `evidence_id` تکراری نباشند.

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

Invalid schema fixtures:

- `tests/invalid/checkpoint_missing_session_id.json`
- `tests/invalid/checkpoint_v0_2_confirmed_without_evidence.json`
- `tests/invalid/checkpoint_v0_2_retry_count_invalid.json`

Invalid cross-field fixture:

- `tests/invalid-checkpoint-cross-field/checkpoint_v0_2_unknown_evidence_ref.json`

## CI / validation updates

- `package.json`
  - `validate:checkpoint` حالا همه `tests/valid/checkpoint*.json` را schema-validate و cross-field validate می‌کند.
  - همه `tests/invalid/checkpoint*.json` باید schema-fail شوند.
  - همه `tests/invalid-checkpoint-cross-field/*.json` باید schema-pass و cross-field-fail شوند.
  - `schemas/evidence-record.schema.json` به Ajv refs اضافه شد.
  - `validate:session-state` نیز evidence-record را register می‌کند.

- `.github/workflows/schema-validation.yml`
  - checkpoint validation از `npm run validate:checkpoint` استفاده می‌کند.
  - session-state compile/validation با `schemas/evidence-record.schema.json` اجرا می‌شود.

## Validation commands run

GitHub Actions روی PR #6 اجرا شد:

```text
Schema validation run #101: success
```

Relevant commands covered by CI:

```bash
npm run validate:checkpoint
npm run validate:session-state
npx --yes ajv-cli@5 compile --spec=draft2020 --strict=false -s schemas/session-state.schema.json -r schemas/checkpoint.schema.json -r schemas/evidence-record.schema.json
```

Previous complete workflow run also passed:

```text
Schema validation run #96: success
```

## Failures / skips

```text
local npm/Ajv validation: not run in this assistant environment
reason: GitHub connector writes and GitHub Actions status are available, but no local checked-out repo with npm execution was available through the connector path used here
risk: low, because GitHub Actions executed the relevant validation commands successfully on PR #6
```

## Remaining risks

- `package.json` و `.github/workflows/schema-validation.yml` با Patch E نیز مشترک هستند. اگر Patch E زودتر merge شود، Patch D ممکن است نیاز به sync/rebase کوچک داشته باشد.
- Cross-field checkpoint validation اکنون وجود دارد، اما semantic visibility مثل اینکه screenshot واقعاً چه چیزی را نشان می‌دهد همچنان runtime/human evidence responsibility است و با JSON قابل اثبات نیست.

## Migration notes

- checkpointهای `ev4-builder-checkpoint@0.1.0` برای compatibility حفظ شدند.
- checkpointهای جدید باید از `ev4-builder-checkpoint@0.2.0` استفاده کنند.
- مهاجرت لازم نیست فوری انجام شود؛ runtime می‌تواند checkpointهای legacy را بخواند و checkpointهای جدید را با assertion/evidence بنویسد.
- این patch Smart Home architecture، `selected_candidate_id` و approved classes را تغییر نداد.
