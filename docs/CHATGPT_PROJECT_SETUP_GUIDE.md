# CHATGPT_PROJECT_SETUP_GUIDE — EV4 Builder Assistant

Version: 0.3.6
Status: personal_correctness_inspector_pack
Date: 2026-07-22

## Purpose

Use the deterministic deployable pack in `dist/chatgpt-project/`. The modular repository and embedded source sections in `project-pack/source-map.v2.json` remain authoritative; generated `dist` is non-authoritative.

## Generate and Verify

```bash
node scripts/build-project-pack.mjs --write
npm run build:project-pack
```

Generation uses `project-pack/source-map.v2.json`, a temporary build directory, two byte-identical renders, validation before publication, and atomic replacement. Verification rejects hand-edited or stale dist bytes.

## ChatGPT Project Setup

Paste:

```text
dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt
```

Upload the 11 files inside:

```text
dist/chatgpt-project/knowledge/
```

Retain `SOURCE_PACK_MANIFEST.json` and `BUILD_REPORT.json` for local verification; do not upload Project Instructions into Knowledge.

## Personal Intake

Project Gate publishes `builder-input.json`. Before sending it to the ChatGPT Project, run:

```bash
node scripts/builder-inspector.mjs intake \
  --input builder-input.json \
  --output builder-intake-authorization.json
```

Send both files. `project-gate-c2b-receipt.json` remains separate audit evidence and is not required by Builder.

If the Project reports a missing/stale/mismatched capsule, run:

```bash
node scripts/builder-inspector.mjs verify-capsule \
  --input builder-input.json \
  --capsule builder-intake-authorization.json
```

The ChatGPT Project compares visible identities only. It does not run local validators or recompute hashes.

## Resume and Completion

Use `builder-inspector resume` before `استارت` in another chat. Use `builder-inspector completion` before claiming Builder completion. These authorize only the personal Builder workflow.

Builder→Responsive and production readiness are not implemented by this setup. Keep `production_ready: false`.
