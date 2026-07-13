#!/usr/bin/env node
import fs from 'node:fs';
import {
  findForbiddenKeys,
  printFailure,
  readJson,
  readYaml,
  setEquals,
  unique,
  validateSchema
} from './governance-lib.mjs';

const authorities = [
  {
    name: 'AI authority policy',
    statePath: 'governance/AI_AUTHORITY_POLICY.yml',
    schemaPath: 'governance/schemas/ai-authority-policy.schema.json'
  },
  {
    name: 'Capability memory',
    statePath: 'planning/CAPABILITY_MEMORY.yml',
    schemaPath: 'governance/schemas/capability-memory.schema.json'
  },
  {
    name: 'Governance adoption plan',
    statePath: 'planning/GOVERNANCE_ADOPTION_PLAN.yml',
    schemaPath: 'governance/schemas/governance-adoption-plan.schema.json'
  },
  {
    name: 'Review lifecycle',
    statePath: 'governance/REVIEW_LIFECYCLE.yml',
    schemaPath: 'governance/schemas/review-lifecycle.schema.json'
  }
];

const loaded = {};
const errors = [];

for (const authority of authorities) {
  const state = readYaml(authority.statePath);
  const schema = readJson(authority.schemaPath);
  loaded[authority.statePath] = state;
  for (const error of validateSchema(schema, state)) {
    errors.push(`${authority.name}: ${error}`);
  }
}

const policy = loaded['governance/AI_AUTHORITY_POLICY.yml'];
const memory = loaded['planning/CAPABILITY_MEMORY.yml'];
const plan = loaded['planning/GOVERNANCE_ADOPTION_PLAN.yml'];
const lifecycle = loaded['governance/REVIEW_LIFECYCLE.yml'];

const repository = 'rezahh107/EV4-Builder-Assistant-Repo';
for (const [label, actual] of [
  ['policy repository', policy.repository_identity?.repository],
  ['capability repository', memory.repository],
  ['plan repository', plan.plan_identity?.target_repository],
  ['scope project', plan.scope_projection?.project],
  ['review lifecycle repository', lifecycle.repository]
]) {
  if (actual !== repository) errors.push(`${label}: expected ${repository}, received ${actual}.`);
}

const revisions = [
  memory.scope_revision,
  plan.current_increment?.scope_revision,
  plan.scope_projection?.scope_revision,
  plan.scope_change_disclosure?.to_scope_revision
];
if (!revisions.every((revision) => revision === revisions[0])) {
  errors.push(`scope revisions must match: ${JSON.stringify(revisions)}.`);
}

const capabilities = memory.capabilities || [];
const capabilityIds = capabilities.map((item) => item.capability_id);
if (unique(capabilityIds).length !== capabilityIds.length) {
  errors.push('capability IDs must be unique.');
}
if (!setEquals(capabilityIds, plan.scope_projection?.long_term_target_ids || [])) {
  errors.push('long_term_target_ids must exactly match capability memory IDs.');
}

const lifecycleById = Object.fromEntries(capabilities.map((item) => [item.capability_id, item.lifecycle]));
const derivedImplemented = capabilityIds.filter((id) => lifecycleById[id] === 'implemented').sort();
const derivedCommitted = capabilityIds.filter((id) => lifecycleById[id] === 'committed_now').sort();
const derivedDeferred = capabilityIds.filter((id) => lifecycleById[id] === 'deferred_not_deleted').sort();

if (!setEquals(derivedImplemented, plan.scope_projection?.implemented_ids || [])) {
  errors.push('implemented_ids must match capability memory lifecycle=implemented.');
}
if (!setEquals(derivedCommitted, plan.scope_projection?.committed_now_ids || [])) {
  errors.push('committed_now_ids must match capability memory lifecycle=committed_now.');
}
if (!setEquals(derivedDeferred, plan.scope_projection?.deferred_not_deleted_ids || [])) {
  errors.push('deferred_not_deleted_ids must match capability memory lifecycle=deferred_not_deleted.');
}
if (!setEquals(plan.scope_projection?.excluded_now_ids || [], derivedDeferred)) {
  errors.push('excluded_now_ids must equal the current deferred_not_deleted capability set.');
}

const expectedGovStates = {
  'GOV-CAP-001': 'implemented',
  'GOV-CAP-002': 'implemented',
  'GOV-CAP-003': 'committed_now',
  'GOV-CAP-004': 'committed_now',
  'GOV-CAP-005': 'committed_now'
};
for (const [id, expected] of Object.entries(expectedGovStates)) {
  if (lifecycleById[id] !== expected) {
    errors.push(`${id}: expected lifecycle ${expected}, received ${lifecycleById[id]}.`);
  }
}
for (const id of ['PROD-CAP-001', 'PROD-CAP-002', 'PROD-CAP-003', 'PROD-CAP-004']) {
  if (lifecycleById[id] !== 'deferred_not_deleted') {
    errors.push(`${id}: product capability must remain deferred_not_deleted.`);
  }
}

for (const capability of capabilities) {
  if (capability.capability_id.startsWith('GOV-')) {
    if (!Array.isArray(capability.authority) || capability.authority.length === 0) {
      errors.push(`${capability.capability_id}: governance authority must be a non-empty sequence.`);
    }
  } else if (typeof capability.source_authority !== 'string') {
    errors.push(`${capability.capability_id}: product capability must retain source_authority.`);
  }
}

const previous = plan.previous_scope_snapshot?.lifecycle_by_id || {};
const currentIds = new Set(capabilityIds);
const deletedTargets = Object.keys(previous).filter((id) => !currentIds.has(id)).sort();
if (!setEquals(deletedTargets, plan.scope_change_disclosure?.deleted_target_ids || [])) {
  errors.push(`deleted_target_ids disclosure mismatch: computed=${JSON.stringify(deletedTargets)}.`);
}
if (deletedTargets.length > 0) {
  errors.push(`silent capability deletion is forbidden: ${deletedTargets.join(', ')}.`);
}

const introducedTargets = capabilityIds.filter((id) => !Object.prototype.hasOwnProperty.call(previous, id)).sort();
if (!setEquals(introducedTargets, plan.scope_change_disclosure?.newly_introduced_target_ids || [])) {
  errors.push(`newly_introduced_target_ids disclosure mismatch: computed=${JSON.stringify(introducedTargets)}.`);
}

const computedChanges = capabilityIds
  .filter((id) => Object.prototype.hasOwnProperty.call(previous, id) && previous[id] !== lifecycleById[id])
  .map((id) => ({ capability_id: id, from: previous[id], to: lifecycleById[id] }))
  .sort((a, b) => a.capability_id.localeCompare(b.capability_id));
const disclosedChanges = [...(plan.scope_change_disclosure?.lifecycle_changes || [])]
  .sort((a, b) => a.capability_id.localeCompare(b.capability_id));
if (JSON.stringify(computedChanges) !== JSON.stringify(disclosedChanges)) {
  errors.push(`scope lifecycle disclosure mismatch: computed=${JSON.stringify(computedChanges)} disclosed=${JSON.stringify(disclosedChanges)}.`);
}
if (plan.scope_change_disclosure?.disclosure_computed_from_capability_ids !== true) {
  errors.push('scope disclosure must state disclosure_computed_from_capability_ids=true.');
}

const forbiddenFields = [
  'human_technical_approval',
  'owner_technical_signoff',
  'owner_scope_acknowledgement',
  'human_review_required',
  'specialist_signoff'
];
for (const [filePath, state] of Object.entries(loaded)) {
  for (const finding of findForbiddenKeys(state, forbiddenFields)) {
    errors.push(`${filePath}: prohibited human technical gate field at ${finding}.`);
  }
}

const publicDisposition = policy.security_profile?.activation_trigger_evaluation?.public_repository?.decision;
if (publicDisposition !== 'retain_minimum_security_with_public_repository_hygiene') {
  errors.push('public repository security trigger requires an explicit minimum-security disposition.');
}
const controls = policy.security_profile?.mandatory_minimum_controls || [];
for (const requiredControl of [
  'no_secrets_credentials_tokens_passwords_or_private_keys',
  'destructive_action_requires_exact_target_scope_and_recovery_path',
  'missing_access_identity_or_evidence_must_fail_closed'
]) {
  if (!controls.includes(requiredControl)) errors.push(`missing mandatory security control: ${requiredControl}.`);
}

const expectedEnforcement = {
  'AIGOV-START-001': 'validator_backed',
  'AIGOV-SCOPE-001': 'sequence_ci',
  'AIGOV-SCOPE-DISCLOSURE-001': 'sequence_ci',
  'AIGOV-PROGRESS-001': 'sequence_ci',
  'AIGOV-EVIDENCE-001': 'ci_enforced',
  'AIGOV-INDEPENDENCE-001': 'sequence_ci',
  'AIGOV-STALE-001': 'sequence_ci',
  'AIGOV-MERGE-001': 'sequence_ci',
  'AIGOV-SECURITY-PROFILE-001': 'validator_backed',
  'AIGOV-HUMAN-001': 'validator_backed',
  'AIGOV-COACH-001': 'validator_backed'
};
for (const [ruleId, expected] of Object.entries(expectedEnforcement)) {
  if (policy.current_enforcement?.[ruleId] !== expected) {
    errors.push(`${ruleId}: expected enforcement ${expected}, received ${policy.current_enforcement?.[ruleId]}.`);
  }
}

for (const predicate of [
  'exact_head_matches_receipt',
  'scope_revision_matches_receipt',
  'independent_reviewer',
  'all_required_exact_head_checks_success',
  'unresolved_blocking_findings',
  'scope_change_disclosure_valid',
  'prohibited_human_technical_gate_absent',
  'security_profile_valid',
  'completion_evidence_complete'
]) {
  if (!Object.prototype.hasOwnProperty.call(lifecycle.green_merge_predicates || {}, predicate)) {
    errors.push(`review lifecycle missing Green predicate: ${predicate}.`);
  }
}
if (lifecycle.green_merge_predicates?.unresolved_blocking_findings !== false) {
  errors.push('Green predicate unresolved_blocking_findings must be false.');
}

for (const artifact of plan.completion_evidence?.required_artifacts || []) {
  if (!fs.existsSync(artifact)) errors.push(`required governance artifact is missing: ${artifact}.`);
}

if (errors.length > 0) {
  printFailure('Governance authority validation failed:', errors);
  process.exit(1);
}

console.log('Governance authority validation passed.');
console.log(`scope_revision=${revisions[0]}`);
console.log(`capabilities=${capabilityIds.length}`);
console.log(`lifecycle_changes=${computedChanges.length}`);
