import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  inspectOptionalPcvpCarrier,
  PcvpCarrierValidationError
} from '../scripts/lib/pcvp-carrier.mjs';
import { normalizeCeBuilderExecutablePackage } from '../scripts/normalize-ce-builder-executable-package.mjs';
import { validateCeToBuilderContractGate } from '../scripts/validate-ce-to-builder-contract-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_FIXTURE = path.join(ROOT, 'tests/valid/ce_builder_package_adapter_valid.json');
const LOCK_PATH = path.join(ROOT, 'contracts/pcvp/pcvp-v1.lock.json');
const PROFILE_PATH = path.join(ROOT, 'contracts/pcvp/builder.profile.yaml');
const SCHEMA_PATH = path.join(ROOT, 'contracts/pcvp/vendor/decision-kernel/v1.0.0/claim.schema.json');

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function sourcePackage() {
  return readJson(SOURCE_FIXTURE).ce_builder_executable_package;
}

function carrier() {
  return {
    policy_id: 'EV4-PCVP',
    policy_version: '1.0.0',
    source_stage: 'CONSTRUCTABILITY_ENGINEER',
    claims: [
      {
        claim_id: 'CLM-CE-001',
        statement: 'The bounded CE package is supported by source evidence.',
        criticality: 'CRITICAL',
        applicability_state: 'APPLICABLE',
        verification_state: 'VERIFIED',
        lifecycle_state: 'ACTIVE',
        evidence_refs: ['EVD-CE-001'],
        dependency_refs: [],
        assumption_refs: []
      }
    ],
    effects: [
      {
        effect_id: 'EFF-CE-001',
        effect_class: 'DRAFT_ONLY',
        depends_on_claim_ids: ['CLM-CE-001'],
        continuation_state: 'CONTINUE',
        authorization_ref: 'AUTH-CE-001',
        blocker_reason: null,
        permitted_scope: 'provisional Builder handoff only'
      }
    ],
    authorizations: [
      {
        authorization_id: 'AUTH-CE-001',
        basis: 'PROFILE_PREAUTHORIZED',
        status: 'ACTIVE',
        allowed_effect_ids: ['EFF-CE-001'],
        allowed_effect_classes: ['DRAFT_ONLY'],
        bound_unknown_ids: [],
        bound_assumption_ids: [],
        stage_scope: {
          from: 'CONSTRUCTABILITY_ENGINEER',
          through: 'BUILDER_ASSISTANT'
        },
        permitted_scope: 'provisional Builder handoff only',
        valid_until_events: [
          'NEW_MATERIAL_BLOCKER',
          'OWNER_REVOCATION',
          'SCOPE_EXPANSION'
        ]
      }
    ],
    unresolved_items: [],
    stage_summary: {
      owner_projection: 'GREEN',
      yellow_substate: null,
      derived_from_claim_ids: ['CLM-CE-001'],
      current_effect_id: 'EFF-CE-001',
      lifecycle_state: 'ACTIVE',
      derivation_reason: 'critical dependent claim is verified'
    }
  };
}

function withCarrier() {
  const source = sourcePackage();
  source.continuation_assurance = carrier();
  return source;
}

function runBuilderValidator(pkg) {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'ev4-builder-pcvp-'));
  try {
    const packagePath = path.join(temporaryRoot, 'builder_context_package.json');
    writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
    return spawnSync(
      process.execPath,
      ['scripts/validate-package.mjs', packagePath],
      { cwd: ROOT, encoding: 'utf8' }
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function expectInvalidLayer({ code, layer, mutate, expectedSourceStages = ['CONSTRUCTABILITY_ENGINEER'] }) {
  const source = withCarrier();
  mutate(source.continuation_assurance);
  const result = inspectOptionalPcvpCarrier(source, { expectedSourceStages });
  assert.equal(result.status, 'invalid');
  assert.ok(
    result.diagnostics.some((item) => item.code === code),
    `${code} not observed: ${JSON.stringify(result.diagnostics, null, 2)}`
  );
  assert.deepEqual(
    [...new Set(result.diagnostics.map((item) => item.layer))],
    [layer],
    `${code} exposed a later or mixed validation layer.`
  );
  assert.throws(
    () => normalizeCeBuilderExecutablePackage(source),
    PcvpCarrierValidationError
  );
}

function withTemporaryFileMutation(filePath, mutate, callback) {
  const original = readFileSync(filePath);
  try {
    writeFileSync(filePath, mutate(Buffer.from(original)));
    callback();
  } finally {
    writeFileSync(filePath, original);
  }
}

function withTemporarilyUnavailableFile(filePath, callback) {
  const backup = `${filePath}.pcvp-test-backup-${process.pid}`;
  renameSync(filePath, backup);
  try {
    callback();
  } finally {
    renameSync(backup, filePath);
  }
}

function expectIntegrationDiagnostic(code, callback) {
  callback(() => {
    const result = inspectOptionalPcvpCarrier(withCarrier(), {
      expectedSourceStages: ['CONSTRUCTABILITY_ENGINEER']
    });
    assert.equal(result.status, 'invalid');
    assert.ok(result.diagnostics.some((item) => item.code === code));
    assert.deepEqual([...new Set(result.diagnostics.map((item) => item.layer))], ['BUILDER_INTEGRATION']);
  });
}

{
  const source = sourcePackage();
  const before = structuredClone(source);
  const gate = validateCeToBuilderContractGate(source);
  const normalized = normalizeCeBuilderExecutablePackage(source);
  const projection = inspectOptionalPcvpCarrier(normalized);

  assert.equal(gate.result, 'pass');
  assert.equal(Object.hasOwn(normalized, 'continuation_assurance'), false);
  assert.equal(projection.status, 'legacy_absent');
  assert.equal(projection.compatibility_mode, 'DUAL_READ');
  assert.equal(projection.activation_effect, 'NONE');
  assert.equal(projection.emission_enabled, false);
  assert.equal(projection.runtime_authority, false);
  assert.deepEqual(source, before);
}

{
  const source = withCarrier();
  const before = structuredClone(source);
  const legacyDigest = normalizeCeBuilderExecutablePackage(sourcePackage())
    .input_authorization.package_digest.value;
  const gate = validateCeToBuilderContractGate(source);
  const sourceProjection = inspectOptionalPcvpCarrier(source, {
    expectedSourceStages: ['CONSTRUCTABILITY_ENGINEER']
  });
  const normalized = normalizeCeBuilderExecutablePackage(source);
  const projection = inspectOptionalPcvpCarrier(normalized);
  const validation = runBuilderValidator(normalized);

  assert.equal(gate.result, 'pass', JSON.stringify(gate, null, 2));
  assert.equal(sourceProjection.status, 'validated', JSON.stringify(sourceProjection.diagnostics, null, 2));
  assert.equal(projection.status, 'validated', JSON.stringify(projection.diagnostics, null, 2));
  assert.deepEqual(normalized.continuation_assurance, before.continuation_assurance);
  assert.deepEqual(source, before);
  assert.notEqual(normalized.input_authorization.package_digest.value, legacyDigest);
  assert.equal(projection.adoption_status, 'not_yet_adopted');
  assert.equal(projection.activation_effect, 'NONE');
  assert.equal(projection.emission_enabled, false);
  assert.equal(projection.runtime_authority, false);
  assert.equal(validation.status, 0, `${validation.stdout}\n${validation.stderr}`);
}

const mutations = [
  {
    code: 'BUILDER_PCVP_SCHEMA_CONST', layer: 'JSON_SCHEMA',
    mutate(value) { value.policy_version = '2.0.0'; }
  },
  {
    code: 'BUILDER_PCVP_SCHEMA_ADDITIONAL_PROPERTIES', layer: 'JSON_SCHEMA',
    mutate(value) { value.runtime_authority = true; }
  },
  {
    code: 'BUILDER_PCVP_ID_NOT_GLOBALLY_UNIQUE', layer: 'CROSS_RECORD',
    mutate(value) {
      value.authorizations[0].authorization_id = value.claims[0].claim_id;
      value.effects[0].authorization_ref = value.claims[0].claim_id;
    }
  },
  {
    code: 'BUILDER_PCVP_EFFECT_CLAIM_REF_UNRESOLVED', layer: 'CROSS_RECORD',
    mutate(value) {
      value.effects[0].depends_on_claim_ids = ['CLM-MISSING'];
      value.stage_summary.derived_from_claim_ids = [];
    }
  },
  {
    code: 'BUILDER_PCVP_EFFECT_AUTH_REF_UNRESOLVED', layer: 'CROSS_RECORD',
    mutate(value) { value.effects[0].authorization_ref = 'AUTH-MISSING'; }
  },
  {
    code: 'BUILDER_PCVP_EFFECT_AUTH_NOT_ACTIVE', layer: 'CROSS_RECORD',
    mutate(value) { value.authorizations[0].status = 'REVOKED'; }
  },
  {
    code: 'BUILDER_PCVP_EFFECT_AUTH_NOT_COVERING', layer: 'CROSS_RECORD',
    mutate(value) {
      value.authorizations[0].allowed_effect_ids = ['EFF-OTHER'];
      value.authorizations[0].allowed_effect_classes = ['REASONING_ONLY'];
    }
  },
  {
    code: 'BUILDER_PCVP_EFFECT_AUTH_SCOPE_MISMATCH', layer: 'CROSS_RECORD',
    mutate(value) { value.authorizations[0].permitted_scope = 'different scope'; }
  },
  {
    code: 'BUILDER_PCVP_SUMMARY_EFFECT_REF_UNRESOLVED', layer: 'CROSS_RECORD',
    mutate(value) { value.stage_summary.current_effect_id = 'EFF-MISSING'; }
  },
  {
    code: 'BUILDER_PCVP_SUMMARY_CLAIM_REF_UNRESOLVED', layer: 'CROSS_RECORD',
    mutate(value) { value.stage_summary.derived_from_claim_ids = ['CLM-MISSING']; }
  },
  {
    code: 'BUILDER_PCVP_SUMMARY_CLAIM_NOT_EFFECT_DEPENDENCY', layer: 'CROSS_RECORD',
    mutate(value) {
      value.claims.push({
        ...structuredClone(value.claims[0]),
        claim_id: 'CLM-CE-002',
        statement: 'A second canonical claim exists.'
      });
      value.stage_summary.derived_from_claim_ids = ['CLM-CE-002'];
    }
  },
  {
    code: 'BUILDER_PCVP_SOURCE_STAGE_MISMATCH', layer: 'BUILDER_INTEGRATION',
    mutate(value) {
      value.source_stage = 'PROJECT_GATE';
      value.authorizations[0].stage_scope.from = 'PROJECT_GATE';
    }
  },
  {
    code: 'BUILDER_PCVP_EFFECT_AUTH_STAGE_SCOPE_MISMATCH', layer: 'BUILDER_INTEGRATION',
    mutate(value) { value.authorizations[0].stage_scope.through = 'RESPONSIVE_ARCHITECT'; }
  },
  {
    code: 'BUILDER_PCVP_SAFE_DEFAULT_FORBIDDEN_EFFECT', layer: 'SEMANTIC_POLICY',
    mutate(value) {
      value.effects[0].effect_class = 'EXTERNAL_MUTATION';
      value.authorizations[0].basis = 'SAFE_REVERSIBLE_DEFAULT';
      value.authorizations[0].allowed_effect_classes = ['EXTERNAL_MUTATION'];
    }
  },
  {
    code: 'BUILDER_PCVP_CONTRADICTED_CRITICAL_EFFECT_NOT_BLOCKED', layer: 'SEMANTIC_POLICY',
    mutate(value) { value.claims[0].verification_state = 'CONTRADICTED'; }
  },
  {
    code: 'BUILDER_PCVP_GREEN_PROJECTION_INVALID', layer: 'SEMANTIC_POLICY',
    mutate(value) { value.claims[0].verification_state = 'UNVERIFIED'; }
  },
  {
    code: 'BUILDER_PCVP_YELLOW_PROJECTION_INVALID', layer: 'SEMANTIC_POLICY',
    mutate(value) {
      value.stage_summary.owner_projection = 'YELLOW';
      value.stage_summary.yellow_substate = 'OWNER_CHOICE_REQUIRED';
    }
  },
  {
    code: 'BUILDER_PCVP_RED_WITH_NON_BLOCKED_EFFECT', layer: 'SEMANTIC_POLICY',
    mutate(value) { value.stage_summary.owner_projection = 'RED'; }
  },
  {
    code: 'BUILDER_PCVP_REQUIRED_RED_PROJECTION_MISSING', layer: 'SEMANTIC_POLICY',
    mutate(value) {
      value.effects[0].continuation_state = 'BLOCKED';
      value.effects[0].authorization_ref = null;
      value.effects[0].blocker_reason = 'MATERIAL_CONTRADICTION';
      value.stage_summary.owner_projection = 'GREEN';
    }
  }
];

for (const testCase of mutations) expectInvalidLayer(testCase);

expectIntegrationDiagnostic('BUILDER_PCVP_LOCK_IDENTITY_MISMATCH', (inspect) => {
  withTemporaryFileMutation(LOCK_PATH, (bytes) => {
    const lock = JSON.parse(bytes.toString('utf8'));
    lock.policy.adoption_status = 'adopted';
    return Buffer.from(`${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  }, inspect);
});
expectIntegrationDiagnostic('BUILDER_PCVP_PROFILE_HASH_MISMATCH', (inspect) => {
  withTemporaryFileMutation(PROFILE_PATH, (bytes) => Buffer.concat([bytes, Buffer.from('\n')]), inspect);
});
expectIntegrationDiagnostic('BUILDER_PCVP_SCHEMA_HASH_MISMATCH', (inspect) => {
  withTemporaryFileMutation(SCHEMA_PATH, (bytes) => Buffer.concat([bytes, Buffer.from('\n')]), inspect);
});
expectIntegrationDiagnostic('BUILDER_PCVP_LOCK_UNAVAILABLE', (inspect) => {
  withTemporarilyUnavailableFile(LOCK_PATH, inspect);
});

{
  const schema = readJson(path.join(ROOT, 'schemas/builder-context-package.schema.json'));
  const lock = readJson(LOCK_PATH);
  const registry = readJson(path.join(ROOT, 'data/ce-builder-transformation-registry.v1.json'));

  assert.equal(schema.properties.continuation_assurance.type, 'object');
  assert.equal(schema.required.includes('continuation_assurance'), false);
  assert.equal(lock.policy.adoption_status, 'not_yet_adopted');
  assert.equal(lock.policy.activation, 'NONE');
  assert.equal(
    registry.mappings.filter((item) => item.id === 'CE_PKG_PCVP_CARRIER_COPY').length,
    1
  );
}

console.log(JSON.stringify({
  result: 'PASS',
  legacy_absence_cases: 1,
  valid_carrier_cases: 1,
  invalid_carrier_cases: mutations.length,
  integration_identity_mutations: 4,
  validation_phase_order: [
    'BUILDER_INTEGRATION_PRECONDITIONS',
    'JSON_SCHEMA',
    'CROSS_RECORD',
    'BUILDER_INTEGRATION',
    'SEMANTIC_POLICY'
  ],
  adapter_copy: 'LOSSLESS',
  adoption_status: 'not_yet_adopted',
  activation_effect: 'NONE',
  producer_emission: false
}, null, 2));
