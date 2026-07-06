# Builder Producer Gate Export

Status: implemented in Builder repo, pending human review and future Project Gate integration.

Flow:

```text
Builder Stage Payload -> Stage Evidence Bundle v1 -> Producer Gate Export v1
```

Boundaries:

- Builder owns `ev4-builder-stage-payload@1.0.0`.
- Project Gate owns `producer-gate-export.v1` and `stage-evidence-bundle.v1`.
- Builder does not create a Responsive Input Package.
- Builder does not claim Responsive acceptance.
- Builder does not claim responsive correctness.
- Builder does not claim production readiness.
- Silent fallback is forbidden.

Pin:

```yaml
project_gate_commit: ea19c22c32458068e167b267da8b819e9263cdf7
producer_gate_export_schema_sha256: c556bb9deeccdcafeb885a1c8b3dbd660e4e06f452b8ac3c7040d21377465fcc
stage_bundle_schema_sha256: fc1ec6d3f7aecbabaeb0a3455d9eb42788779d2fa1531e8c7b2cb3bde706a886
```

Validation entry:

```bash
node scripts/validate-builder-producer-adoption.mjs
npm run validate
```

The canonical Builder pipeline manifest is `data/builder-pipeline-manifest.v1.json`. It keeps fixed phases separate from runtime states and repeatable action/checkpoint/evidence ledgers.
