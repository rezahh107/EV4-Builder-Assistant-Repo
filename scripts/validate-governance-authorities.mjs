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

const authoritySpecs = [
  ['AI authority policy', 'governance/AI_AUTHORITY_POLICY.yml', 'governance/schemas/ai-authority-policy.schema.json'],
  ['Capability memory', 'planning/CAPABILITY_MEMORY.yml', 'governance/schemas/capability-memory.schema.json'],
  ['Governance adoption plan', 'planning/GOVERNANCE_ADOPTION_PLAN.yml', 'governance/schemas/governance-adoption-plan.schema.json'],
  ['Review lifecycle', 'governance/REVIEW_LIFECYCLE.yml', 'governance/schemas/review-lifecycle.schema.json']
];
const loaded = {};
const errors = [];
for (const [name, statePath, schemaPath] of authoritySpecs) {
  const state = readYaml(statePath);
  const schema = readJson(schemaPath);
  loaded[statePath] = state;
  for (const error of validateSchema(schema, state)) errors.push(`${name}: ${error}`);
}

const policy = loaded['governance/AI_AUTHORITY_POLICY.yml'];
const memory = loaded['planning/CAPABILITY_MEMORY.yml'];
const plan = loaded['planning/GOVERNANCE_ADOPTION_PLAN.yml'];
const lifecycle = loaded['governance/REVIEW_LIFECYCLE.yml'];
const receiptSchema = readJson('governance/schemas/review-receipt.schema.json');
const repository = 'rezahh107/EV4-Builder-Assistant-Repo';
const inspectorRepository = 'rezahh107/PR-Inspector';
const inspectorRepositoryId = 1288323264;
const inspectorProtocolVersion = 'v1.10.0';
const scopeRevision = 'GOV-004-v4';
const previousScopeRevision = 'GOV-004-v3';
const previousScopeHead = '04605d0d10f9ec731eaf074d574e96e49560dded';
const enforcementStatus = 'mixed_sequence_ci_and_fail_closed_validator_backed';

for (const [label, actual] of [
  ['policy repository', policy.repository_identity?.repository],
  ['capability repository', memory.repository],
  ['plan repository', plan.plan_identity?.target_repository],
  ['scope project', plan.scope_projection?.project],
  ['review lifecycle repository', lifecycle.repository]
]) if (actual !== repository) errors.push(`${label}: expected ${repository}, received ${actual}.`);

const revisions = [
  memory.scope_revision,
  plan.current_increment?.scope_revision,
  plan.scope_projection?.scope_revision,
  plan.scope_change_disclosure?.to_scope_revision
];
if (!revisions.every((value) => value === scopeRevision)) errors.push(`scope revisions must all equal ${scopeRevision}: ${JSON.stringify(revisions)}.`);
if (plan.previous_scope_snapshot?.scope_revision !== previousScopeRevision) errors.push(`previous scope revision must equal ${previousScopeRevision}.`);
if (plan.previous_scope_snapshot?.source_commit !== previousScopeHead) errors.push('previous scope source commit must identify the reviewed GOV-004-v3 head.');
if (plan.scope_change_disclosure?.from_scope_revision !== previousScopeRevision || plan.scope_change_disclosure?.to_scope_revision !== scopeRevision) errors.push('scope disclosure must map GOV-004-v3 to GOV-004-v4.');
if (plan.scope_change_disclosure?.revision_reason !== 'canonical_pr_inspector_artifact_and_decision_projection_binding') errors.push('scope disclosure must record the canonical PR Inspector artifact binding revision reason.');
if (plan.scope_change_disclosure?.source_object_identities?.previous_scope_source_commit !== previousScopeHead) errors.push('scope disclosure previous source commit is missing or mismatched.');
if (plan.current_increment?.implementation_context_id !== 'repo-maintainer-gov-003-004') errors.push('implementation context must remain repo-maintainer-gov-003-004.');

const capabilities = memory.capabilities || [];
const capabilityIds = capabilities.map((item) => item.capability_id);
if (unique(capabilityIds).length !== capabilityIds.length) errors.push('capability IDs must be unique.');
if (!setEquals(capabilityIds, plan.scope_projection?.long_term_target_ids || [])) errors.push('long_term_target_ids must exactly match capability memory IDs.');
const lifecycleById = Object.fromEntries(capabilities.map((item) => [item.capability_id, item.lifecycle]));
const implemented = capabilityIds.filter((id) => lifecycleById[id] === 'implemented').sort();
const committed = capabilityIds.filter((id) => lifecycleById[id] === 'committed_now').sort();
const deferred = capabilityIds.filter((id) => lifecycleById[id] === 'deferred_not_deleted').sort();
if (!setEquals(implemented, plan.scope_projection?.implemented_ids || [])) errors.push('implemented_ids must match capability memory.');
if (!setEquals(committed, plan.scope_projection?.committed_now_ids || [])) errors.push('committed_now_ids must match capability memory.');
if (!setEquals(deferred, plan.scope_projection?.deferred_not_deleted_ids || [])) errors.push('deferred_not_deleted_ids must match capability memory.');
if (!setEquals(deferred, plan.scope_projection?.excluded_now_ids || [])) errors.push('excluded_now_ids must equal deferred_not_deleted IDs.');
for (const [id, expected] of Object.entries({
  'GOV-CAP-001': 'implemented',
  'GOV-CAP-002': 'implemented',
  'GOV-CAP-003': 'committed_now',
  'GOV-CAP-004': 'committed_now',
  'GOV-CAP-005': 'committed_now',
  'PROD-CAP-001': 'deferred_not_deleted',
  'PROD-CAP-002': 'deferred_not_deleted',
  'PROD-CAP-003': 'deferred_not_deleted',
  'PROD-CAP-004': 'deferred_not_deleted'
})) if (lifecycleById[id] !== expected) errors.push(`${id}: expected ${expected}, received ${lifecycleById[id]}.`);
for (const capability of capabilities) {
  if (capability.capability_id?.startsWith('GOV-') && (!Array.isArray(capability.authority) || capability.authority.length === 0)) errors.push(`${capability.capability_id}: governance authority must be a non-empty sequence.`);
  if (capability.capability_id?.startsWith('PROD-') && typeof capability.source_authority !== 'string') errors.push(`${capability.capability_id}: product source_authority is required.`);
}

const previous = plan.previous_scope_snapshot?.lifecycle_by_id || {};
const deleted = Object.keys(previous).filter((id) => !capabilityIds.includes(id)).sort();
const introduced = capabilityIds.filter((id) => !Object.prototype.hasOwnProperty.call(previous, id)).sort();
const changes = capabilityIds.filter((id) => Object.prototype.hasOwnProperty.call(previous, id) && previous[id] !== lifecycleById[id]).map((id) => ({ capability_id: id, from: previous[id], to: lifecycleById[id] })).sort((a, b) => a.capability_id.localeCompare(b.capability_id));
const normalize = (item) => ({ capability_id: item.capability_id ?? null, from: item.from ?? null, to: item.to ?? null });
const disclosedChanges = [...(plan.scope_change_disclosure?.lifecycle_changes || [])].map(normalize).sort((a, b) => (a.capability_id || '').localeCompare(b.capability_id || ''));
if (deleted.length) errors.push(`silent capability deletion is forbidden: ${deleted.join(', ')}.`);
if (!setEquals(deleted, plan.scope_change_disclosure?.deleted_target_ids || [])) errors.push('deleted target disclosure mismatch.');
if (!setEquals(introduced, plan.scope_change_disclosure?.newly_introduced_target_ids || [])) errors.push('introduced target disclosure mismatch.');
if (JSON.stringify(changes.map(normalize)) !== JSON.stringify(disclosedChanges)) errors.push('scope lifecycle disclosure mismatch.');
if (plan.scope_change_disclosure?.disclosure_computed_from_capability_ids !== true) errors.push('scope disclosure must be computed from capability IDs.');
if (plan.scope_change_disclosure?.reviewed_head_binding_required !== true) errors.push('exact reviewed-head binding must be required.');
if (plan.scope_change_disclosure?.exact_head_binding_carrier !== 'governance/schemas/review-receipt.schema.json') errors.push('review receipt schema must remain the exact-head carrier.');
const counts = plan.scope_change_disclosure?.set_counts || {};
for (const [name, expected] of Object.entries({ target: 9, implemented: 2, committed: 3, deferred: 4, excluded: 4, rejected: 0, superseded: 0 })) if (counts[name] !== expected) errors.push(`scope count ${name}: expected ${expected}, received ${counts[name]}.`);

const expectedReceiptFields = [
  'repository', 'pull_request', 'base_sha', 'reviewed_head_sha', 'scope_revision',
  'implementation_context_id', 'exact_head_ci_run_ids', 'reviewed_at',
  'inspector_repository', 'inspector_repository_id', 'inspector_commit_sha',
  'inspector_commit_api_url', 'inspector_commit_html_url', 'inspector_evidence_source',
  'protocol_version', 'review_evidence_id', 'review_package_canonical_sha256',
  'review_package_file_sha256', 'decision_projection_sha256', 'artifact_manifest_sha256',
  'review_validity', 'technical_status'
];
if (!setEquals(lifecycle.required_receipt_fields || [], expectedReceiptFields)) errors.push('lifecycle required receipt fields do not match the canonical artifact contract.');
if (!setEquals(receiptSchema.required || [], expectedReceiptFields)) errors.push('receipt schema required fields do not match lifecycle authority.');
if (receiptSchema.properties?.scope_revision?.const !== scopeRevision) errors.push('receipt schema scope revision must be GOV-004-v4.');
if (receiptSchema.properties?.inspector_repository?.const !== inspectorRepository) errors.push('receipt inspector repository const is invalid.');
if (receiptSchema.properties?.inspector_repository_id?.const !== inspectorRepositoryId) errors.push('receipt inspector repository ID const is invalid.');
if (receiptSchema.properties?.protocol_version?.const !== inspectorProtocolVersion) errors.push('receipt protocol version const is invalid.');
if (receiptSchema.properties?.inspector_evidence_source?.const !== 'github_rest_api_https') errors.push('receipt inspector evidence source must be github_rest_api_https.');
if (!setEquals(receiptSchema.properties?.technical_status?.enum || [], ['GREEN_TECHNICALLY_READY', 'YELLOW_CHANGES_OR_VERIFICATION_REQUIRED', 'RED_DO_NOT_MERGE'])) errors.push('receipt technical statuses must match canonical PR Inspector statuses.');
for (const forbidden of ['reviewer_actor_login', 'reviewer_context_id', 'independent', 'findings']) if (receiptSchema.properties?.[forbidden] !== undefined) errors.push(`receipt schema must not treat ${forbidden} as technical authority.`);

const inspector = lifecycle.canonical_pr_inspector_authority || {};
if (lifecycle.protocol_version !== 4) errors.push('review lifecycle protocol_version must equal 4.');
if (inspector.repository !== inspectorRepository || inspector.repository_id !== inspectorRepositoryId) errors.push('canonical inspector repository identity mismatch.');
if (inspector.active_protocol_version !== inspectorProtocolVersion) errors.push('canonical inspector protocol mismatch.');
if (inspector.commit_provenance !== 'github_rest_api_https') errors.push('inspector commit provenance must be github_rest_api_https.');
if (!setEquals(inspector.required_artifacts || [], ['review-package.json', 'DECISION_PROJECTION.json', 'artifact-manifest.json'])) errors.push('canonical inspector artifact set mismatch.');
if (inspector.official_local_accessor !== 'pr_inspector.official_review.verify_completed_review') errors.push('official local accessor mismatch.');
if (inspector.official_artifact_source !== 'local_review_directory') errors.push('official artifact source must be local_review_directory.');
if (inspector.external_retrievable_accessor_available !== false || inspector.external_bundle_locator !== 'unavailable') errors.push('external official bundle accessor must remain explicitly unavailable.');

for (const [field, expected] of Object.entries({
  canonical_inspector_bundle_is_primary_authority: true,
  decision_projection_is_technical_status_authority: true,
  receipt_declarations_are_untrusted_until_bundle_verified: true,
  inspector_commit_must_exist_in_exact_inspector_repository: true,
  review_evidence_id_must_be_recomputed: true,
  transport_actor_is_audit_metadata_only: true,
  transport_actor_is_not_independence_proof: true,
  self_declared_independent_boolean_is_forbidden: true
})) if (lifecycle.independence_rule?.[field] !== expected) errors.push(`independence_rule.${field} must equal ${expected}.`);
if (!setEquals(lifecycle.stale_on_change || [], ['pull_request_head_sha', 'scope_revision', 'required_check_set', 'inspector_protocol_identity', 'canonical_review_bundle_identity'])) errors.push('stale-on-change authority is incomplete.');
if (!setEquals(lifecycle.technical_statuses || [], ['GREEN_TECHNICALLY_READY', 'YELLOW_CHANGES_OR_VERIFICATION_REQUIRED', 'RED_DO_NOT_MERGE'])) errors.push('lifecycle technical statuses mismatch canonical PR Inspector.');

const live = lifecycle.live_receipt_validation || {};
if (live.mode !== 'canonical_bundle_fail_closed_operator_invoked') errors.push('live validation mode must be canonical_bundle_fail_closed_operator_invoked.');
if (live.authoritative_api_origin !== 'https://api.github.com' || live.caller_controlled_api_origin_allowed !== false || live.redirects_allowed !== false) errors.push('GitHub API trust boundary is not pinned and fail closed.');
if (live.external_official_bundle_accessor_available !== false) errors.push('external official bundle accessor availability must be false.');
if (live.activation_state !== 'official_external_bundle_accessor_unavailable_fail_closed') errors.push('activation state must record unavailable accessor fail-closed behavior.');
if (live.trusted_byte_handling !== 'capture_hash_validate_manifest_and_parse_same_in_memory_bytes') errors.push('trusted-byte handling contract mismatch.');
if (live.technical_status_authority !== 'verified_DECISION_PROJECTION_json') errors.push('technical status authority must be verified DECISION_PROJECTION.json.');
if (live.transport_actor_role !== 'audit_metadata_only') errors.push('transport actor role must be audit_metadata_only.');
if (!Array.isArray(live.required_token_permissions) || live.required_token_permissions.length !== 0) errors.push('unavailable source=github path must require no token permissions.');

const expectedEnforcement = {
  'AIGOV-START-001': 'validator_backed',
  'AIGOV-SCOPE-001': 'sequence_ci_enforced',
  'AIGOV-SCOPE-DISCLOSURE-001': 'sequence_ci_enforced',
  'AIGOV-PROGRESS-001': 'sequence_ci_enforced',
  'AIGOV-EVIDENCE-001': 'ci_enforced',
  'AIGOV-INDEPENDENCE-001': 'fail_closed_validator_backed',
  'AIGOV-STALE-001': 'fail_closed_validator_backed',
  'AIGOV-MERGE-001': 'fail_closed_validator_backed',
  'AIGOV-SECURITY-PROFILE-001': 'validator_backed',
  'AIGOV-HUMAN-001': 'validator_backed',
  'AIGOV-COACH-001': 'validator_backed'
};
for (const [id, expected] of Object.entries(expectedEnforcement)) if (policy.current_enforcement?.[id] !== expected) errors.push(`${id}: expected ${expected}, received ${policy.current_enforcement?.[id]}.`);
for (const id of Object.keys(expectedEnforcement)) {
  const rule = policy.rules?.[id];
  if (!rule) errors.push(`${id}: rule definition is missing.`);
  else for (const field of ['risk', 'session_scope', 'trigger', 'predicate', 'enforcement', 'recovery_action']) if (rule[field] === undefined || rule[field] === null) errors.push(`${id}: missing ${field}.`);
}

const expectedGreen = { exact_head_matches_receipt: true, scope_revision_matches_receipt: true, independent_reviewer: true, all_required_exact_head_checks_success: true, unresolved_blocking_findings: false, scope_change_disclosure_valid: true, prohibited_human_technical_gate_absent: true, security_profile_valid: true, completion_evidence_complete: true };
function greenErrors(value) { return Object.entries(expectedGreen).filter(([key, expected]) => value?.[key] !== expected).map(([key, expected]) => `GOV-AUTH-001_GREEN_PREDICATE_VALUE:${key}:expected=${expected}:received=${value?.[key]}`); }
errors.push(...greenErrors(lifecycle.green_merge_predicates));
const authorityFixture = readJson('tests/governance/invalid/authority_failures.json');
for (const item of authorityFixture.green_merge_predicate_cases || []) {
  const diagnostics = greenErrors({ ...lifecycle.green_merge_predicates, ...(item.overrides || {}) });
  for (const expected of item.expected_diagnostics || []) if (!diagnostics.some((value) => value === expected || value.startsWith(`${expected}:`))) errors.push(`authority fixture ${item.case_id} missing ${expected}.`);
  if (!diagnostics.length) errors.push(`authority fixture ${item.case_id} unexpectedly passed.`);
}

const expectedChecks = [
  { check_id: 'implementation_validation', workflow_name: 'Schema validation', event: 'pull_request' },
  { check_id: 'project_gate_pin', workflow_name: 'Verify Project Gate Contract Pin', event: 'pull_request' }
].sort((a, b) => a.check_id.localeCompare(b.check_id));
const actualChecks = [...(lifecycle.required_check_set?.checks || [])].map(({ check_id, workflow_name, event }) => ({ check_id, workflow_name, event })).sort((a, b) => (a.check_id || '').localeCompare(b.check_id || ''));
if (lifecycle.required_check_set?.version !== 1 || JSON.stringify(actualChecks) !== JSON.stringify(expectedChecks)) errors.push('required-check authority mismatch.');

const forbiddenFields = ['human_technical_approval', 'owner_technical_signoff', 'owner_scope_acknowledgement', 'human_review_required', 'specialist_signoff'];
for (const [filePath, state] of Object.entries(loaded)) for (const finding of findForbiddenKeys(state, forbiddenFields)) errors.push(`${filePath}: prohibited human technical gate at ${finding}.`);
const controls = policy.security_profile?.mandatory_minimum_controls || [];
for (const control of ['no_secrets_credentials_tokens_passwords_or_private_keys', 'destructive_action_requires_exact_target_scope_and_recovery_path', 'missing_access_identity_or_evidence_must_fail_closed']) if (!controls.includes(control)) errors.push(`missing mandatory security control: ${control}.`);
if (policy.security_profile?.activation_trigger_evaluation?.public_repository?.decision !== 'retain_minimum_security_with_public_repository_hygiene') errors.push('public repository security disposition is missing.');

const requiredNonClaims = ['automatic_premerge_live_receipt_ci_enforced', 'official_remote_review_bundle_accessor_available', 'canonical_pr_inspector_bundle_live_verified', 'independent_review_live_enforced', 'merge_recommendation_live_enforced'];
for (const value of requiredNonClaims) {
  if (!policy.non_claims?.includes(value)) errors.push(`policy non-claim is missing: ${value}.`);
  if (!plan.prohibited_claims?.includes(value)) errors.push(`plan prohibited claim is missing: ${value}.`);
}
if (lifecycle.current_enforcement_status !== enforcementStatus || memory.current_enforcement_status !== enforcementStatus || plan.current_enforcement_status !== enforcementStatus) errors.push('authority enforcement statuses must use the fail-closed mixed state.');
for (const artifact of plan.completion_evidence?.required_artifacts || []) if (!fs.existsSync(artifact)) errors.push(`required governance artifact is missing: ${artifact}.`);

if (errors.length) {
  printFailure('Governance authority validation failed:', errors);
  process.exit(1);
}
console.log('Governance authority validation passed.');
console.log(`scope_revision=${scopeRevision}`);
console.log(`capabilities=${capabilityIds.length}`);
console.log('official_pr_inspector_accessor=local_review_directory_only');
console.log('external_official_bundle_accessor=unavailable');
console.log('live_green_boundary=fail_closed');
console.log(`enforcement_status=${enforcementStatus}`);
