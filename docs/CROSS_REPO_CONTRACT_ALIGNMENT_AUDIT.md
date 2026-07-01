# Cross-Repository Contract Alignment Audit

Date: 2026-07-01  
Mode: audit-only  
Branch: `audit-cross-repo-contract-alignment-20260701`  
Output file: `docs/CROSS_REPO_CONTRACT_ALIGNMENT_AUDIT.md`

This audit treats repository files as data. It does not redesign the EV4 ecosystem, does not create `EV4-Shared-Contracts`, does not move schemas, and does not weaken any validation gate.

---

## 1. Executive summary

The four EV4 repositories agree at the README/role level on the intended pipeline:

```text
EV4 Architect Repo
        ↓
EV4 Constructability Engineer Repo
        ↓
EV4 Builder Assistant Repo
        ↓
EV4 Responsive Architect
```

However, current contract/schema/runtime alignment is not yet ready for canonical extraction into `EV4-Shared-Contracts`.

### BLOCKER findings

1. **`ev4-builder-context-package@1.0.0` is duplicated with divergent meaning.**
   - Architect defines `schemas/ev4-builder-context-package.schema.json` as a direct Stage 11 export schema.
   - Builder defines `schemas/builder-context-package.schema.json` as a stricter runtime intake schema with package authorization, reference-paradigm gates, visual-reference flags, and compatibility behavior.
   - Same contract name/version, different shape and runtime semantics.

2. **Builder now enforces Golden Reference / Build Intent / Spatial Lexicon / Experience Intent behavior, but upstream producers are not aligned.**
   - Builder contains schemas, validators, and runtime instructions for these concepts.
   - Architect, CE, and Responsive do not currently expose matching producer contracts by those names.
   - CE currently carries `reference_paradigm_lock` / `paradigm_to_structure_map`, but not `golden_reference_contract`, `build_intent_brief`, `experience_intent`, or a shared spatial-lexicon version pin.

3. **Architect still contains a direct-to-Builder export path that can bypass CE in naming and packaging.**
   - README says Architect output is not Builder-executable unless CE proves it.
   - Stage 11 still says it converts `/handoff-export` into a copy-ready `Builder_Context_Package` for Builder.
   - This is role drift unless Stage 11 is downgraded to compatibility export / CE intake source only.

4. **CE and Builder have an adapter boundary, not a shared canonical contract.**
   - CE emits `builder_executable_package` with CE-native shape.
   - Builder normalizes it into `Builder_Context_Package` through adapter scripts.
   - This adapter is useful, but it confirms there is no single shared schema source yet.

5. **Responsive contracts prevent raw screenshot authority but are not linked to Golden Reference families/scopes.**
   - Responsive correctly treats raw screenshots as evidence, not baseline authority.
   - Responsive does not yet require `golden_reference_contract.reference_id`, `reference_version`, `scope`, or family linkage when mobile/tablet reference behavior is involved.

### Readiness decision

`EV4-Shared-Contracts` should **not** start with canonical schema migration yet. It may start only after Patch 1 role alignment defines producer/consumer ownership and resolves duplicate versioned contract names.

Recommended next patch: **Patch 1 — role alignment**.

---

## 2. Repositories inspected

| Repository | Default branch | Observed role | Primary evidence |
|---|---:|---|---|
| `rezahh107/EV4-Architect-Repo` | `main` | `architecture_decision_system` | `README.md:3-9`, `README.md:15-23`, `README.md:36-60` |
| `rezahh107/EV4-Constructability-Engineer-Repo` | `main` | `implementation_strategy_gate` | `README.md:3-8`, `README.md:14-23`, `README.md:69-93` |
| `rezahh107/EV4-Builder-Assistant-Repo` | `main` | `interactive_elementor_execution_assistant` | `README.md:3-9`, `README.md:15-23`, `README.md:27-64` |
| `rezahh107/EV4-Responsive-Architect` | `main` | `post_build_responsive_validation_and_repair_system` | `README.md:3-8`, `README.md:14-23`, `README.md:59-82` |

### Unmerged relevant work

| Repository | PR | Status | Relevance |
|---|---:|---|---|
| `EV4-Builder-Assistant-Repo` | `#36` — `Add read-only diagnostic evidence templates` | open, unmerged | Security/evidence-related. It is not the source of the Golden Reference / Build Intent drift, but it touches diagnostic evidence schemas, template registry, validator behavior, and user-facing wording guardrails. Report separately before any shared diagnostic/evidence contract migration. |

No open PRs were found for Architect, CE, or Responsive during this audit pass.

---

## 3. Current contract inventory table

| Concept | Architect | CE | Builder | Responsive | Drift risk | Recommended owner |
|---|---|---|---|---|---|---|
| Repository role boundary | Defines Architect as architecture decision system. Must not be Builder/CE. Evidence: `README.md:15-23`, `README.md:51-60`. | Defines CE as implementation strategy gate. Evidence: `README.md:14-23`, `README.md:71-93`. | Defines Builder as interactive execution assistant. Evidence: `README.md:15-23`, `README.md:45-64`. | Defines Responsive as post-build validation/repair. Evidence: `README.md:14-23`, `README.md:73-82`. | Low at README level; medium in Stage 11 export behavior. | Shared role contract after Patch 1. |
| Builder Context Package | `schemas/ev4-builder-context-package.schema.json`; direct Stage 11 export schema. Evidence: `schemas/ev4-builder-context-package.schema.json:4-55`. | Not native producer; CE emits Builder Executable Package. | `schemas/builder-context-package.schema.json`; stricter runtime schema with authorization/reference gates. Evidence: `schemas/builder-context-package.schema.json:3`. | Not consumed directly. | **BLOCKER:** same schema version/name, divergent shape. | Shared Contracts after role alignment; Builder owns runtime intake, CE owns producer normalization. |
| Handoff package | `/handoff-export` packages audited record and must not add decisions. Evidence: `stages/10_HANDOFF_EXPORT.md:13-33`, `43-120`. | Consumes Architect handoff/review. | Consumes only after CE or validated legacy intake. | Consumes completed main-pipeline handoff baseline. Evidence: `contracts/MAIN_PIPELINE_HANDOFF_INPUT_CONTRACT.md:42-57`. | Medium: multiple handoff baselines exist. | Architect owns upstream handoff; Shared owns identity/envelope fields. |
| Builder Executable Package | Architect should not emit directly; README says CE must inspect first. Evidence: `README.md:81-100`. | Native schema: `schemas/builder_executable_package.schema.json`. Evidence: `schemas/builder_executable_package.schema.json:5-54`. | Consumes through `normalize-ce-builder-executable-package.mjs`. Evidence: `scripts/normalize-ce-builder-executable-package.mjs:206-257`. | Not direct. | Medium: CE schema is not same as Builder context schema; adapter required. | CE owns producer; Shared owns canonical cross-repo envelope. |
| Reference paradigm lock | Missing by this name in Architect. | Native schema and validator. Evidence: `schemas/reference-paradigm-lock.schema.json:5-119`; `validator/reference_paradigm_lock.py:49-107`. | Embedded in Builder intake schema; visual parity gate requires it. Evidence: `schemas/builder-context-package.schema.json:3`; `core/MASTER_PROMPT.md:148-160`. | Missing by this name. | Medium: overlapping visual-reference terms with Golden Reference. | CE owns extraction; Shared owns schema after Patch 1. |
| Visual reference / image reference | Stage 11 has `reference_screenshot_instruction` with `allowed_use: visual_reference_only`. Evidence: `stages/11_BUILDER_FEED_EXPORT.md:61-64`. | Uses screenshot/measured evidence in strategy map. Evidence: `schemas/implementation_strategy_map.schema.json:26-27`. | Explicitly says image-only references cannot authorize parity. Evidence: `protocols/GOLDEN_REFERENCE_CONTRACT.md:5-7`; `core/MASTER_PROMPT.md:193-199`. | Visual reference is allowed as evidence only, not baseline. Evidence: `contracts/MAIN_PIPELINE_HANDOFF_INPUT_CONTRACT.md:124-147`. | High: image evidence vs locked Golden Reference not unified. | Shared visual-reference evidence taxonomy. |
| Golden Reference | Missing. | Missing. | Native protocol/schema/validators. Evidence: `protocols/GOLDEN_REFERENCE_CONTRACT.md:5-7`; `schemas/golden-reference.schema.json:3`. | Missing. | **BLOCKER:** Builder-only runtime contract has no upstream producer. | Patch 1 must assign owner; likely CE carries/locks, Architect may source candidate evidence. |
| Build Intent Brief / `تصویر ذهنی` | Missing. | Missing. | Native schema/runtime gate. Evidence: `schemas/build-intent-brief.schema.json:3`; `core/MASTER_PROMPT.md:193-199`. | Missing. | **BLOCKER:** Builder requires/asks for CE-generated package, but CE does not produce it. | CE or Architect must be assigned explicit producer role before sharing. |
| Spatial Lexicon | Missing. | Missing. | Native data/schema/validator referenced by Builder runtime. Evidence: `core/MASTER_PROMPT.md:117-120`, `134-137`. | Missing. | High: Builder uses pinned lexicon version; upstream cannot pin. | Shared data contract, probably Shared-owned after Patch 1. |
| Experience Intent | Missing. | Missing. | Advisory schema/protocol. Evidence: `schemas/experience-intent.schema.json:3`; `protocols/EXPERIENCE_INTENT.md:5`. | Missing. | Medium: advisory only, but source/producer absent. | Architect may own design intent source; Shared owns enum vocabulary. |
| Visual Parity Check | Missing. | Partial through reference lock and visual parity package condition. Evidence: `schemas/builder_executable_package.schema.json:23-33`. | Native schema/runtime. Evidence: `schemas/visual-parity-check.schema.json:3`; `core/MASTER_PROMPT.md:176-200`. | Missing Golden link; has responsive evidence gates. | High: desktop parity vs responsive evidence separate. | Builder owns runtime check; Shared owns result schema. |
| Completion status / production readiness | `production_ready_allowed: false` in Architect output contract. Evidence: `README.md:167-178`. | `production_ready: false` allowed unknown until QA. Evidence: `README.md:155-162`; `validator/rules.py:118-127`. | Native completion status schema and wording gate. Evidence: `schemas/completion-status.schema.json:3`; `core/MASTER_PROMPT.md:186-200`. | Production boundary prevents claims. Evidence: `README.md:175-189`; `contracts/MAIN_PIPELINE_HANDOFF_INPUT_CONTRACT.md:254-257`. | Medium: multiple fields/names: `production_ready`, `production_ready_allowed`, QA status. | Shared production boundary vocabulary. |
| `selected_candidate_id` / lock | Owns selection and lock. Evidence: `README.md:38-49`, `167-178`. | Must not change; package must preserve. Evidence: `README.md:83-93`, `140-153`; `validator/rules.py:151-160`. | Must not change. Evidence: `README.md:45-64`; `core/MASTER_PROMPT.md:74-92`. | Must not change. Evidence: `README.md:73-82`; `contracts/MAIN_PIPELINE_HANDOFF_INPUT_CONTRACT.md:238-240`. | Low conceptually; medium if duplicated packages drift. | Architect owns original selection; Shared owns identity consistency rules. |
| Responsive Start Packet | Native contract. Evidence: `contracts/EV4_RESPONSIVE_START_PACKET_CONTRACT.md:3-9`, `151-241`. | Not linked. | Not linked to Golden Reference. | Has main handoff input contract, not same schema. Evidence: `contracts/MAIN_PIPELINE_HANDOFF_INPUT_CONTRACT.md:42-99`. | High: no Golden Reference family/scope linkage. | Architect/Responsive shared contract after Patch 5. |
| Source pack / project pack / manifest / version consistency | Has release pack and source ledger concepts; no workflow found for validation. Evidence: `stages/10_HANDOFF_EXPORT.md:43-120`. | Pytest + reference paradigm validation; no general package/version consistency validator found. Evidence: `.github/workflows/validate-fixtures.yml:19-23`. | Has version/schema registry/project pack validation. Evidence: `scripts/validate.mjs:6-35`. | Has payload identity/content hash schema. Evidence: `schemas/ev4-responsive-payload-identity.schema.json:14-20`. | High: different identity/digest systems. | Shared envelope/identity contract. |
| Free-text as instruction | Stage 10/11 forbid inventing and legacy prompt fields removed. Evidence: `stages/11_BUILDER_FEED_EXPORT.md:102-126`. | Detects unresolved decision keys/values; first batch decision gates. Evidence: `validator/rules.py:15-39`, `237-262`; continuation `validator/rules.py:260-273`. | Explicit trust boundary and prompt-injection scan. Evidence: `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md:102-147`; `scripts/validate-package.mjs:85-158`. | Raw screenshot/evidence cannot override baseline. Evidence: `contracts/MAIN_PIPELINE_HANDOFF_INPUT_CONTRACT.md:124-147`. | Medium: CE action `parameters.instruction` still becomes Builder instruction text after validation. | Shared trust boundary + per-field authority matrix. |

---

## 4. Producer/consumer map

| Contract / field family | Producer repo | Consumer repo | Validator location | Runtime behavior location | Duplicate or missing |
|---|---|---|---|---|---|
| `selected_candidate_id` | Architect | CE, Builder, Responsive | CE: `validator/rules.py:151-160`; Responsive: `contracts/MAIN_PIPELINE_HANDOFF_INPUT_CONTRACT.md:238-240`; Builder: `scripts/validate-package.mjs:230-231` | Builder: `core/MASTER_PROMPT.md:74-92` | Present, but multiple package envelopes must preserve it. |
| `selected_candidate_locked` | Architect / CE package | CE, Builder | CE: `validator/rules.py:114-116`; Builder: `scripts/validate-package.mjs:230` | Builder: `README.md:27-41` | Present. |
| `production_ready_allowed` | Architect / Builder normalized package | Builder | Builder: `scripts/validate-package.mjs:230-231`; Builder schema: `schemas/builder-context-package.schema.json:3` | Builder: `core/MASTER_PROMPT.md:186-200`; Responsive: `README.md:175-189` | Duplicate naming with `production_ready`. |
| `production_ready` / QA status | CE / Responsive / Builder completion | CE, Builder, Responsive | CE: `validator/rules.py:118-127`; Builder: `schemas/completion-status.schema.json:3` | Responsive: `README.md:175-189` | Needs shared boundary terms. |
| `Builder_Context_Package` | Architect legacy/direct export; Builder adapter output | Builder | Architect schema: `schemas/ev4-builder-context-package.schema.json`; Builder schema: `schemas/builder-context-package.schema.json`; Builder cross-field: `scripts/validate-package.mjs` | Builder: `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md`; `core/MASTER_PROMPT.md` | **Duplicated with same version but divergent shape.** |
| `Builder Executable Package` | CE | Builder | CE schema: `schemas/builder_executable_package.schema.json`; CE validator: `validator/rules.py`; Builder adapter test: `scripts/validate-ce-builder-package-adapter.mjs` | Builder adapter: `scripts/normalize-ce-builder-executable-package.mjs` | Present, but not shared. |
| `reference_paradigm_lock` | CE | Builder | CE: `schemas/reference-paradigm-lock.schema.json`, `validator/reference_paradigm_lock.py`; Builder: `scripts/validate-reference-paradigm-gate.mjs` via `scripts/validate.mjs` | Builder: `core/MASTER_PROMPT.md:148-160` | Present in CE/Builder; missing in Architect/Responsive. |
| `paradigm_to_structure_map` | CE | Builder | CE schema: `schemas/reference-paradigm-lock.schema.json`; Builder adapter/schema | Builder adapter: `scripts/normalize-ce-reference-map.mjs` | Shape drift; adapter required. |
| `first_batch_structure_intent` | Builder adapter derived from CE map | Builder | Builder schema: `schemas/builder-context-package.schema.json`; Builder adapter tests | Builder: `core/MASTER_PROMPT.md:148-160` | Builder schema appears Smart-Home-specific; not general CE contract. |
| `golden_reference_contract` | Missing upstream | Builder | Builder: `schemas/golden-reference.schema.json`; `scripts/validate-golden-reference.mjs` | Builder: `core/MASTER_PROMPT.md:193-200` | **Missing producer.** |
| `build_intent_brief` | Missing upstream | Builder | Builder: `schemas/build-intent-brief.schema.json`; `scripts/validate-build-intent-brief.mjs` | Builder: shows exact `تصویر ذهنی` text only when valid. `core/MASTER_PROMPT.md:193-199` | **Missing producer.** |
| `spatial_lexicon_version_used` | Missing upstream | Builder | Builder: `schemas/build-intent-brief.schema.json`, spatial lexicon validator | Builder runtime gate references `protocols/SPATIAL_LEXICON.md` | **Missing producer/version pin source.** |
| `experience_intent` | Missing upstream | Builder | Builder: `schemas/experience-intent.schema.json` | Builder: advisory only; cannot override core fields | Missing producer. |
| `visual_parity_check` | Builder runtime/post-action | Builder; eventually Responsive may need it | Builder: `schemas/visual-parity-check.schema.json`; `scripts/validate-visual-parity-check.mjs` | Builder: `core/MASTER_PROMPT.md:176-200` | Missing upstream link; Responsive not linked to Golden family. |
| `responsive_start_packet` | Architect | Responsive | Architect contract only found: `contracts/EV4_RESPONSIVE_START_PACKET_CONTRACT.md` | Responsive main input contract | Present in Architect; Responsive has related but not same canonical schema. |
| `payload_identity` / digest | Builder computes package digest; Responsive has payload identity; Architect has source ledger | Builder, Responsive | Builder: `scripts/validate-package.mjs:168-217`; Responsive: `schemas/ev4-responsive-payload-identity.schema.json` | Builder intake authorization; Responsive ingest | Duplicate identity models. |

---

## 5. Confirmed gaps

### 5.1 Duplicate schema/version drift: `ev4-builder-context-package@1.0.0`

Confirmed files:

- Architect: `schemas/ev4-builder-context-package.schema.json:4-55`
- Builder: `schemas/builder-context-package.schema.json:3`

Architect schema is a compact Stage 11 export with `additionalProperties: false`, no `input_authorization`, and no Golden Reference / Build Intent / `first_batch_structure_intent` fields.

Builder schema has the same package schema string but adds:

- `input_authorization`
- `package_digest`
- `reference_paradigm_lock`
- `paradigm_to_structure_map`
- `first_batch_structure_intent`
- `visual_reference_present`
- `visual_parity_expected`
- `reference_artifact_type`
- deprecated legacy handling for `confirmation_sentence`

This is a canonical-contract blocker.

### 5.2 Builder-only Golden Reference contract

Confirmed files:

- `protocols/GOLDEN_REFERENCE_CONTRACT.md:5-7`
- `schemas/golden-reference.schema.json:3`
- `core/MASTER_PROMPT.md:193-200`

No matching upstream producer contract was found in Architect, CE, or Responsive by the audited search terms.

Impact:

- Builder can correctly block image-only parity builds.
- Upstream repos cannot yet produce the structured Golden Reference that Builder expects.

### 5.3 Builder-only deterministic Build Intent Brief / `تصویر ذهنی`

Confirmed files:

- `schemas/build-intent-brief.schema.json:3`
- `core/MASTER_PROMPT.md:193-199`

No matching Architect or CE producer contract was found.

Impact:

- Builder must not invent or paraphrase the mental model.
- Runtime asks for a CE-generated package containing `build_intent_brief`, but CE does not yet define that output.

### 5.4 CE producer package does not carry all new Builder-required visual-intent contracts

Confirmed files:

- CE package schema: `schemas/builder_executable_package.schema.json:23-54`
- Builder CE normalizer: `scripts/normalize-ce-builder-executable-package.mjs:206-257`

CE carries `reference_paradigm_lock` and `paradigm_to_structure_map` for `visual_parity_build`, but the Builder normalizer does not carry:

- `golden_reference_contract`
- `build_intent_brief`
- `experience_intent`
- spatial lexicon version metadata except through missing brief

Impact:

- CE can prove reference paradigm, but cannot yet satisfy Builder's newer Golden Reference / Build Intent runtime gates.

### 5.5 Architect direct-to-Builder wording drift

Confirmed files:

- Architect README says CE must inspect before Builder: `README.md:81-100`
- Stage 11 says it converts handoff into a copy-ready `Builder_Context_Package` for Builder: `stages/11_BUILDER_FEED_EXPORT.md:13-18`, `42-98`

Impact:

- The repo-level role statement is correct.
- Stage-level export language still preserves a direct-to-Builder mental model.

### 5.6 Responsive lacks scoped Golden Reference linkage

Confirmed files:

- Responsive start packet forbids mobile/tablet inference from desktop evidence: `contracts/EV4_RESPONSIVE_START_PACKET_CONTRACT.md:31-42`
- Responsive main input treats raw screenshot as evidence, not baseline: `contracts/MAIN_PIPELINE_HANDOFF_INPUT_CONTRACT.md:18-23`, `124-147`
- Responsive payload identity schema exists: `schemas/ev4-responsive-payload-identity.schema.json:14-20`

Missing:

- `golden_reference_contract.reference_id`
- `reference_version`
- `scope: desktop|tablet|mobile|global`
- reference family / supersession linkage
- per-viewport reference authorization

Impact:

- Responsive is protected against raw screenshot authority.
- Responsive is not yet tied to the same Golden Reference family used by Builder.

### 5.7 Version consistency is repo-local, not ecosystem-wide

Confirmed files:

- Builder central validation includes version consistency, schema registry, project pack, CE adapter, Golden Reference, Build Intent, Visual Parity, runtime behavior. Evidence: `scripts/validate.mjs:6-41`.
- Responsive has payload identity/content hash schema. Evidence: `schemas/ev4-responsive-payload-identity.schema.json:14-20`.
- CE has pytest and reference-paradigm validation, but no general ecosystem version-consistency validator found. Evidence: `.github/workflows/validate-fixtures.yml:19-23`; `package.json:7-10`.
- Architect workflow was not found in this audit search.

Impact:

- Contract drift can pass in one repo while breaking another.

---

## 6. Suspected gaps needing follow-up

These are not listed as hard blockers unless confirmed by a dedicated patch audit.

1. **CE `reference_paradigm_lock.py` contains a duplicated `validate_path` definition line sequence.**
   - Evidence: `validator/reference_paradigm_lock.py:130-133`.
   - It appears syntactically survivable because the second definition overwrites the first, but it is a hygiene and maintainability risk.

2. **CE-to-Builder action class scope may be under-carried.**
   - Builder input contract requires actionable class instructions to resolve `Local Classes` / `Global Classes`. Evidence: `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md:79-99`.
   - CE normalizer carries `active_class` but no obvious `active_class_scope` mapping in `normalizeAction`. Evidence: `scripts/normalize-ce-builder-executable-package.mjs:111-133`.
   - Builder may rely on repository defaults for Smart Home BEM-style classes, but shared contracts should not depend on project-specific defaults.

3. **Builder `first_batch_structure_intent` schema appears Smart-Home-specific.**
   - Builder schema currently constrains values such as `house-center`, `3-left-3-right`, `pill-card`, `left-center-right`. Evidence: `schemas/builder-context-package.schema.json:3`.
   - CE schema allows generic strings for layout/distribution/repeated unit. Evidence: `schemas/reference-paradigm-lock.schema.json:36-50`, `58-116`.
   - This is acceptable for a Smart Home regression fixture, but not for a generic shared contract without widening or relocating the constraint.

4. **Responsive Start Packet and Responsive Main Input may be parallel contracts, not a single producer/consumer schema pair.**
   - Architect defines `EV4_RESPONSIVE_START_PACKET_CONTRACT`. Evidence: `contracts/EV4_RESPONSIVE_START_PACKET_CONTRACT.md:151-241`.
   - Responsive defines `MAIN_PIPELINE_HANDOFF_INPUT_CONTRACT`. Evidence: `contracts/MAIN_PIPELINE_HANDOFF_INPUT_CONTRACT.md:42-99`.
   - Follow-up should confirm whether Responsive validates the exact Architect start packet or only a broader handoff package.

5. **Open Builder PR #36 may alter evidence/diagnostic contract assumptions.**
   - PR #36 is open and unmerged.
   - It is not part of the Golden Reference patch, but it touches diagnostic evidence schemas/template safety and may interact with future shared evidence contracts.

---

## 7. Existing validation/CI coverage

### Architect

No `.github/workflows/*` validation workflow was found by this audit search.

Relevant internal contract files exist, including:

- `schemas/ev4-builder-context-package.schema.json`
- `contracts/EV4_RESPONSIVE_START_PACKET_CONTRACT.md`
- `stages/10_HANDOFF_EXPORT.md`
- `stages/11_BUILDER_FEED_EXPORT.md`

Coverage gap:

- No confirmed CI gate that validates Architect's `ev4-builder-context-package@1.0.0` against Builder's runtime schema.

### Constructability Engineer

Workflow:

- `.github/workflows/validate-fixtures.yml:3-23`

Runs:

```text
pytest -q
python scripts/validate-behavioral-rule-coverage.py
npm run test:reference-paradigm-lock
```

Relevant validators:

- `validator/rules.py`
- `validator/reference_paradigm_lock.py`
- `validator/behavioral_rule_coverage.py`

Coverage strengths:

- Builder decisions must be zero.
- Blocking dependencies must be empty.
- Geometry/asset/overlay/responsive/interaction/dynamic/accessibility/UI evidence gates exist.
- Reference paradigm lock validation exists.

Coverage gaps:

- No producer validation for Golden Reference Contract.
- No producer validation for Build Intent Brief.
- No producer validation for Experience Intent.
- No ecosystem-wide schema version consistency check.

### Builder Assistant

Workflow:

- `.github/workflows/schema-validation.yml:3-26`

Runs:

```text
npm run validate
```

Central validation includes:

- version consistency
- schema registry
- project pack build
- builder context package
- cross-field validation
- reference paradigm gate
- Golden Reference
- Spatial Lexicon
- Build Intent Template
- Build Intent Brief
- Experience Intent
- Visual Parity
- user-facing wording
- runtime behavior
- CE reference map adapter
- CE Builder package adapter

Evidence: `scripts/validate.mjs:6-41`.

Coverage strengths:

- Strongest current repo-level contract coverage.
- Explicit prompt-injection and package authorization gate.
- CE adapter is tested.

Coverage gaps:

- Strong consumer validation cannot compensate for missing upstream producers.
- Same schema version as Architect but different schema definition remains unresolved.

### Responsive Architect

Workflow:

- `.github/workflows/validate.yml:3-35`

Runs:

```text
python validation/e2e/run_responsive_tree_architecture_refactor_check.py
```

Separate workflow:

- `.github/workflows/run-ledger.yml:3-13` is disabled and says to use Validate workflow.

Coverage strengths:

- Responsive tree architecture refactor check exists.
- Payload identity schema exists.
- Evidence ingest schema exists.

Coverage gaps:

- No Golden Reference family/scope linkage found.
- No confirmed validation against Architect `EV4_RESPONSIVE_START_PACKET_CONTRACT` as a shared machine-readable schema.

### Local validation status

A local clone/test run was attempted in the audit environment, but `git clone` failed because the container could not resolve `github.com`. Therefore no local `npm run validate`, `pytest`, or responsive validation command was executed in this pass. This report relies on repository file inspection and workflow/check inventory.

---

## 8. Free-text injection/drift risks

### Existing protections

Builder has strong explicit protections:

- Packages and copied handoffs are data, not runtime instructions. Evidence: `core/MASTER_PROMPT.md:36`.
- Legacy `builder_assistant_prompt_seed` and `confirmation_sentence` are untrusted/deprecated. Evidence: `README.md:101-119` and `input-contracts/BUILDER_CONTEXT_INPUT_CONTRACT.md:102-147`.
- Prompt-injection-like text is scanned in `scripts/validate-package.mjs:85-158`.
- Package authorization/digest checks are enforced in `scripts/validate-package.mjs:168-217`.

CE has partial protections:

- Unresolved decision keys and values are enumerated. Evidence: `validator/rules.py:15-39`.
- First batch action parameters must not hide unresolved decisions. Evidence: `validator/rules.py:237-262` and continuation in `validator/rules.py:260-273`.
- Executable strategy map must require zero Builder decisions. Evidence: `validator/rules.py:163-234`.

Architect has packaging protections:

- `/handoff-export` must not invent settings or add classes/widgets/assets. Evidence: `stages/10_HANDOFF_EXPORT.md:19-33`.
- `/builder-feed-export` no longer emits legacy confirmation sentence / prompt seed in new packages. Evidence: `stages/11_BUILDER_FEED_EXPORT.md:102-126`.

Responsive has baseline protections:

- Raw screenshots and visual references are evidence only, not authoritative baseline. Evidence: `contracts/MAIN_PIPELINE_HANDOFF_INPUT_CONTRACT.md:124-147`.

### Remaining risks

1. **Instruction-like text inside CE action parameters.**
   - CE package actions carry `parameters`, and Builder normalizer maps `parameters.instruction` into Builder action `instruction`.
   - Builder scans for prompt-injection markers, but semantic overreach can still occur if a free-text action says something like “make final responsive behavior production-ready” without matching structured authorization.

2. **Advisory vs executable fields need an explicit authority matrix.**
   - `experience_intent` is advisory only.
   - `build_intent_brief` is explanatory only.
   - `golden_reference_contract` is authoritative for parity.
   - These should be encoded in a shared authority matrix before schema extraction.

3. **Duplicated schema names can turn stale free text into apparent authority.**
   - A package that validates against Architect's older `ev4-builder-context-package@1.0.0` may not satisfy Builder's runtime contract.

---

## 9. Smart Home Connector failure prevention matrix

| Failure | Architect | CE | Builder | Responsive | Current prevention result |
|---|---|---|---|---|---|
| Image-only reference treated as sufficient | Stage 11 still has `reference_screenshot_instruction` as visual reference only, but no Golden Reference producer. | Reference paradigm lock can be required for visual parity, but no Golden Reference contract. | Strong prevention: image-only references cannot authorize parity builds. Evidence: `protocols/GOLDEN_REFERENCE_CONTRACT.md:5-7`; `core/MASTER_PROMPT.md:193-199`. | Raw screenshot is evidence only, not baseline. | **Partially prevented. BLOCKER remains upstream Golden Reference production.** |
| Vertical-left-list build when reference requires 3-left-3-right | No explicit Golden/first-batch intent producer found. | CE reference map and adapter require left/right evidence. Evidence: `scripts/normalize-ce-reference-map.mjs:83-116`, `156-179`. | Reference paradigm gate and invalid fixtures target wrong vertical starts. Evidence: `package.json` validation script references `first_batch_vertical_stack_for_symmetric_reference.json` and Smart Home wrong paradigm regression. | Not relevant pre-build. | **Mostly prevented in CE+Builder for Smart Home; not generalized/shared.** |
| Builder inventing mental model | Missing producer. | Missing producer. | Strong prevention: Builder must not invent/paraphrase Build Intent Brief and may show only validated `تصویر ذهنی`. Evidence: `core/MASTER_PROMPT.md:193-199`. | Missing. | **Prevented at Builder runtime, but producer missing.** |
| Builder claiming desktop complete before Golden Reference parity | Missing. | Partial through reference paradigm / visual parity package flag. | Strong prevention through visual parity and completion/status wording gates. Evidence: `schemas/visual-parity-check.schema.json:3`; `schemas/completion-status.schema.json:3`; `core/MASTER_PROMPT.md:186-200`. | Production boundary prevents final claims but lacks Golden link. | **Prevented in Builder; ecosystem link incomplete.** |
| Responsive branch inventing mobile/tablet reference behavior without scoped reference contract | Responsive Start Packet can preserve unknowns and forbid desktop-as-mobile proof. Evidence: `contracts/EV4_RESPONSIVE_START_PACKET_CONTRACT.md:31-42`, `245-254`. | Not linked. | Not linked. | Main input forbids raw screenshot baseline and requires evidence. Evidence: `contracts/MAIN_PIPELINE_HANDOFF_INPUT_CONTRACT.md:18-23`, `124-147`. | **Partially prevented. Missing scoped Golden Reference family contract.** |

---

## 10. Recommended patch order

### Patch 0: audit only

Status: this file.

Output:

```text
docs/CROSS_REPO_CONTRACT_ALIGNMENT_AUDIT.md
```

No schema, runtime, validator, or source file movement is included.

### Patch 1: role alignment

Goal: resolve ownership before sharing schemas.

Required decisions:

1. Define whether Architect Stage 11 is:
   - deprecated compatibility export;
   - CE intake source pack;
   - or still allowed to emit Builder-ready packages only when CE proof is embedded.

2. Assign producer/consumer owners for:
   - `golden_reference_contract`
   - `build_intent_brief`
   - `spatial_lexicon_version_used`
   - `experience_intent`
   - `visual_parity_check`
   - `reference_paradigm_lock`
   - `first_batch_structure_intent`
   - `Builder Executable Package`
   - normalized `Builder_Context_Package`
   - `production_ready` / `production_ready_allowed`

3. Rename or version-split divergent `ev4-builder-context-package@1.0.0` definitions.

4. Decide whether CE or Architect is the authoritative producer of Build Intent Brief.

5. Define Responsive Golden Reference family/scope linkage.

### Patch 2: shared contracts repo

Start only after Patch 1.

Initial shared candidates:

- role boundary contract
- payload identity / digest envelope
- selected candidate lock fields
- production readiness boundary fields
- Golden Reference Contract
- Build Intent Brief
- Spatial Lexicon version contract
- Experience Intent enum vocabulary
- Reference Paradigm Lock
- Visual Parity Check
- Completion Status
- Builder Executable Package envelope
- normalized Builder Context Package envelope
- Responsive Start Packet reference-link extension

Rules:

- Do not move schemas until import/validation strategy is defined.
- Do not weaken any repo-local validation gate.
- Mark migrated contracts with explicit owner and consumer lists.

### Patch 3: CE producer integration

Goal: CE produces all Builder-required structured visual-intent artifacts when visual parity is required.

Required work:

1. Extend CE Builder Executable Package with either:
   - valid `golden_reference_contract`, `build_intent_brief`, `experience_intent`, and spatial lexicon version pins; or
   - explicit `not_required` / `blocked_missing_*` states.

2. Add CE validators for Golden Reference and Build Intent if CE owns them.

3. Add fixtures for:
   - valid Smart Home Golden Reference parity package;
   - missing Golden Reference blocked;
   - image-only reference blocked;
   - Build Intent hash mismatch blocked;
   - wrong 3-left-3-right distribution blocked.

4. Resolve generic vs Smart-Home-specific `first_batch_structure_intent` enums.

### Patch 4: Builder consumer integration

Goal: Builder consumes shared contracts, not manually copied local variants.

Required work:

1. Import or mirror shared schemas with version checks.
2. Validate CE-produced Golden Reference and Build Intent artifacts.
3. Remove ambiguity between Architect direct Builder Context Package and CE normalized package.
4. Preserve strict package authorization/digest behavior.
5. Keep user-facing wording gates for:
   - `تصویر ذهنی`
   - desktop complete wording
   - production readiness
   - visual parity pass/fail/pending

### Patch 5: Architect/Responsive integration

Goal: connect upstream source evidence and downstream responsive behavior to the same reference family.

Architect:

1. Emit source evidence and candidate reference metadata without claiming Builder-ready execution.
2. Mark Stage 11 as CE intake/compatibility unless CE proof is embedded.
3. Stop using the same `ev4-builder-context-package@1.0.0` name for a divergent direct export.

Responsive:

1. Extend Responsive Start Packet/Main Input with:
   - `golden_reference_id`
   - `golden_reference_version`
   - `reference_scope`
   - `reference_family_id`
   - `source_asset_digest`
   - `supersedes`
2. Block mobile/tablet reference behavior unless scoped reference evidence is present or explicitly absent.
3. Preserve current rule that desktop screenshots do not prove mobile behavior.

---

## Final decision

Canonical `EV4-Shared-Contracts` schema migration must wait.

Allowed next step:

```text
Patch 1 — role alignment
```

Do not start Patch 2 until Patch 1 resolves producer/consumer ownership and duplicate schema-version drift.
