import fs from 'node:fs';
import path from 'node:path';
import { computeCanonicalDigest } from '../canonical-builder-package.mjs';
import { readJson, resolveRoot } from './run-primitives.mjs';

export const CONTRACT = JSON.parse(fs.readFileSync(new URL('../../../data/comparative-admission-contract.v1.json', import.meta.url), 'utf8'));
export const COMPARATIVE_ADMISSION_VALIDATOR_ID = CONTRACT.validator_identity;
export const COMPARATIVE_ADMISSION_VALIDATOR_VERSION = CONTRACT.validator_version;

const uniq = (values) => [...new Set(values)];
export const sorted = (values) => uniq(values || []).sort();
const safeStem = (actionId) => computeCanonicalDigest({ action_id: actionId }).slice(0, 32);
const root = (runDirectory) => path.join(resolveRoot(runDirectory), 'comparative');
export const requirementPath = (runDirectory, actionId) => path.join(root(runDirectory), 'requirements', `${safeStem(actionId)}.json`);
export const resolutionPath = (runDirectory, actionId) => path.join(root(runDirectory), 'resolutions', `${safeStem(actionId)}.json`);
export const receiptPath = (runDirectory, actionId) => path.join(root(runDirectory), 'receipts', `${safeStem(actionId)}.json`);

function addMappedDomains(target, value, mapping) {
  const values = Array.isArray(value) ? value : [value];
  for (const item of values) for (const domain of mapping[item] || []) target.add(domain);
}

export function deriveRequiredDomains(requirement) {
  const required = new Set(CONTRACT.always_required_domains || []);
  addMappedDomains(required, requirement.implementation_surface_type, CONTRACT.surface_domains || {});
  addMappedDomains(required, requirement.material_behavior_dimensions || [], CONTRACT.behavior_dimension_domains || {});
  addMappedDomains(required, requirement.content_variability, CONTRACT.content_variability_domains || {});
  addMappedDomains(required, requirement.reference_frame, CONTRACT.reference_frame_domains || {});
  addMappedDomains(required, requirement.reuse_scope, CONTRACT.reuse_scope_domains || {});
  for (const [field, domains] of Object.entries(CONTRACT.relevance_field_domains || {})) {
    if (requirement[field] === true) for (const domain of domains) required.add(domain);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const domain of [...required]) {
      for (const dependency of CONTRACT.cross_domain_dependencies?.[domain] || []) {
        if (!required.has(dependency)) { required.add(dependency); changed = true; }
      }
    }
  }
  return [...required].sort();
}

function validBinding(value) {
  return value && typeof value === 'object'
    && typeof value.source_ref === 'string' && value.source_ref.trim().length > 0
    && typeof value.evidence === 'string' && value.evidence.trim().length > 0;
}

export function deriveRequirementClassification(requirement) {
  const errors = [];
  if (requirement.allowed_authority_boundary !== CONTRACT.allowed_authority_boundary || requirement.authority_uncertain === true || requirement.requires_upstream_decision === true) {
    return { classification: 'UPSTREAM_DECISION_REQUIRED', errors: [] };
  }
  const required = Array.isArray(requirement.required_material_parameters) ? requirement.required_material_parameters : [];
  const fully = Array.isArray(requirement.fully_specified_upstream_parameters) ? requirement.fully_specified_upstream_parameters : [];
  const unresolved = Array.isArray(requirement.unresolved_material_parameters) ? requirement.unresolved_material_parameters : [];
  const requiredSet = new Set(required), fullySet = new Set(fully), unresolvedSet = new Set(unresolved);
  if (required.length === 0) errors.push('REQUIRED_MATERIAL_PARAMETERS_EMPTY');
  if (requiredSet.size !== required.length) errors.push('REQUIRED_MATERIAL_PARAMETERS_DUPLICATE');
  for (const value of fullySet) if (!requiredSet.has(value)) errors.push(`FULLY_SPECIFIED_PARAMETER_NOT_REQUIRED:${value}`);
  for (const value of unresolvedSet) if (!requiredSet.has(value)) errors.push(`UNRESOLVED_PARAMETER_NOT_REQUIRED:${value}`);
  for (const value of fullySet) if (unresolvedSet.has(value)) errors.push(`PARAMETER_BOTH_FULLY_SPECIFIED_AND_UNRESOLVED:${value}`);
  const bindings = requirement.upstream_parameter_bindings && typeof requirement.upstream_parameter_bindings === 'object' ? requirement.upstream_parameter_bindings : {};
  for (const value of fullySet) if (!validBinding(bindings[value])) errors.push(`UPSTREAM_PARAMETER_BINDING_MISSING:${value}`);
  if (errors.length) return { classification: 'INVALID', errors };
  if (unresolvedSet.size > 0) return { classification: 'BOUNDED_MICRO_RESOLUTION', errors: [] };
  if (fullySet.size === requiredSet.size && [...requiredSet].every((value) => fullySet.has(value))) return { classification: 'DIRECT_EXECUTION', errors: [] };
  return { classification: 'INVALID', errors: ['MATERIAL_PARAMETER_CLASSIFICATION_INCOMPLETE'] };
}

export function normalizeRequirement(source, loaded) {
  const errors = [];
  for (const field of CONTRACT.requirement_required_fields || []) if (!(field in source)) errors.push(`MISSING_FIELD:${field}`);
  if (source.schema !== CONTRACT.requirement_schema) errors.push('SCHEMA_MISMATCH');
  const actionId = source.action_id;
  const actionIds = loaded.context?.action_batch?.action_ids || [];
  if (!actionIds.includes(actionId)) errors.push('ACTION_ID_NOT_IN_ACTIVE_BATCH');
  const actionDigest = loaded.context?.action_batch?.action_digests?.[actionId];
  if (typeof actionDigest !== 'string') errors.push('ACTION_DIGEST_MISSING');
  const derived = deriveRequirementClassification(source); errors.push(...derived.errors);
  const normalized = {
    ...source,
    action_digest: actionDigest || null,
    derived_authority_classification: derived.classification,
    required_domain_ids: deriveRequiredDomains(source),
    validator_identity: CONTRACT.validator_identity,
    validator_version: CONTRACT.validator_version,
    decision_requirement_digest: null
  };
  normalized.decision_requirement_digest = computeCanonicalDigest(Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== 'decision_requirement_digest')));
  if (source.decision_requirement_digest && source.decision_requirement_digest !== normalized.decision_requirement_digest) errors.push('DECISION_REQUIREMENT_DIGEST_MISMATCH');
  return { passed: errors.length === 0, errors: sorted(errors), requirement: normalized };
}

export function normalizeResolution(source, requirement) {
  const errors = [];
  for (const field of CONTRACT.resolution_required_fields || []) if (!(field in source)) errors.push(`MISSING_FIELD:${field}`);
  if (source.schema !== CONTRACT.resolution_schema) errors.push('SCHEMA_MISMATCH');
  if (source.action_id !== requirement.action_id) errors.push('ACTION_ID_MISMATCH');
  if (source.decision_requirement_id !== requirement.decision_requirement_id) errors.push('DECISION_REQUIREMENT_ID_MISMATCH');
  if (source.decision_requirement_digest !== requirement.decision_requirement_digest) errors.push('DECISION_REQUIREMENT_DIGEST_MISMATCH');
  const requiredDomains = new Set(requirement.required_domain_ids || []);
  const evaluatedDomains = new Set(Array.isArray(source.evaluated_domain_ids) ? source.evaluated_domain_ids : []);
  for (const domain of requiredDomains) if (!evaluatedDomains.has(domain)) errors.push(`REQUIRED_DOMAIN_NOT_EVALUATED:${domain}`);
  if (requirement.derived_authority_classification !== 'BOUNDED_MICRO_RESOLUTION') errors.push(`REQUIREMENT_CLASSIFICATION_NOT_BOUNDED_MICRO:${requirement.derived_authority_classification}`);
  if (source.coverage_status !== 'COMPLETE') errors.push('COMPARATIVE_COVERAGE_INCOMPLETE');
  if (source.authority_result !== 'PASS') errors.push('AUTHORITY_RESULT_NOT_PASS');
  if (source.comparison_completed_before_selection !== true) errors.push('COMPARISON_ORDER_NOT_PROVEN');
  if (source.comparative_source_sha256 !== CONTRACT.comparative_source_sha256) errors.push('COMPARATIVE_SOURCE_IDENTITY_MISMATCH');
  const validatedRuleIds = Array.isArray(source.validated_rule_ids) ? source.validated_rule_ids : [];
  if (validatedRuleIds.length === 0) errors.push('VALIDATED_RULE_IDS_EMPTY');
  const coveredRuleDomains = new Set();
  for (const ruleId of validatedRuleIds) {
    const domain = CONTRACT.rule_domain_index?.[ruleId];
    if (!domain) errors.push(`UNKNOWN_VALIDATED_RULE:${ruleId}`); else coveredRuleDomains.add(domain);
  }
  for (const domain of requiredDomains) if (!coveredRuleDomains.has(domain)) errors.push(`REQUIRED_DOMAIN_WITHOUT_VALIDATED_RULE:${domain}`);
  if (!Array.isArray(source.verification_obligations) || source.verification_obligations.length === 0) errors.push('VERIFICATION_OBLIGATIONS_EMPTY');
  const candidates = Array.isArray(source.candidate_options) ? source.candidate_options : [];
  const candidateIds = candidates.map((item) => item && typeof item === 'object' ? item.option_id : item);
  if (!candidateIds.includes(source.selected_option)) errors.push('SELECTED_OPTION_NOT_IN_CANDIDATES');
  const selectedParameters = source.selected_parameters && typeof source.selected_parameters === 'object' ? source.selected_parameters : {};
  const parameterBasis = source.parameter_basis && typeof source.parameter_basis === 'object' ? source.parameter_basis : {};
  for (const key of Object.keys(selectedParameters)) if (!parameterBasis[key]) errors.push(`PARAMETER_BASIS_MISSING:${key}`);
  const normalized = { ...source, required_domain_ids: sorted(requirement.required_domain_ids), resolution_digest: null };
  normalized.resolution_digest = computeCanonicalDigest(Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== 'resolution_digest')));
  if (source.resolution_digest && source.resolution_digest !== normalized.resolution_digest) errors.push('RESOLUTION_DIGEST_MISMATCH');
  return { passed: errors.length === 0, errors: sorted(errors), resolution: normalized };
}

export function buildReceipt(requirement, resolution) {
  const receipt = {
    schema: CONTRACT.receipt_schema,
    action_id: requirement.action_id,
    action_digest: requirement.action_digest,
    decision_requirement_id: requirement.decision_requirement_id,
    decision_requirement_digest: requirement.decision_requirement_digest,
    resolution_id: resolution.resolution_id,
    resolution_digest: resolution.resolution_digest,
    required_domain_ids: sorted(requirement.required_domain_ids),
    evaluated_domain_ids: sorted(resolution.evaluated_domain_ids),
    validated_rule_ids: sorted(resolution.validated_rule_ids),
    coverage_status: resolution.coverage_status,
    authority_result: resolution.authority_result,
    verification_obligations_digest: computeCanonicalDigest(resolution.verification_obligations),
    validator_identity: CONTRACT.validator_identity,
    validator_version: CONTRACT.validator_version,
    admitted: true,
    receipt_digest: null
  };
  receipt.receipt_digest = computeCanonicalDigest(Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'receipt_digest')));
  return receipt;
}

function readCarrier(file, label) {
  try { return { value: readJson(file), error: null }; }
  catch (error) { return { value: null, error: `${label} malformed: ${error.message}` }; }
}

export function verifyRequirementCarrier(loaded, actionId) {
  const file = requirementPath(loaded.runDirectory, actionId);
  if (!fs.existsSync(file)) return { passed: false, errors: ['REQUIREMENT_MISSING'], requirement: null, file };
  const read = readCarrier(file, 'Requirement');
  if (read.error) return { passed: false, errors: [read.error], requirement: null, file };
  const normalized = normalizeRequirement(read.value, loaded);
  if (!normalized.passed) return { passed: false, errors: normalized.errors, requirement: null, file };
  if (JSON.stringify(read.value) !== JSON.stringify(normalized.requirement)) return { passed: false, errors: ['REQUIREMENT_CANONICAL_MISMATCH'], requirement: normalized.requirement, file };
  return { passed: true, errors: [], requirement: normalized.requirement, file };
}

export function verifyResolutionAndReceipt(loaded, requirement) {
  const rFile = resolutionPath(loaded.runDirectory, requirement.action_id);
  const aFile = receiptPath(loaded.runDirectory, requirement.action_id);
  const errors = [];
  if (!fs.existsSync(rFile)) errors.push('RESOLUTION_MISSING');
  if (!fs.existsSync(aFile)) errors.push('ADMISSION_RECEIPT_MISSING');
  if (errors.length) return { passed: false, errors };
  const rr = readCarrier(rFile, 'Resolution'), ar = readCarrier(aFile, 'Admission Receipt');
  if (rr.error) errors.push(rr.error); if (ar.error) errors.push(ar.error);
  if (errors.length) return { passed: false, errors };
  const normalized = normalizeResolution(rr.value, requirement);
  errors.push(...normalized.errors);
  if (normalized.passed && JSON.stringify(rr.value) !== JSON.stringify(normalized.resolution)) errors.push('RESOLUTION_CANONICAL_MISMATCH');
  const expected = normalized.passed ? buildReceipt(requirement, normalized.resolution) : null;
  if (expected) {
    if (ar.value.validator_identity !== CONTRACT.validator_identity) errors.push('UNSUPPORTED_VALIDATOR_IDENTITY');
    if (ar.value.validator_version !== CONTRACT.validator_version) errors.push('UNSUPPORTED_VALIDATOR_VERSION');
    if (ar.value.admitted !== true) errors.push('RECEIPT_NOT_ADMITTED');
    if (JSON.stringify(ar.value) !== JSON.stringify(expected)) errors.push('ADMISSION_RECEIPT_CANONICAL_MISMATCH');
  }
  return { passed: errors.length === 0, errors: sorted(errors), resolution: normalized.resolution, receipt: expected };
}
