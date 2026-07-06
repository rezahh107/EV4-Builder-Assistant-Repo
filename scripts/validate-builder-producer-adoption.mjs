#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const errors = [];
const PG_COMMIT = 'ea19c22c32458068e167b267da8b819e9263cdf7';
const PRODUCER_SHA = 'c556bb9deeccdcafeb885a1c8b3dbd660e4e06f452b8ac3c7040d21377465fcc';
const STAGE_SHA = 'fc1ec6d3f7aecbabaeb0a3455d9eb42788779d2fa1531e8c7b2cb3bde706a886';
const fail = (code, path) => errors.push({ code, path });
const read = (p) => fs.readFileSync(p, 'utf8');
const load = (p) => JSON.parse(read(p));
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

if (sha('contracts/project-gate/producer-gate-export.v1.schema.json') !== PRODUCER_SHA) fail('BUILDER_P03_PRODUCER_SCHEMA_HASH_MISMATCH', 'contracts/project-gate/producer-gate-export.v1.schema.json');
if (sha('contracts/project-gate/stage-bundle.v1.schema.json') !== STAGE_SHA) fail('BUILDER_P03_STAGE_BUNDLE_HASH_MISMATCH', 'contracts/project-gate/stage-bundle.v1.schema.json');

const lock = load('contracts/project-gate/producer-gate-export.v1.lock.json');
if (lock.lock_schema !== 'project-gate-common-contract-lock.v1') fail('BUILDER_P03_LOCK_SCHEMA_MISMATCH', 'lock_schema');
if (lock.contract_owner !== 'rezahh107/EV4-Project-Gate') fail('BUILDER_P03_LOCK_OWNER_MISMATCH', 'contract_owner');
if (lock.canonical?.commit_sha !== PG_COMMIT) fail('BUILDER_P03_LOCK_COMMIT_MISMATCH', 'canonical.commit_sha');
if (lock.canonical?.file_sha256 !== PRODUCER_SHA) fail('BUILDER_P03_LOCK_CANONICAL_HASH_MISMATCH', 'canonical.file_sha256');
if (lock.vendored?.file_sha256 !== PRODUCER_SHA) fail('BUILDER_P03_LOCK_VENDOR_HASH_MISMATCH', 'vendored.file_sha256');
if (lock.verification?.byte_equality_required !== true) fail('BUILDER_P03_BYTE_EQUALITY_NOT_REQUIRED', 'verification.byte_equality_required');
if (lock.verification?.compare_against_moving_default_branch !== false) fail('BUILDER_P03_MOVING_DEFAULT_ALLOWED', 'verification.compare_against_moving_default_branch');

const workflow = read('.github/workflows/verify-project-gate-contract.yml');
if (!workflow.includes(`verify-vendored-common-contract.yml@${PG_COMMIT}`)) fail('BUILDER_P03_WORKFLOW_NOT_PINNED', 'workflow.uses');
if (workflow.includes('@main')) fail('BUILDER_P03_WORKFLOW_USES_MAIN', 'workflow.uses');
if (!workflow.includes('contents: read')) fail('BUILDER_P03_WORKFLOW_NOT_READ_ONLY', 'workflow.permissions');

const manifest = load('data/builder-pipeline-manifest.v1.json');
const phases = manifest.pipeline_phases || [];
const expected = ['builder-intake-validation','builder-prebuild-authorization','builder-execution-loop','builder-evidence-consolidation','builder-completion-assessment','builder-project-gate-export'];
if (manifest.runtime_model?.runtime_states_are_pipeline_phases !== false) fail('BUILDER_P03_RUNTIME_STATE_PHASE_CONFUSION', 'runtime_model');
if (phases.length !== expected.length) fail('BUILDER_P03_PHASE_COUNT_MISMATCH', 'pipeline_phases');
if (new Set(phases.map((p) => p.ordinal)).size !== phases.length) fail('BUILDER_P03_DUPLICATE_PHASE_ORDINAL', 'pipeline_phases');
expected.forEach((id, i) => { if (phases[i]?.phase_id !== id) fail('BUILDER_P03_PHASE_ID_MISMATCH', `pipeline_phases.${i}`); });
if (phases.at(-1)?.phase_id !== 'builder-project-gate-export') fail('BUILDER_P03_FINAL_PHASE_NOT_EXPORT', 'pipeline_phases');

const payload = load('tests/valid/builder_stage_payload_minimal.json');
if (payload.boundary_assertions?.responsive_correctness_claimed_by_builder !== false) fail('BUILDER_P03_RESPONSIVE_OVERCLAIM', 'boundary_assertions');
if (payload.completion_assessment?.production_ready_claim !== false) fail('BUILDER_P03_PRODUCTION_OVERCLAIM', 'completion_assessment');
if (payload.responsive_handoff_candidate?.candidate_status === 'eligible' && !payload.real_execution_evidence?.records?.length) fail('BUILDER_P03_HANDOFF_WITHOUT_EVIDENCE_REF', 'responsive_handoff_candidate');

const invalid = load('tests/invalid/builder_stage_payload_completed_claims_production_ready.json');
if (invalid.completion_assessment?.production_ready_claim !== true) fail('BUILDER_P03_INVALID_FIXTURE_NOT_INVALID', 'tests/invalid');

if (errors.length) {
  errors.sort((a, b) => a.code.localeCompare(b.code) || a.path.localeCompare(b.path));
  for (const e of errors) console.error(`${e.code}: ${e.path}`);
  process.exit(1);
}
console.log('Builder producer adoption validation passed.');
