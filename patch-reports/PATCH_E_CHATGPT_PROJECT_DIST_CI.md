# Patch E — Deployable ChatGPT Project Source Pack & CI

## Branch

`patch/e-chatgpt-project-dist-ci`

Base branch: `main`

## خلاصه

Patch E یک source pack قابل آپلود برای ChatGPT Project اضافه می‌کند، بدون تغییر runtime rules یا معماری Smart Home.

## Generated pack files

Root:

```text
dist/chatgpt-project/
```

Files:

```text
dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt
dist/chatgpt-project/SOURCE_PACK_MANIFEST.json
dist/chatgpt-project/BUILD_REPORT.json
```

Knowledge files:

```text
dist/chatgpt-project/knowledge/01_RUNTIME_CORE.md
dist/chatgpt-project/knowledge/02_INPUT_AUTHORIZATION.md
dist/chatgpt-project/knowledge/03_MODE_STATE_COMMANDS.md
dist/chatgpt-project/knowledge/04_ACTION_BATCH_AND_CLASS_SAFETY.md
dist/chatgpt-project/knowledge/05_UI_EVIDENCE_AND_CORRECTION.md
dist/chatgpt-project/knowledge/06_LAYOUT_STYLE_RESPONSIVE_ACCESSIBILITY.md
dist/chatgpt-project/knowledge/07_CHECKPOINT_EVIDENCE_COMPLETION.md
dist/chatgpt-project/knowledge/08_OFFICIAL_ELEMENTOR_CAPABILITY_INDEX.md
dist/chatgpt-project/knowledge/09_REFERENCE_METHODS_BOUNDARY.md
dist/chatgpt-project/knowledge/smart-home-connector.compact.md
```

## Pack limits

```yaml
project_instructions_chars: 3930
project_instructions_limit: 8000
project_instructions_warning_threshold: 7800
knowledge_file_count: 10
knowledge_file_limit: 25
duplicate_project_instructions_in_knowledge: false
```

## Script / CI

Added:

```text
scripts/build-project-pack.mjs
npm run build:project-pack
```

The script verifies:

```text
- PROJECT_INSTRUCTIONS.txt exists.
- Project Instructions char count is below configured limit.
- knowledge file count is <= 25.
- no Project Instructions duplicate exists in knowledge.
- every manifest path exists.
- manifest SHA-256 hashes match file contents.
- BUILD_REPORT counts match actual pack.
```

CI update:

```text
.github/workflows/schema-validation.yml
```

New step:

```text
Validate ChatGPT project source pack -> npm run build:project-pack
```

## Setup guide update

Updated:

```text
docs/CHATGPT_PROJECT_SETUP_GUIDE.md
```

It now instructs the user to paste:

```text
dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt
```

into ChatGPT Project Instructions, and upload only files inside:

```text
dist/chatgpt-project/knowledge/
```

as Knowledge files.

## Validation result

Pending PR CI at report creation time.

Expected commands:

```bash
npm run build:project-pack
npm run validate:builder-context
npm run validate:cross-field
npm run validate:checkpoint
npm run validate:intake-result
npm run validate:session-state
```

## Scope notes

- No runtime behavior was changed beyond distribution/setup references.
- No Smart Home architecture, approved classes, or `selected_candidate_id` were changed.
- README, STATUS, and CHANGELOG were not updated to avoid parallel conflict surface.
