import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LOCK_PATH = 'contracts/pcvp/pcvp-v1.lock.json';
const PROFILE_PATH = 'contracts/pcvp/builder.profile.yaml';
const VENDORED_ROOT = 'contracts/pcvp/vendor/decision-kernel/v1.0.0';
const CANONICAL_REPOSITORY = 'rezahh107/EV4-Decision-Kernel';
const CANONICAL_COMMIT = '069a50fa243b01fa578a7c1bcb8864d9e796d34b';
const ARCHITECTURE_LOCK_ID = 'EV4-PCVP-ROLL-LOCK-20260727-R1';
const POLICY_ID = 'EV4-PCVP';
const POLICY_VERSION = '1.0.0';
const BUILDER_STAGE = 'BUILDER_ASSISTANT';
const PROFILE_SHA256 = '366a8362fc2eb429ad1498152f40ee57a7af677f62536340f7fd1ee2d1fb5b9b';
const SCHEMA_HASHES = Object.freeze({
  'authorization.schema.json': '8eba853834bc3881ae836857a5bef3d8cc8e7c9edecd535ba22fb58a26fa5ff9',
  'claim.schema.json': '7d4c686b983330c454d76ebc34ef97ca4c595dd77b221de194e6a75e41859a72',
  'effect.schema.json': '59c201b7277f3bf3488eb43afbd04f686efae25b9a143c73f97aca5f65a1bbeb',
  'handoff.schema.json': 'dcc3189ef4662b27e440aee3d3c698d503e265f81fb71d5d1904972cfe8728da'
});
const DEFAULT_SOURCE_STAGES = Object.freeze([
  'ARCHITECT',
  'CONSTRUCTABILITY_ENGINEER'
]);

function diagnostic(code, message, pathNow = '$', layer = 'PCVP_BOUNDARY') {
  return { code, message, path: pathNow, layer };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function deepEqual(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function typeMatches(value, expected) {
  if (expected === 'null') return value === null;
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  if (expected === 'integer') return Number.isInteger(value);
  return typeof value === expected;
}

function schemaPath(base, key) {
  return base === '$' ? `$.${key}` : `${base}.${key}`;
}

function validateSchema(value, schema, schemas, pathNow = '$') {
  if (!schema || typeof schema !== 'object') return [];
  if (schema.$ref) {
    const reference = String(schema.$ref).split('#')[0];
    const resolved = schemas[reference];
    return resolved
      ? validateSchema(value, resolved, schemas, pathNow)
      : [diagnostic('BUILDER_PCVP_SCHEMA_REF_UNRESOLVED', `Schema reference is not pinned: ${schema.$ref}`, pathNow, 'JSON_SCHEMA')];
  }

  const errors = [];
  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    errors.push(diagnostic('BUILDER_PCVP_SCHEMA_CONST', `Value must equal ${JSON.stringify(schema.const)}.`, pathNow, 'JSON_SCHEMA'));
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => deepEqual(value, candidate))) {
    errors.push(diagnostic('BUILDER_PCVP_SCHEMA_ENUM', 'Value is outside the canonical enum.', pathNow, 'JSON_SCHEMA'));
  }

  if (schema.type !== undefined) {
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expectedTypes.some((expected) => typeMatches(value, expected))) {
      errors.push(diagnostic('BUILDER_PCVP_SCHEMA_TYPE', `Value must have type ${expectedTypes.join(' or ')}.`, pathNow, 'JSON_SCHEMA'));
      return errors;
    }
  }

  if (typeof value === 'string') {
    if (Number.isInteger(schema.minLength) && value.length < schema.minLength) {
      errors.push(diagnostic('BUILDER_PCVP_SCHEMA_MIN_LENGTH', `String length must be at least ${schema.minLength}.`, pathNow, 'JSON_SCHEMA'));
    }
    if (typeof schema.pattern === 'string' && !(new RegExp(schema.pattern, 'u')).test(value)) {
      errors.push(diagnostic('BUILDER_PCVP_SCHEMA_PATTERN', `String does not match ${schema.pattern}.`, pathNow, 'JSON_SCHEMA'));
    }
  }

  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
      errors.push(diagnostic('BUILDER_PCVP_SCHEMA_MIN_ITEMS', `Array must contain at least ${schema.minItems} item(s).`, pathNow, 'JSON_SCHEMA'));
    }
    if (schema.uniqueItems === true) {
      const serialized = value.map(canonicalJson);
      if (new Set(serialized).size !== serialized.length) {
        errors.push(diagnostic('BUILDER_PCVP_SCHEMA_UNIQUE_ITEMS', 'Array items must be unique.', pathNow, 'JSON_SCHEMA'));
      }
    }
    if (schema.items) {
      value.forEach((item, index) => {
        errors.push(...validateSchema(item, schema.items, schemas, `${pathNow}[${index}]`));
      });
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) {
        errors.push(diagnostic('BUILDER_PCVP_SCHEMA_REQUIRED', `Required property is missing: ${key}.`, schemaPath(pathNow, key), 'JSON_SCHEMA'));
      }
    }
    for (const [key, nested] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) {
        errors.push(...validateSchema(value[key], nested, schemas, schemaPath(pathNow, key)));
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
          errors.push(diagnostic('BUILDER_PCVP_SCHEMA_ADDITIONAL_PROPERTIES', `Additional property is forbidden: ${key}.`, schemaPath(pathNow, key), 'JSON_SCHEMA'));
        }
      }
    }
  }

  for (const nested of schema.allOf ?? []) {
    errors.push(...validateSchema(value, nested, schemas, pathNow));
  }
  if (Array.isArray(schema.anyOf)) {
    const accepted = schema.anyOf.some((nested) => validateSchema(value, nested, schemas, pathNow).length === 0);
    if (!accepted) {
      errors.push(diagnostic('BUILDER_PCVP_SCHEMA_ANY_OF', 'Value does not satisfy any canonical alternative.', pathNow, 'JSON_SCHEMA'));
    }
  }
  if (schema.if && validateSchema(value, schema.if, schemas, pathNow).length === 0 && schema.then) {
    errors.push(...validateSchema(value, schema.then, schemas, pathNow));
  }
  return errors;
}

function loadPinnedContract() {
  const diagnostics = [];
  let lock;
  try {
    lock = readJson(LOCK_PATH);
  } catch (error) {
    return {
      schemas: null,
      diagnostics: [diagnostic('BUILDER_PCVP_LOCK_UNAVAILABLE', `Pinned contract lock could not be loaded (${error.name}).`)]
    };
  }

  const expectedLock = {
    schema_version: 'ev4-pcvp-contract-lock.v1',
    architecture_lock_id: ARCHITECTURE_LOCK_ID
  };
  for (const [key, expected] of Object.entries(expectedLock)) {
    if (lock[key] !== expected) {
      diagnostics.push(diagnostic('BUILDER_PCVP_LOCK_IDENTITY_MISMATCH', `${key} must remain ${expected}.`, `$.${key}`));
    }
  }

  const expectedPolicy = {
    id: POLICY_ID,
    version: POLICY_VERSION,
    adoption_status: 'not_yet_adopted',
    activation: 'NONE'
  };
  if (!deepEqual(lock.policy, expectedPolicy)) {
    diagnostics.push(diagnostic('BUILDER_PCVP_LOCK_IDENTITY_MISMATCH', 'Policy identity or dormant state drifted.', '$.policy'));
  }
  if (
    lock.canonical?.repository !== CANONICAL_REPOSITORY
    || lock.canonical?.commit_sha !== CANONICAL_COMMIT
  ) {
    diagnostics.push(diagnostic('BUILDER_PCVP_LOCK_IDENTITY_MISMATCH', 'Canonical owner or immutable commit drifted.', '$.canonical'));
  }

  const expectedProfile = {
    profile_id: 'EV4-PCVP-PROFILE-BUILDER',
    profile_version: '1.0.0',
    repository: 'rezahh107/EV4-Builder-Assistant-Repo',
    stage_id: BUILDER_STAGE,
    consumes_from: [...DEFAULT_SOURCE_STAGES],
    path: PROFILE_PATH,
    sha256: PROFILE_SHA256,
    local_copy_authoritative: false
  };
  if (!deepEqual(lock.profile, expectedProfile)) {
    diagnostics.push(diagnostic('BUILDER_PCVP_PROFILE_IDENTITY_MISMATCH', 'Builder profile identity drifted.', '$.profile'));
  }

  try {
    const observedProfile = sha256(readFileSync(path.join(ROOT, PROFILE_PATH)));
    if (observedProfile !== PROFILE_SHA256) {
      diagnostics.push(diagnostic('BUILDER_PCVP_PROFILE_HASH_MISMATCH', 'Builder profile bytes do not match the immutable lock.', '$.profile.sha256'));
    }
  } catch (error) {
    diagnostics.push(diagnostic('BUILDER_PCVP_PROFILE_UNAVAILABLE', `Builder profile could not be loaded (${error.name}).`, '$.profile.path'));
  }

  if (
    lock.vendored?.root !== VENDORED_ROOT
    || lock.vendored?.local_copy_authoritative !== false
  ) {
    diagnostics.push(diagnostic('BUILDER_PCVP_LOCK_IDENTITY_MISMATCH', 'Vendored schemas must remain non-authoritative at the locked path.', '$.vendored'));
  }
  if (
    lock.verification?.byte_equality_required !== true
    || lock.verification?.compare_against_moving_default_branch !== false
  ) {
    diagnostics.push(diagnostic('BUILDER_PCVP_LOCK_IDENTITY_MISMATCH', 'Verification must remain bound to immutable bytes.', '$.verification'));
  }

  const lockedFiles = new Map(
    (Array.isArray(lock.files) ? lock.files : []).map((entry) => [entry?.name, entry?.sha256])
  );
  if (
    lockedFiles.size !== Object.keys(SCHEMA_HASHES).length
    || Object.entries(SCHEMA_HASHES).some(([name, hash]) => lockedFiles.get(name) !== hash)
  ) {
    diagnostics.push(diagnostic('BUILDER_PCVP_LOCK_FILE_SET_INVALID', 'Lock must cover exactly the four canonical schemas.', '$.files'));
  }

  const schemas = {};
  for (const [name, expectedHash] of Object.entries(SCHEMA_HASHES)) {
    const relativePath = `${VENDORED_ROOT}/${name}`;
    try {
      const bytes = readFileSync(path.join(ROOT, relativePath));
      const observedHash = sha256(bytes);
      if (observedHash !== expectedHash) {
        diagnostics.push(diagnostic('BUILDER_PCVP_SCHEMA_HASH_MISMATCH', `Vendored ${name} bytes do not match the immutable source.`, `$.files.${name}`));
      } else {
        schemas[name] = JSON.parse(bytes.toString('utf8'));
      }
    } catch (error) {
      diagnostics.push(diagnostic('BUILDER_PCVP_SCHEMA_UNAVAILABLE', `Vendored ${name} could not be loaded (${error.name}).`, `$.files.${name}`));
    }
  }
  return { schemas: Object.keys(schemas).length === 4 ? schemas : null, diagnostics };
}

function crossRecordDiagnostics(document, expectedSourceStages) {
  const carrier = document.continuation_assurance;
  const claims = carrier.claims;
  const effects = carrier.effects;
  const authorizations = carrier.authorizations;
  const summary = carrier.stage_summary;
  const diagnostics = [];
  const claimsById = new Map(claims.map((item) => [item.claim_id, item]));
  const effectsById = new Map(effects.map((item) => [item.effect_id, item]));
  const authorizationsById = new Map(authorizations.map((item) => [item.authorization_id, item]));
  const allIds = [
    ...claims.map((item) => item.claim_id),
    ...effects.map((item) => item.effect_id),
    ...authorizations.map((item) => item.authorization_id)
  ];

  if (new Set(allIds).size !== allIds.length) {
    diagnostics.push(diagnostic('BUILDER_PCVP_ID_NOT_GLOBALLY_UNIQUE', 'Claim, Effect and Authorization IDs must be globally unique.', '$.continuation_assurance'));
  }
  if (!expectedSourceStages.includes(carrier.source_stage)) {
    diagnostics.push(diagnostic('BUILDER_PCVP_SOURCE_STAGE_MISMATCH', `source_stage must be one of ${expectedSourceStages.join(', ')}.`, '$.continuation_assurance.source_stage'));
  }

  for (const effect of effects) {
    for (const claimId of effect.depends_on_claim_ids) {
      if (!claimsById.has(claimId)) {
        diagnostics.push(diagnostic('BUILDER_PCVP_EFFECT_CLAIM_REF_UNRESOLVED', `Effect dependency is unresolved: ${claimId}.`, `$.continuation_assurance.effects.${effect.effect_id}`));
      }
    }
    const authorization = effect.authorization_ref === null
      ? null
      : authorizationsById.get(effect.authorization_ref);
    if (effect.authorization_ref !== null && !authorization) {
      diagnostics.push(diagnostic('BUILDER_PCVP_EFFECT_AUTH_REF_UNRESOLVED', `Authorization reference is unresolved: ${effect.authorization_ref}.`, `$.continuation_assurance.effects.${effect.effect_id}`));
    }
    if (authorization) {
      if (authorization.status !== 'ACTIVE') {
        diagnostics.push(diagnostic('BUILDER_PCVP_EFFECT_AUTH_NOT_ACTIVE', `Authorization ${authorization.authorization_id} is not ACTIVE.`, `$.continuation_assurance.effects.${effect.effect_id}`));
      }
      const covered = authorization.allowed_effect_ids.includes(effect.effect_id)
        || authorization.allowed_effect_classes.includes(effect.effect_class);
      if (!covered) {
        diagnostics.push(diagnostic('BUILDER_PCVP_EFFECT_AUTH_NOT_COVERING', `Authorization ${authorization.authorization_id} does not cover the effect.`, `$.continuation_assurance.effects.${effect.effect_id}`));
      }
      if (authorization.permitted_scope !== effect.permitted_scope) {
        diagnostics.push(diagnostic('BUILDER_PCVP_EFFECT_AUTH_SCOPE_MISMATCH', `Authorization ${authorization.authorization_id} scope differs from the effect scope.`, `$.continuation_assurance.effects.${effect.effect_id}`));
      }
      if (
        authorization.stage_scope.from !== carrier.source_stage
        || authorization.stage_scope.through !== BUILDER_STAGE
      ) {
        diagnostics.push(diagnostic('BUILDER_PCVP_EFFECT_AUTH_STAGE_SCOPE_MISMATCH', `Authorization ${authorization.authorization_id} must bind ${carrier.source_stage} through ${BUILDER_STAGE}.`, `$.continuation_assurance.authorizations.${authorization.authorization_id}.stage_scope`));
      }
      if (
        authorization.basis === 'SAFE_REVERSIBLE_DEFAULT'
        && ['EXTERNAL_MUTATION', 'IRREVERSIBLE_OR_AUTHORITY_BEARING'].includes(effect.effect_class)
      ) {
        diagnostics.push(diagnostic('BUILDER_PCVP_SAFE_DEFAULT_FORBIDDEN_EFFECT', 'SAFE_REVERSIBLE_DEFAULT cannot cover external or irreversible effects.', `$.continuation_assurance.effects.${effect.effect_id}`));
      }
    }

    const dependentClaims = effect.depends_on_claim_ids
      .map((claimId) => claimsById.get(claimId))
      .filter(Boolean);
    const contradictedCritical = dependentClaims.some((claim) => (
      claim.criticality === 'CRITICAL'
      && claim.applicability_state === 'APPLICABLE'
      && claim.verification_state === 'CONTRADICTED'
    ));
    if (contradictedCritical && effect.continuation_state !== 'BLOCKED') {
      diagnostics.push(diagnostic('BUILDER_PCVP_CONTRADICTED_CRITICAL_EFFECT_NOT_BLOCKED', 'A contradicted critical dependency must block the effect.', `$.continuation_assurance.effects.${effect.effect_id}`));
    }
  }

  const currentEffect = effectsById.get(summary.current_effect_id);
  if (!currentEffect) {
    diagnostics.push(diagnostic('BUILDER_PCVP_SUMMARY_EFFECT_REF_UNRESOLVED', 'stage_summary.current_effect_id is unresolved.', '$.continuation_assurance.stage_summary.current_effect_id'));
    return diagnostics;
  }
  const currentDependencies = new Set(currentEffect.depends_on_claim_ids);
  for (const claimId of summary.derived_from_claim_ids) {
    if (!claimsById.has(claimId)) {
      diagnostics.push(diagnostic('BUILDER_PCVP_SUMMARY_CLAIM_REF_UNRESOLVED', `Summary claim reference is unresolved: ${claimId}.`, '$.continuation_assurance.stage_summary.derived_from_claim_ids'));
    } else if (!currentDependencies.has(claimId)) {
      diagnostics.push(diagnostic('BUILDER_PCVP_SUMMARY_CLAIM_NOT_EFFECT_DEPENDENCY', `Summary claim is not a current-effect dependency: ${claimId}.`, '$.continuation_assurance.stage_summary.derived_from_claim_ids'));
    }
  }

  const dependentClaims = currentEffect.depends_on_claim_ids
    .map((claimId) => claimsById.get(claimId))
    .filter(Boolean);
  const criticalContradicted = dependentClaims.some((claim) => (
    claim.criticality === 'CRITICAL'
    && claim.applicability_state === 'APPLICABLE'
    && claim.verification_state === 'CONTRADICTED'
  ));
  const anyContradicted = dependentClaims.some((claim) => claim.verification_state === 'CONTRADICTED');
  const criticalApplicableNotVerified = dependentClaims.some((claim) => (
    claim.criticality === 'CRITICAL'
    && claim.applicability_state === 'APPLICABLE'
    && claim.verification_state !== 'VERIFIED'
  ));
  const materialApplicabilityUndetermined = dependentClaims.some((claim) => (
    ['CRITICAL', 'MATERIAL'].includes(claim.criticality)
    && claim.applicability_state === 'UNDETERMINED'
  ));
  const applicableUnverified = dependentClaims.some((claim) => (
    claim.applicability_state === 'APPLICABLE'
    && claim.verification_state === 'UNVERIFIED'
  ));

  if (
    summary.owner_projection === 'GREEN'
    && (
      currentEffect.continuation_state !== 'CONTINUE'
      || criticalApplicableNotVerified
      || anyContradicted
      || materialApplicabilityUndetermined
    )
  ) {
    diagnostics.push(diagnostic('BUILDER_PCVP_GREEN_PROJECTION_INVALID', 'GREEN is inconsistent with the current effect or its dependent claims.', '$.continuation_assurance.stage_summary'));
  }
  if (summary.owner_projection === 'YELLOW') {
    const expectedSubstate = currentEffect.continuation_state === 'CONTINUE'
      ? 'CONTINUATION_AVAILABLE'
      : currentEffect.continuation_state === 'AUTHORIZATION_REQUIRED'
        ? 'OWNER_CHOICE_REQUIRED'
        : null;
    if (
      expectedSubstate === null
      || summary.yellow_substate !== expectedSubstate
      || (!applicableUnverified && currentEffect.continuation_state !== 'AUTHORIZATION_REQUIRED')
      || criticalContradicted
    ) {
      diagnostics.push(diagnostic('BUILDER_PCVP_YELLOW_PROJECTION_INVALID', 'YELLOW is inconsistent with the current effect or its dependent claims.', '$.continuation_assurance.stage_summary'));
    }
  }
  if (summary.owner_projection === 'RED' && currentEffect.continuation_state !== 'BLOCKED') {
    diagnostics.push(diagnostic('BUILDER_PCVP_RED_WITH_NON_BLOCKED_EFFECT', 'RED requires the current effect to be BLOCKED.', '$.continuation_assurance.stage_summary'));
  }
  if (
    (currentEffect.continuation_state === 'BLOCKED' || criticalContradicted)
    && summary.owner_projection !== 'RED'
  ) {
    diagnostics.push(diagnostic('BUILDER_PCVP_REQUIRED_RED_PROJECTION_MISSING', 'A blocked or contradicted critical current effect requires RED.', '$.continuation_assurance.stage_summary'));
  }
  return diagnostics;
}

export function inspectOptionalPcvpCarrier(
  document,
  { expectedSourceStages = DEFAULT_SOURCE_STAGES } = {}
) {
  if (
    document === null
    || typeof document !== 'object'
    || Array.isArray(document)
    || !Object.hasOwn(document, 'continuation_assurance')
  ) {
    return {
      status: 'legacy_absent',
      diagnostics: [],
      compatibility_mode: 'DUAL_READ',
      adoption_status: 'not_yet_adopted',
      activation_effect: 'NONE',
      emission_enabled: false,
      runtime_authority: false
    };
  }

  const carrierDocument = {
    continuation_assurance: structuredClone(document.continuation_assurance)
  };
  const pinned = loadPinnedContract();
  const diagnostics = [...pinned.diagnostics];
  if (pinned.schemas) {
    diagnostics.push(...validateSchema(
      carrierDocument,
      pinned.schemas['handoff.schema.json'],
      pinned.schemas
    ));
  }
  if (diagnostics.length === 0) {
    diagnostics.push(...crossRecordDiagnostics(carrierDocument, expectedSourceStages));
  }
  diagnostics.sort((left, right) => (
    left.path.localeCompare(right.path)
    || left.code.localeCompare(right.code)
    || left.message.localeCompare(right.message)
  ));

  if (diagnostics.length > 0) {
    return {
      status: 'invalid',
      diagnostics,
      compatibility_mode: 'DUAL_READ',
      adoption_status: 'not_yet_adopted',
      activation_effect: 'NONE',
      emission_enabled: false,
      runtime_authority: false
    };
  }
  return {
    status: 'validated',
    diagnostics: [],
    carrier: carrierDocument,
    canonical_sha256: sha256(Buffer.from(canonicalJson(carrierDocument), 'utf8')),
    policy_id: carrierDocument.continuation_assurance.policy_id,
    policy_version: carrierDocument.continuation_assurance.policy_version,
    source_stage: carrierDocument.continuation_assurance.source_stage,
    compatibility_mode: 'DUAL_READ',
    adoption_status: 'not_yet_adopted',
    activation_effect: 'NONE',
    emission_enabled: false,
    runtime_authority: false
  };
}

export class PcvpCarrierValidationError extends Error {
  constructor(result) {
    const summary = result.diagnostics
      .slice(0, 8)
      .map((item) => `${item.code}@${item.path}`)
      .join('; ');
    super(`PCVP carrier validation failed. Builder execution must not start. ${summary}`);
    this.name = 'PcvpCarrierValidationError';
    this.result = result;
  }
}

export function assertOptionalPcvpCarrier(document, options) {
  const result = inspectOptionalPcvpCarrier(document, options);
  if (result.status === 'invalid') throw new PcvpCarrierValidationError(result);
  return result;
}

export function clonePcvpCarrier(result) {
  if (result?.status !== 'validated') {
    throw new TypeError('clonePcvpCarrier requires a validated PCVP projection.');
  }
  return structuredClone(result.carrier.continuation_assurance);
}

