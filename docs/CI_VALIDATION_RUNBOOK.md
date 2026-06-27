# CI_VALIDATION_RUNBOOK — EV4 Builder Assistant

Version: 0.1.0
Status: active
Date: 2026-06-27

---

## Purpose

This runbook explains how to run and interpret the repository validation workflow.

The workflow validates schema shape, negative fixtures, checkpoint fixtures, and cross-field package logic.

---

## Workflow

```text
.github/workflows/schema-validation.yml
```

Workflow name:

```text
Schema validation
```

Supported triggers:

```text
push
pull_request
workflow_dispatch
```

`workflow_dispatch` allows manual execution from GitHub UI.

---

## How To Run Manually

1. Open the repository in GitHub.
2. Go to `Actions`.
3. Select `Schema validation`.
4. Click `Run workflow`.
5. Choose branch `main` unless testing another branch.
6. Start the workflow.

---

## Expected Passing Steps

```text
Checkout
Setup Node
Validate valid Builder_Context_Package fixtures
Ensure invalid Builder_Context_Package fixtures fail
Run cross-field package validation
Ensure cross-field invalid fixtures fail
Validate checkpoint fixtures
Compile session-state schema
```

---

## What A Pass Means

A passing workflow means:

```text
- schema syntax is usable;
- valid Builder_Context_Package fixture passes;
- Smart Home example package passes schema validation;
- schema-invalid fixtures fail as expected;
- cross-field validator passes valid packages;
- cross-field invalid fixture fails as expected;
- checkpoint valid fixture passes;
- checkpoint invalid fixture fails;
- session-state schema compiles with checkpoint schema.
```

---

## What A Pass Does Not Mean

A passing workflow does not prove:

```text
- real Elementor UI controls exist;
- live Elementor render matches the screenshot;
- responsive behavior is correct;
- SVG/assets are safe and final;
- real Elementor export JSON / EDIS is valid;
- exact pixel matching is achieved;
- production readiness.
```

---

## Failure Triage

### Valid package fails

Likely causes:

```text
schema changed but valid fixture was not updated
example package missing a newly required field
JSON syntax error
```

Fix:

```text
update tests/valid/builder_context_package.json
update examples/smart-home-connector/builder_context_package.json
```

### Invalid fixture passes unexpectedly

Likely causes:

```text
schema is too permissive
invalid fixture no longer violates the schema
```

Fix:

```text
harden schemas/builder-context-package.schema.json
or update the invalid fixture so it targets a real forbidden condition
```

### Cross-field validator fails valid package

Likely causes:

```text
missing class map entry
unknown target_element
unknown child node reference
generation/source mismatch
```

Fix:

```text
update the fixture/package or adjust scripts/validate-package.mjs if the rule is too strict
```

### Cross-field invalid fixture passes

Likely causes:

```text
validator missed a logical contradiction
fixture no longer violates cross-field rules
```

Fix:

```text
harden scripts/validate-package.mjs
or update tests/invalid-cross-field/*.json
```

### Checkpoint fixture fails

Likely causes:

```text
checkpoint.schema.json changed
fixture is stale
```

Fix:

```text
update tests/valid/checkpoint.json
or correct schemas/checkpoint.schema.json
```

---

## Local Validation Commands

```text
npm run validate:builder-context
npm run validate:cross-field
npm run validate:checkpoint
```

These commands do not fully replace the GitHub Actions workflow, but they help debug locally.

---

## Release Rule

Do not treat the repo as stable until:

```text
- Schema validation workflow passes;
- one manual Smart Home Builder Assistant session is run;
- real session notes are recorded;
- docs/REPOSITORY_GUIDE.md is expanded with real lessons.
```
