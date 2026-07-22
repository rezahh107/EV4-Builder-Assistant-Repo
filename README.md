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
builder_to_responsive: out_of_scope
production_ready: false
```

این ریپو runtime شخصی Builder برای تبدیل یک `builder-input.json` معتبر به Action Batchهای کوچک، تأییدشده، checkpointed و قابل Resume است.

## Active Runtime

```text
builder-input.json
→ Lightweight Intake Inspector
→ accepted | blocked
→ Builder Action Batch
→ explicit user confirmation
→ Checkpoint + Session State
→ Resume validation when needed
→ Completion validation
→ Builder completion
```

Builder completion فقط پایان محدوده Builder است و Responsive completion یا production readiness را اثبات نمی‌کند.

## Lightweight Builder Inspector

```bash
node scripts/builder-inspector.mjs intake builder-input.json builder-intake-result.json
node scripts/builder-inspector.mjs verify-capsule builder-input.json builder-intake-result.json
node scripts/builder-inspector.mjs resume builder-intake-result.json session-state.json checkpoint.json resume-result.json
node scripts/builder-inspector.mjs completion builder-intake-result.json session-state.json checkpoint.json completion-status.json completion-gate.json completion-result.json
```

Inspector از canonical digest implementation در `scripts/lib/canonical-builder-package.mjs` استفاده می‌کند، source input را تغییر نمی‌دهد و output را atomically منتشر می‌کند.

## Runtime Authorities

فقط این کنترل‌ها Run را authorize یا block می‌کنند:

- Builder Context Schema و semantic validation؛
- `selected_candidate_id` continuity؛
- decision lineage continuity؛
- Action Batch semantics و class scope؛
- confirmation binding؛
- Session State و Checkpoint consistency؛
- unresolved blocker preservation؛
- valid Completion conditions.

PR status، PR Inspector، independent review، Exact-Head evidence، governance receipts، merge evidence و repository commit identity runtime authority نیستند.

## Repository Maintenance

```bash
npm ci
npm run validate:version-consistency
npm run validate:schema-registry
npm run validate:builder-context-package
npm run validate:cross-field
npm run validate:builder-lineage-sequence
npm run build:project-pack
npm run validate
```

Normal CI فقط functional correctness، deterministic packaging و regressionها را می‌سنجد.

## Deterministic Project Pack

Canonical source map:

```text
runtime/project-pack-source-map.v1.json
```

Build verification:

```bash
node scripts/build-project-pack.mjs --verify
```

Regeneration:

```bash
node scripts/build-project-pack.mjs --write
```

Generated files در `dist/chatgpt-project` authoritative نیستند. Hand edit یا stale file باعث failure می‌شود.

## Out of Scope

- Builder → Responsive runtime handoff
- Responsive completion
- production deployment
- real Elementor automation
- production readiness claim

## Owner Local Pilot

1. از Project Gate یک `builder-input.json` بگیر.
2. Inspector intake را اجرا کن.
3. input و accepted capsule را در ChatGPT Project بارگذاری کن.
4. یک Action Batch کوچک واقعی اجرا کن.
5. آن را صریحاً تأیید کن.
6. Checkpoint بساز.
7. یک بار Pause/Resume را تست کن.
8. فقط پس از پایان bounded build، Completion validation را اجرا کن.
