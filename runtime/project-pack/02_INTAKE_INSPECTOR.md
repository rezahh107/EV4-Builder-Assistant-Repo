# Explicit Source Intake

Runtime invocation selects exactly one source mode.

```yaml
project-gate:
  sourceArtifactFile: required
  builderInputFile: required
direct-ce:
  sourceArtifactFile: required
  builderInputFile: forbidden
manual-builder-input:
  sourceArtifactFile: forbidden
  builderInputFile: required
```

Canonical commands:

```bash
node scripts/builder-inspector.mjs real-intake project-gate receipt.json builder-input.json runtime-context.json
node scripts/builder-inspector.mjs real-intake direct-ce ce-source.json - runtime-context.json
node scripts/builder-inspector.mjs real-intake manual-builder-input - builder-input.json runtime-context.json
```

Unused paths are rejected. Context references identify bytes actually consumed. `intake` is fixture/compatibility-only.
