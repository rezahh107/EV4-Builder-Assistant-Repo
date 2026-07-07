#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const errors = [];
const PG_COMMIT = 'ea19c22c32458068e167b267da8b819e9263cdf7';
const PRODUCER_SHA = 'c556bb9deeccdcafeb885a1c8b3dbd660e4e06f452b8ac3c7040d21377465fcc';
const STAGE_SHA = 'fc1ec6d3f7aecbabaeb0a3455d9eb42788779d2fa1531e8c7b2cb3bde706a886';
const fail = (code, path, bucket = errors) => bucket.push({ code, path });

function text(path, code, bucket = errors) {
  try { return fs.readFileSync(path, 'utf8'); }
  catch { fail(code, path, bucket); return null; }
}
function parsed(path, code, bucket = errors) {
  const value = text(path, code, bucket);
  if (value === null) return null;
  try { return JSON.parse(value); }
  catch { fail(code, path, bucket); return null; }
}
function hash(path, code) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'); }
  catch { fail(code, path); return null; }
}

const guardProbe = [];
text('__missing_builder_guard_probe__', 'BUILDER_P03_GUARD_SELFTEST_MISSING', guardProbe);
parsed('scripts/validate-builder-producer-adoption.mjs', 'BUILDER_P03_GUARD_SELFTEST_JSON', guardProbe);
if (!guardProbe.some((e) => e.code === 'BUILDER_P03_GUARD_SELFTEST_MISSING')) fail('BUILDER_P03_GUARD_SELFTEST_FAILED', 'validator.guards');
if (!guardProbe.some((e) => e.code === 'BUILDER_P03_GUARD_SELFTEST_JSON')) fail('BUILDER_P03_GUARD_SELFTEST_FAILED', 'validator.guards');

const producerHash = hash('contracts/project-gate/producer-gate-export.v1.schema.json', 'BUILDER_P03_PRODUCER_SCHEMA_UNREADABLE');
if (producerHash !== null && producerHash !== PRODUCER_SHA) fail('BUILDER_P03_PRODUCER_SCHEMA_HASH_MISMATCH', 'contracts/project-gate/producer-gate-export.v1.schema.json');
const stageHash = hash('contracts/project-gate/stage-bundle.v1.schema.json', 'BUILDER_P03_STAGE_BUNDLE_UNREADABLE');
if (stageHash !== null && stageHash !== STAGE_SHA) fail('BUILDER_P03_STAGE_BUNDLE_HASH_MISMATCH', 'contracts/project-gate/stage-bundle.v1.schema.json');

const lock = parsed('contracts/project-gate/producer-gate-export.v1.lock.json', 'BUILDER_P03_LOCK_UNREADABLE_OR_MALFORMED');
if (lock) {
  if (lock.lock_schema !== 'project-gate-common-contract-lock.v1') fail('BUILDER_P03_LOCK_SCHEMA_MISMATCH', 'lock_schema');
  if (lock.contract_owner !== 'rezahh107/EV4-Project-Gate') fail('BUILDER_P03_LOCK_OWNER_MISMATCH', 'contract_owner');
  if (lock.canonical?.commit_sha !== PG_COMMIT) fail('BUILDER_P03_LOCK_COMMIT_MISMATCH', 'canonical.commit_sha');
  if (lock.canonical?.file_sha256 !== PRODUCER_SHA) fail('BUILDER_P03_LOCK_CANONICAL_HASH_MISMATCH', 'canonical.file_sha256');
  if (lock.vendored?.file_sha256 !== PRODUCER_SHA) fail('BUILDER_P03_LOCK_VENDOR_HASH_MISMATCH', 'vendored.file_sha256');
  if (lock.verification?.byte_equality_required !== true) fail('BUILDER_P03_BYTE_EQUALITY_NOT_REQUIRED', 'verification.byte_equality_required');
  if (lock.verification?.compare_against_moving_default_branch !== false) fail('BUILDER_P03_MOVING_DEFAULT_ALLOWED', 'verification.compare_against_moving_default_branch');
}

const workflow = text('.github/workflows/verify-project-gate-contract.yml', 'BUILDER_P03_WORKFLOW_UNREADABLE');
if (workflow) {
  const usesRefs = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)\s*$/gm)].map((m) => m[1]);
  if (!usesRefs.includes(`rezahh107/EV4-Project-Gate/.github/workflows/verify-vendored-common-contract.yml@${PG_COMMIT}`)) fail('BUILDER_P03_WORKFLOW_NOT_PINNED', 'workflow.uses');
  if (usesRefs.some((ref) => /@(?:main|master)$/.test(ref))) fail('BUILDER_P03_WORKFLOW_USES_MOVING_REF', 'workflow.uses');
  if (!/^\s*contents:\s*read\s*$/m.test(workflow)) fail('BUILDER_P03_WORKFLOW_NOT_READ_ONLY', 'workflow.permissions');
}

const manifest = parsed('data/builder-pipeline-manifest.v1.json', 'BUILDER_P03_MANIFEST_UNREADABLE_OR_MALFORMED');
if (manifest) {
  const phases = manifest.pipeline_phases || [];
  const expected = ['builder-intake-validation','builder-prebuild-authorization','builder-execution-loop','builder-evidence-consolidation','builder-completion-assessment','builder-project-gate-export'];
  if (manifest.runtime_model?.runtime_states_are_pipeline_phases !== false) fail('BUILDER_P03_RUNTIME_STATE_PHASE_CONFUSION', 'runtime_model');
  if (phases.length !== expected.length) fail('BUILDER_P03_PHASE_COUNT_MISMATCH', 'pipeline_phases');
  if (new Set(phases.map((p) => p.ordinal)).size !== phases.length) fail('BUILDER_P03_DUPLICATE_PHASE_ORDINAL', 'pipeline_phases');
  expected.forEach((id, i) => { if (phases[i]?.phase_id !== id) fail('BUILDER_P03_PHASE_ID_MISMATCH', `pipeline_phases.${i}`); });
  if (phases.at(-1)?.phase_id !== 'builder-project-gate-export') fail('BUILDER_P03_FINAL_PHASE_NOT_EXPORT', 'pipeline_phases');
}

const requiredCandidate = ['schema','valid_builder_stage_payload','valid_final_stage_bundle','valid_producer_gate_export','authorized_builder_input','selected_candidate_identity_preserved','active_repair_packet','blocking_builder_diagnostics','real_elementor_execution_evidence_ref','layout_check_ref','completion_gate_ref','latest_checkpoint_ref','unconfirmed_execution_affecting_actions','responsive_correctness_claimed_by_builder'];
const payload = parsed('tests/valid/builder_stage_payload_minimal.json', 'BUILDER_P03_VALID_PAYLOAD_UNREADABLE_OR_MALFORMED');
if (payload) {
  const candidate = payload.responsive_handoff_candidate || {};
  for (const key of requiredCandidate) if (!(key in candidate)) fail('BUILDER_P03_HANDOFF_CANDIDATE_FIELD_MISSING', `responsive_handoff_candidate.${key}`);
  if (candidate.responsive_correctness_claimed_by_builder !== false) fail('BUILDER_P03_RESPONSIVE_OVERCLAIM', 'responsive_handoff_candidate');
  if (payload.completion_assessment?.production_ready_claim !== false) fail('BUILDER_P03_PRODUCTION_OVERCLAIM', 'completion_assessment');
  if (candidate.candidate_status === 'eligible' && !payload.real_execution_evidence?.records?.length) fail('BUILDER_P03_HANDOFF_WITHOUT_EVIDENCE_REF', 'responsive_handoff_candidate');
}

const invalid = parsed('tests/invalid/builder_stage_payload_completed_claims_production_ready.json', 'BUILDER_P03_INVALID_PAYLOAD_UNREADABLE_OR_MALFORMED');
if (invalid) {
  const candidate = invalid.responsive_handoff_candidate || {};
  if (invalid.completion_assessment?.production_ready_claim !== true) fail('BUILDER_P03_INVALID_FIXTURE_NOT_INVALID', 'tests/invalid');
  if (requiredCandidate.every((key) => key in candidate)) fail('BUILDER_P03_INVALID_FIXTURE_HAS_FULL_CANDIDATE_GATES', 'tests/invalid');
}

if (errors.length) {
  errors.sort((a, b) => a.code.localeCompare(b.code) || a.path.localeCompare(b.path));
  for (const e of errors) console.error(`${e.code}: ${e.path}`);
  process.exit(1);
}
console.log('Builder producer adoption validation passed.');
