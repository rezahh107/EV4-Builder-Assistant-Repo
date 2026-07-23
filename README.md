# EV4 Builder Assistant Repo

```yaml
version: 0.3.6
repository_profile: personal_single_operator
runtime_goal: functional_correctness
industrial_governance: removed_from_active_system
security_posture: minimal_nonblocking
independent_review_required: false
pr_inspector_required: false
exact_head_runtime_authority: false
fixture_validation_is_real_completion: false
real_completion_requires_explicit_source_mode: true
real_completion_requires_deterministic_content_binding: true
origin_identity_independently_verified: false
manual_builder_input_mode_enabled: true
real_completion_requires_confirmation_receipt: true
real_completion_requires_verified_evidence_bytes: true
completion_status_runtime_derived: true
completion_gate_runtime_derived: true
builder_to_responsive: out_of_scope
responsive_complete: false
production_ready: false
```

این ریپو Runtime شخصی Builder برای اجرای Action Batchهای کوچک، تأییدشده و قابل Resume است. Canonical Builder package Schema همچنان `ev4-builder-context-package@1.0.0` است.

یک نام فایل مانند `builder-input.json` authority ایجاد نمی‌کند. Runtime فقط bytes دقیق source mode انتخاب‌شده توسط اپراتور را اجرا می‌کند، تمام facts را از همان bytes مشتق می‌کند و origin یا producer identity را مستقل از محتوا تأییدشده معرفی نمی‌کند.

## Active Runtime

```text
operator selects source mode
→ exact selected source bytes are read
→ mode-specific content checks and Builder validators run
→ deterministic Runtime Context is derived
→ Builder Action Batch
→ explicit confirm-batch
→ Confirmation Receipt
→ Evidence byte/hash/claim verification
→ Runtime-derived Completion Status
→ Runtime-derived Completion Gate
→ COMPLETED
```

## Explicit Source Modes

Source mode فقط از Runtime invocation می‌آید:

```text
project-gate
direct-ce
manual-builder-input
```

هیچ JSON ورودی نمی‌تواند خودش را به mode دیگری ارتقا دهد.

### `project-gate`

Runtime:

1. bytes دقیق Builder Input را می‌خواند؛
2. تمام Builder Schema، semantic، cross-field و lineage validationها را اجرا می‌کند؛
3. SHA-256 فایل و canonical package digest را دوباره محاسبه می‌کند؛
4. هر دو مقدار را با Project Gate Receipt مقایسه می‌کند؛
5. Context را از Builder Input واقعی مشتق می‌کند.

Receipt فقط content-binding cross-check است. `producer_repository`، `producer_commit_sha` و metadata مشابه، Run را authorize یا block نمی‌کنند.

Context این semantics را ثبت می‌کند:

```yaml
source_mode: project-gate
source_selection: operator_explicit
content_binding_status: verified
origin_assurance: not_independently_verified
receipt_binding_status: matched
```

### `direct-ce`

Runtime actual CE package را می‌خواند، declared content digest را با content واقعی مقایسه می‌کند، CE Contract Gate و adapter رسمی همین ریپو را اجرا می‌کند، Builder package را داخلی می‌سازد و سپس تمام Builder validatorها را اجرا می‌کند.

```yaml
source_mode: direct-ce
source_selection: operator_explicit
content_binding_status: verified
origin_assurance: not_independently_verified
receipt_binding_status: not_applicable
```

هیچ external CE attestation، repository allowlist یا producer authentication لازم نیست.

### `manual-builder-input`

این mode فقط با انتخاب صریح اپراتور فعال می‌شود و همان Builder validatorها، package digest، Candidate، Batch، Action IDs و Action body digests را محاسبه می‌کند.

```yaml
source_mode: manual-builder-input
source_selection: operator_explicit
content_binding_status: verified
origin_assurance: manual_operator_supplied
receipt_binding_status: not_applicable
```

Manual mode هرگز Project Gate یا CE origin را claim نمی‌کند؛ اما پس از intake، تمام Session، Confirmation، Evidence و Completion rules دقیقاً یکسان هستند.

## Real and Fixture Modes

| Capability | `fixture-validation` | `real-builder-run` |
|---|---:|---:|
| validate standalone Builder Input | yes | only through explicit source mode |
| report `would_complete: true` | yes | n/a |
| create deterministic Runtime Context | no | yes |
| create Confirmation Receipt | no | yes |
| verify Evidence source bytes | no | yes |
| set `builder_build_complete: true` | never | only after all derived predicates pass |
| enter `COMPLETED` | never | only after all derived predicates pass |

Fixture semantics remain:

```yaml
synthetic_validation_passed: true
would_complete: true
builder_build_complete: false
runtime_state: NOT_A_REAL_RUN
```

## Builder Inspector Commands

### Fixture validation

```bash
node scripts/builder-inspector.mjs \
  fixture-validation \
  builder-input.json \
  fixture-result.json
```

The legacy alias `intake` has fixture-only authority.

### Project Gate intake

```bash
node scripts/builder-inspector.mjs \
  real-intake \
  project-gate \
  project-gate-c2b-receipt.json \
  builder-input.json \
  runtime-context.json \
  real-intake-result.json
```

### Direct CE intake

```bash
node scripts/builder-inspector.mjs \
  real-intake \
  direct-ce \
  ce-source-wrapper.json \
  - \
  runtime-context.json \
  real-intake-result.json
```

### Manual Builder Input intake

```bash
node scripts/builder-inspector.mjs \
  real-intake \
  manual-builder-input \
  - \
  builder-input.json \
  runtime-context.json \
  real-intake-result.json
```

### Confirm the active Action Batch

```bash
node scripts/builder-inspector.mjs \
  confirm-batch \
  runtime-context.json \
  session-state.json \
  checkpoint.json \
  "تایید BATCH-001" \
  confirmation-receipt.json
```

`checkpoint.confirmed_action_ids` فقط mirror است و بدون Receipt معتبر Completion را authorize نمی‌کند.

### Real Completion

```bash
node scripts/builder-inspector.mjs \
  real-completion \
  project-gate \
  project-gate-c2b-receipt.json \
  builder-input.json \
  runtime-context.json \
  session-state.json \
  checkpoint.json \
  confirmation-receipt.json \
  completion-output
```

برای manual mode، `manual-builder-input` را انتخاب کن، source artifact را `-` بده و همان Builder Input استفاده‌شده در intake را ارائه کن.

## Completion Re-derivation

قبل از هر real Completion، Runtime:

1. source mode invocation را دوباره اعمال می‌کند؛
2. source fileهای انتخاب‌شده را دوباره می‌خواند؛
3. mode-specific derivation و تمام Builder validationها را دوباره اجرا می‌کند؛
4. hashها، canonical package digest، Candidate، Batch، Action IDs و Action body digests را دوباره می‌سازد؛
5. Context تازه را با Context ذخیره‌شده به‌صورت canonical مقایسه می‌کند؛
6. هر source-byte drift یا Context drift را fail-closed رد می‌کند.

## Confirmation and Evidence

Confirmation Receipt به Session، Package، Candidate، Context digest، Batch، Action set، Action body digests و token دقیق اپراتور bind می‌شود.

Normal Completion برای Evidence:

- path امن repository-relative را resolve می‌کند؛
- actual bytes را می‌خواند؛
- SHA-256 را دوباره محاسبه می‌کند؛
- claim ID، claim class، Evidence type، subject، Session، Package و Action binding را بررسی می‌کند؛
- synthetic Evidence را در `real-builder-run` رد می‌کند؛
- Evidence ناقص یا ناسازگار را blocker نگه می‌دارد.

هیچ signature، PKI، secret، remote attestation، service، database یا event bus لازم نیست.

## Derived Completion

Caller-authored `completion-status.json` و `completion-gate.json` authority ندارند. Runtime Status و Gate را از verified content predicates مشتق و atomically منتشر می‌کند.

Completion همچنان فقط Builder scope را اثبات می‌کند:

```yaml
builder_build_complete: true
responsive_complete: false
production_ready: false
```

## Startup and Resume

`شروع` فقط intake جدید را در نبود Run فعال آغاز می‌کند. `شروع` تکراری state را حفظ می‌کند. `استارت` فقط Session واقعی و `PAUSED` را Resume می‌کند و نمی‌تواند Run بسازد.

Legacy Capsule verification برای diagnostics و Resume compatibility باقی مانده و real Completion را authorize نمی‌کند:

```bash
node scripts/builder-inspector.mjs verify-capsule builder-input.json legacy-intake-result.json
node scripts/builder-inspector.mjs resume builder-input.json legacy-intake-result.json session-state.json checkpoint.json resume-output
```

## Repository Validation

```bash
npm ci
node scripts/test-builder-authority-bypasses.mjs
node scripts/test-builder-truth-spine.mjs
node scripts/test-builder-explicit-source-modes.mjs
npm run validate
```

`npm run validate` شامل reproductionهای legacy، 54 regression قبلی و 11 mutation/preservation test برای F-001 است.

## Deterministic Project Pack

```bash
node scripts/build-project-pack.mjs --verify
node scripts/build-project-pack.mjs --write
```

Canonical source map در `runtime/project-pack-source-map.v1.json` است. فایل‌های `dist/chatgpt-project` authoritative نیستند و hand edit یا stale output باعث failure می‌شود.

## Out of Scope

- producer authentication یا independent origin verification
- GitHub API provenance checks
- repository یا commit allowlists
- signed Receipts، PKI، secrets یا external attestation
- databases، services، event buses یا state machine دوم
- Builder → Responsive runtime handoff
- Responsive completion
- production deployment و production readiness claim
- real Elementor automation در CI

جزئیات source contract در `docs/EXPLICIT_SOURCE_MODES.md` و Completion/Evidence contract در `docs/BUILDER_TRUTH_SPINE.md` ثبت شده است.
