# CHATGPT_PROJECT_SETUP_GUIDE — EV4 Builder Assistant

Version: 0.3.2
Status: deployable_project_pack_added
Date: 2026-06-28

---

## Purpose

This guide explains how to create a ChatGPT Project for `EV4 Builder Assistant` using the compact deployable source pack in:

```text
dist/chatgpt-project/
```

The modular repository remains the source of truth for development. The `dist/chatgpt-project` folder is the compact deployment artifact for ChatGPT Project setup.

---

## Recommended Upload Method

Use the generated pack:

```text
dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt
dist/chatgpt-project/knowledge/
dist/chatgpt-project/SOURCE_PACK_MANIFEST.json
dist/chatgpt-project/BUILD_REPORT.json
```

### Project Instructions

Paste this file into the ChatGPT Project Instructions field:

```text
dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt
```

Do not also upload this file into Knowledge unless a future pack manifest explicitly allows duplication.

### Knowledge files

Upload the files inside:

```text
dist/chatgpt-project/knowledge/
```

Current pack target:

```yaml
knowledge_file_count: 10
knowledge_file_limit: 25
```

---

## Pack Verification

Before uploading, verify the pack:

```bash
npm run build:project-pack
```

The verification checks:

```text
- Project Instructions character count is below the configured limit.
- Knowledge file count is <= 25.
- Every SOURCE_PACK_MANIFEST.json path exists.
- Manifest SHA-256 hashes match file contents.
- PROJECT_INSTRUCTIONS.txt is not duplicated inside Knowledge.
- BUILD_REPORT.json counts match the actual pack.
```

---

## Existing Project Role

Use the project behavior and session-start rules already encoded in:

```text
dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt
dist/chatgpt-project/knowledge/
```

For the Smart Home test seed, use:

```text
examples/smart-home-connector/start_session_prompt.md
examples/smart-home-connector/expected_first_response.md
```
