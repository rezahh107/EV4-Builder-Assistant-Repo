#!/usr/bin/env node
import fs from 'node:fs';
import {
  findForbiddenKeys,
  printFailure,
  readJson,
  readText,
  readYaml,
  setEquals,
  unique,
  validateSchema
} from './governance-lib.mjs';

const specs = [
  ['policy', 'governance/AI_AUTHORITY_POLICY.yml', 'governance/schemas/ai-authority-policy.schema.json'],
  ['memory', 'planning/CAPABILITY_MEMORY.yml', 'governance/schemas/capability-memory.schema.json'],
  ['plan', 'planning/GOVERNANCE_ADOPTION_PLAN.yml', 'governance/schemas/governance-adoption-plan.schema.json'],
  ['lifecycle', 'governance/REVIEW_LIFECYCLE.yml', 'governance/schemas/review-lifecycle.schema.json']
];
const loaded = {};
const errors = [];
for (const [name, statePath, schemaPath] of specs) {
  const state = readYaml(statePath);
  loaded[name] = state;
  for (const error of validateSchema(readJson(schemaPath), state)) {
    errors.push(`${name}: ${error}`);
  }
}

const policy = loaded.policy;
const memory = loaded.memory;
const plan = loaded.plan;
const lifecycle = loaded.lifecycle;
const receiptSchema = readJson('governance/schemas/review-receipt.schema.json');
const projectionCases = readJson('tests/governance/pr-inspector-projection-cases.json');
const progressCases = readJson('tests/governance/progress-evidence-cases.json');
const templateCases = readJson('tests/governance/pr-template-hygiene-cases.json');

const repository = 'rezahh107/EV4-Builder-Assistant-Repo';
const inspectorRepository = 'rezahh107/PR-Inspector';
const inspectorRepositoryId = 1288323264;
const inspectorCommit = '88e8610bcc2ada48c8cf902d23d4296983310872';
const inspectorProtocol = 'v1.10.0';
const reviewedHead = '064805f59762e191ae386423b07d73bcf5cae7be';
const mergeCommit = '65450bc5a4d19edf66098669a6fd48bdcda3ed70';
const previousScopeHead = '921cfd7623eb5698901b5bce7ab77a053d09e6b9';
const scopeRevision = 'GOV-004-v7';
const previousScopeRevision = 'GOV-004-v6';
const implementationContext = 'repo-maintainer-gov-003-004-closure-repair';
const enforcementStatus = 'mixed_sequence_ci_and_fail_closed_validator_backed';
const policyStatus = 'deterministic_enforcement_implemented_on_main_external_exact_head_evidence_repair_pending';

for (const [label, actual] of [
  ['policy repository', policy.repository_identity?.repository],
  ['memory repository', memory.repository],
  ['plan repository', plan.plan_identity?.target_repository],
  ['scope repository', plan.scope_projection?.project],
  ['lifecycle repository', lifecycle.repository]
]) {
  if (actual !== repository) errors.push(`${label}: received ${actual}.`);
}

if (
  policy.policy_version !== 6
  || policy.status !== policyStatus
  || policy.repository_identity?.foundation_source_commit !== mergeCommit
) errors.push('policy repair identity is invalid.');
if (
  memory.source_commit !== mergeCommit
  || plan.repository_state?.current_source_commit !== mergeCommit
  || plan.scope_projection?.source_commit !== mergeCommit
) errors.push('live main source commit identity is invalid.');

const revisions = [
  memory.scope_revision,
  plan.current_increment?.scope_revision,
  plan.scope_projection?.scope_revision,
  plan.scope_change_disclosure?.to_scope_revision
];
if (!revisions.every((value) => value === scopeRevision)) {
  errors.push(`scope revisions must equal ${scopeRevision}.`);
}
if (
  plan.previous_scope_snapshot?.scope_revision !== previousScopeRevision
  || plan.previous_scope_snapshot?.source_commit !== previousScopeHead
) errors.push('previous GOV-004-v6 scope identity is invalid.');
if (
  plan.scope_change_disclosure?.from_scope_revision !== previousScopeRevision
  || plan.scope_change_disclosure?.to_scope_revision !== scopeRevision
  || plan.scope_change_disclosure?.revision_reason
    !== 'external_exact_head_evidence_boundary_and_reusable_pr_template'
) errors.push('GOV-004-v6 to GOV-004-v7 disclosure is invalid.');
if (
  plan.scope_change_disclosure?.source_object_identities
    ?.previous_scope_source_commit !== previousScopeHead
) errors.push('previous scope source commit disclosure is invalid.');
if (plan.current_increment?.implementation_context_id !== implementationContext) {
  errors.push('closure-repair implementation context is invalid.');
}

const verifiedMerge = plan.repository_state?.verified_current_increment_merge || {};
if (
  verifiedMerge.increment_id !== 'GOV-003-004-COMPLETE-GOVERNANCE-ENFORCEMENT'
  || verifiedMerge.pr !== 55
  || verifiedMerge.reviewed_head_sha !== reviewedHead
  || verifiedMerge.merge_commit !== mergeCommit
  || verifiedMerge.reviewed_head_tree_preserved !== true
  || verifiedMerge.additional_file_changes_in_merge_commit !== 0
  || verifiedMerge.state !== 'merged_and_repository_content_verified'
  || verifiedMerge.evidence_state !== 'REPOSITORY_CONFIRMED'
) errors.push('verified PR 55 merge evidence is invalid.');

const capabilities = memory.capabilities || [];
const capabilityIds = capabilities.map((item) => item.capability_id);
if (unique(capabilityIds).length !== capabilityIds.length) {
  errors.push('capability IDs must be unique.');
}
if (!setEquals(capabilityIds, plan.scope_projection?.long_term_target_ids || [])) {
  errors.push('scope target IDs must equal capability memory IDs.');
}
const byId = Object.fromEntries(
  capabilities.map((item) => [item.capability_id, item.lifecycle])
);
const expectedLifecycle = {
  'GOV-CAP-001': 'implemented',
  'GOV-CAP-002': 'implemented',
  'GOV-CAP-003': 'implemented',
  'GOV-CAP-004': 'implemented',
  'GOV-CAP-005': 'implemented',
  'PROD-CAP-001': 'deferred_not_deleted',
  'PROD-CAP-002': 'deferred_not_deleted',
  'PROD-CAP-003': 'deferred_not_deleted',
  'PROD-CAP-004': 'deferred_not_deleted'
};
for (const [id, expected] of Object.entries(expectedLifecycle)) {
  if (byId[id] !== expected) {
    errors.push(`${id}: expected ${expected}, received ${byId[id]}.`);
  }
}
const implemented = capabilityIds.filter((id) => byId[id] === 'implemented');
const committed = capabilityIds.filter((id) => byId[id] === 'committed_now');
const deferred = capabilityIds.filter((id) => byId[id] === 'deferred_not_deleted');
if (!setEquals(implemented, plan.scope_projection?.implemented_ids || [])) {
  errors.push('implemented set mismatch.');
}
if (!setEquals(committed, plan.scope_projection?.committed_now_ids || [])) {
  errors.push('committed set mismatch.');
}
if (
  !setEquals(deferred, plan.scope_projection?.deferred_not_deleted_ids || [])
  || !setEquals(deferred, plan.scope_projection?.excluded_now_ids || [])
) errors.push('deferred/excluded set mismatch.');

const previous = plan.previous_scope_snapshot?.lifecycle_by_id || {};
const deleted = Object.keys(previous).filter((id) => !capabilityIds.includes(id));
const introduced = capabilityIds.filter(
  (id) => !Object.prototype.hasOwnProperty.call(previous, id)
);
const changes = capabilityIds
  .filter((id) => previous[id] !== undefined && previous[id] !== byId[id])
  .map((id) => ({ capability_id: id, from: previous[id], to: byId[id] }));
const normalize = (item) => ({
  capability_id: item.capability_id ?? null,
  from: item.from ?? null,
  to: item.to ?? null
});
const disclosed = [...(plan.scope_change_disclosure?.lifecycle_changes || [])]
  .map(normalize)
  .sort((a, b) => (a.capability_id || '').localeCompare(b.capability_id || ''));
const computed = changes.map(normalize)
  .sort((a, b) => (a.capability_id || '').localeCompare(b.capability_id || ''));
if (deleted.length || !setEquals(deleted, plan.scope_change_disclosure?.deleted_target_ids || [])) {
  errors.push('silent or mismatched target deletion.');
}
if (!setEquals(introduced, plan.scope_change_disclosure?.newly_introduced_target_ids || [])) {
  errors.push('introduced target disclosure mismatch.');
}
if (JSON.stringify(disclosed) !== JSON.stringify(computed)) {
  errors.push('lifecycle-change disclosure mismatch.');
}
const counts = plan.scope_change_disclosure?.set_counts || {};
for (const [name, expected] of Object.entries({
  target: 9,
  implemented: 5,
  committed: 0,
  deferred: 4,
  excluded: 4,
  rejected: 0,
  superseded: 0
})) {
  if (counts[name] !== expected) errors.push(`scope count ${name} mismatch.`);
}

const pendingStatus = 'implemented_on_branch_pending_external_exact_head_ci_and_fresh_rereview';
const progress = plan.progress_gate || {};
if (
  plan.current_increment?.implementation_status !== pendingStatus
  || progress.implementation_status !== pendingStatus
  || progress.required_artifacts_verified_on_live_default_branch !== false
  || progress.validator_result !== 'EXTERNAL_EXACT_HEAD_CI_PENDING'
  || progress.ci_result !== 'EXTERNAL_EXACT_HEAD_CI_PENDING'
  || progress.independent_review_result !== 'FRESH_PR_INSPECTOR_REREVIEW_REQUIRED'
  || progress.merge_state !== 'pr_55_merged_pr_56_not_merged'
  || progress.post_merge_verification_result !== 'PR_55_REPOSITORY_CONFIRMED'
) errors.push('closure-repair progress state must remain pending.');
if (
  progress.validator_result === 'CI_CONFIRMED_FOR_REVIEWED_HEAD'
  || progress.ci_result === 'CI_CONFIRMED_FOR_REVIEWED_HEAD'
  || Object.prototype.hasOwnProperty.call(progress, 'exact_head_ci_run_ids')
) errors.push('GOV-AUTH-EXT-CI-001_REPOSITORY_AUTHORED_CI_CONFIRMATION_FORBIDDEN');
if (!setEquals(progress.open_gates || [], [
  'external_exact_head_ci_evidence',
  'fresh_pr_inspector_rereview',
  'official_external_pr_inspector_bundle_accessor',
  'historical_independent_review_evidence_gap',
  'pr_56_merge',
  'gov_004_v7_post_merge_verification'
])) errors.push('remaining closure-repair gates mismatch.');

const mechanism = plan.repository_state?.exact_head_ci_mechanism || {};
if (
  mechanism.external_evidence_workflow
    !== '.github/workflows/governance-exact-head-evidence.yml'
  || mechanism.external_evidence_validator
    !== 'scripts/validate-governance-progress-evidence.mjs'
  || mechanism.repository_authored_confirmation_allowed !== false
) errors.push('external exact-head evidence mechanism is invalid.');
if (plan.completion_evidence?.external_exact_head_evidence_required !== true) {
  errors.push('external exact-head evidence requirement is missing.');
}

const postMerge = plan.completion_evidence?.post_merge_verification || {};
if (
  postMerge.merge_commit !== mergeCommit
  || postMerge.reviewed_head_sha !== reviewedHead
  || postMerge.live_default_branch !== 'main'
  || postMerge.reviewed_head_tree_preserved !== true
  || postMerge.additional_file_changes_in_merge_commit !== 0
  || postMerge.evidence_state !== 'REPOSITORY_CONFIRMED'
) errors.push('PR 55 post-merge verification evidence is invalid.');

const receiptFields = [
  'repository', 'pull_request', 'base_sha', 'reviewed_head_sha',
  'scope_revision', 'implementation_context_id', 'exact_head_ci_run_ids',
  'reviewed_at', 'inspector_repository', 'inspector_repository_id',
  'inspector_commit_sha', 'inspector_commit_api_url',
  'inspector_commit_html_url', 'inspector_evidence_source',
  'protocol_version', 'review_evidence_id',
  'review_package_canonical_sha256', 'review_package_file_sha256',
  'decision_projection_sha256', 'artifact_manifest_sha256',
  'review_validity', 'technical_status', 'approval_requirement',
  'next_action_kind'
];
if (!setEquals(lifecycle.required_receipt_fields || [], receiptFields)) {
  errors.push('lifecycle receipt fields mismatch.');
}
if (!setEquals(receiptSchema.required || [], receiptFields)) {
  errors.push('receipt schema required fields mismatch.');
}
if (receiptSchema.properties?.scope_revision?.const !== scopeRevision) {
  errors.push('receipt schema scope revision mismatch.');
}
if (
  receiptSchema.properties?.inspector_repository?.const !== inspectorRepository
  || receiptSchema.properties?.inspector_repository_id?.const !== inspectorRepositoryId
  || receiptSchema.properties?.inspector_commit_sha?.const !== inspectorCommit
  || receiptSchema.properties?.protocol_version?.const !== inspectorProtocol
) errors.push('receipt inspector identity mismatch.');
for (const forbidden of [
  'reviewer_actor_login', 'reviewer_context_id', 'independent', 'findings'
]) {
  if (receiptSchema.properties?.[forbidden] !== undefined) {
    errors.push(`receipt schema must not authorize ${forbidden}.`);
  }
}

const inspector = lifecycle.canonical_pr_inspector_authority || {};
if (lifecycle.protocol_version !== 5) {
  errors.push('review lifecycle protocol_version must equal 5.');
}
for (const [field, expected] of Object.entries({
  repository: inspectorRepository,
  repository_id: inspectorRepositoryId,
  immutable_commit_sha: inspectorCommit,
  active_protocol_version: inspectorProtocol,
  official_projection_function: 'pr_inspector.decision_projection.project_decision',
  official_completion_boundary: 'pr_inspector.official_review.verify_completed_review',
  official_synthetic_boundary: 'pr_inspector.review_provenance.verify_review_directory',
  external_retrievable_accessor_available: false,
  external_bundle_locator: 'unavailable'
})) {
  if (inspector[field] !== expected) {
    errors.push(`canonical inspector ${field} mismatch.`);
  }
}
if (!setEquals(inspector.official_provenance_functions || [], [
  'pr_inspector.review_provenance.verify_github_commit_payload',
  'pr_inspector.review_provenance.verify_review_directory',
  'pr_inspector.review_provenance.event_evidence_fields'
])) errors.push('official provenance function set mismatch.');

const live = lifecycle.live_receipt_validation || {};
if (
  live.github_source_command
    !== 'node scripts/validate-governance-sequence.mjs --mode=live --source=github'
  || live.activation_state !== 'official_external_bundle_accessor_unavailable_fail_closed'
  || live.external_official_bundle_accessor_available !== false
  || live.technical_status_authority !== 'immutable_pr_inspector_project_decision'
) errors.push('live fail-closed boundary mismatch.');

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
for (const [id, expected] of Object.entries(expectedEnforcement)) {
  if (policy.current_enforcement?.[id] !== expected) {
    errors.push(`${id}: enforcement mismatch.`);
  }
  const rule = policy.rules?.[id];
  for (const field of [
    'risk', 'session_scope', 'trigger', 'predicate', 'enforcement',
    'recovery_action'
  ]) {
    if (rule?.[field] === undefined || rule?.[field] === null) {
      errors.push(`${id}: missing ${field}.`);
    }
  }
}

const expectedGreen = {
  exact_head_matches_receipt: true,
  scope_revision_matches_receipt: true,
  independent_reviewer: true,
  all_required_exact_head_checks_success: true,
  unresolved_blocking_findings: false,
  scope_change_disclosure_valid: true,
  prohibited_human_technical_gate_absent: true,
  security_profile_valid: true,
  completion_evidence_complete: true
};
for (const [key, expected] of Object.entries(expectedGreen)) {
  if (lifecycle.green_merge_predicates?.[key] !== expected) {
    errors.push(`Green predicate ${key} mismatch.`);
  }
}
const authorityFixture = readJson('tests/governance/invalid/authority_failures.json');
for (const item of authorityFixture.green_merge_predicate_cases || []) {
  const value = {
    ...lifecycle.green_merge_predicates,
    ...(item.overrides || {})
  };
  if (Object.entries(expectedGreen).every(([key, expected]) => value[key] === expected)) {
    errors.push(`authority fixture ${item.case_id} unexpectedly passed.`);
  }
}

const forbiddenFields = [
  'human_technical_approval', 'owner_technical_signoff',
  'owner_scope_acknowledgement', 'human_review_required',
  'specialist_signoff'
];
for (const [name, state] of Object.entries(loaded)) {
  for (const finding of findForbiddenKeys(state, forbiddenFields)) {
    errors.push(`${name}: prohibited human technical gate at ${finding}.`);
  }
}
const controls = policy.security_profile?.mandatory_minimum_controls || [];
for (const control of [
  'no_secrets_credentials_tokens_passwords_or_private_keys',
  'destructive_action_requires_exact_target_scope_and_recovery_path',
  'missing_access_identity_or_evidence_must_fail_closed'
]) {
  if (!controls.includes(control)) errors.push(`missing control: ${control}.`);
}

const requiredNonClaims = [
  'automatic_premerge_live_receipt_ci_enforced',
  'official_remote_review_bundle_accessor_available',
  'canonical_pr_inspector_bundle_live_verified',
  'independent_review_live_enforced',
  'merge_recommendation_live_enforced',
  'target_repository_independently_implements_pr_inspector_projection',
  'target_repository_independently_implements_review_provenance'
];
for (const value of requiredNonClaims) {
  if (!policy.non_claims?.includes(value)) {
    errors.push(`policy non-claim missing: ${value}.`);
  }
  if (!plan.prohibited_claims?.includes(value)) {
    errors.push(`plan prohibited claim missing: ${value}.`);
  }
}
if (!plan.prohibited_claims?.includes('repository_authored_exact_head_ci_confirmation')) {
  errors.push('plan must prohibit repository-authored exact-head CI confirmation.');
}
if (
  lifecycle.current_enforcement_status !== enforcementStatus
  || memory.current_enforcement_status !== enforcementStatus
  || plan.current_enforcement_status !== enforcementStatus
) errors.push('enforcement status mismatch.');

const sequenceSource = readText('scripts/validate-governance-sequence.mjs');
for (const forbidden of [
  'function projectionFromPackage',
  'function canonicalEvidenceId',
  'canonicalJsonBytes',
  'artifact_bytes_base64'
]) {
  if (sequenceSource.includes(forbidden)) {
    errors.push(`local replica remains: ${forbidden}.`);
  }
}
for (const required of [
  'GOV-LIVE-030_OFFICIAL_BUNDLE_ACCESSOR_UNAVAILABLE',
  'GOV-LIVE-049_LOCAL_CANONICAL_BUNDLE_ACCEPTANCE_REMOVED'
]) {
  if (!sequenceSource.includes(required)) errors.push(`missing ${required}.`);
}

const adapter = readText('scripts/verify-pr-inspector-bundle.py');
for (const required of [
  'from pr_inspector.decision_projection import project_decision',
  'verify_completed_review',
  'verify_github_commit_payload',
  'verify_review_directory',
  'event_evidence_fields'
]) {
  if (!adapter.includes(required)) errors.push(`adapter missing ${required}.`);
}
for (const forbidden of [
  'def canonical_evidence_id',
  'def projection_from_package',
  'def collect_reason_instances'
]) {
  if (adapter.includes(forbidden)) errors.push(`adapter replica: ${forbidden}.`);
}

const schemaWorkflow = readText('.github/workflows/schema-validation.yml');
for (const required of [
  inspectorCommit,
  'repository: rezahh107/PR-Inspector',
  'persist-credentials: false',
  'fetch-depth: 1',
  'scripts/test-pr-inspector-official-integration.py',
  'scripts/verify-pr-inspector-bundle.py',
  'GOV-LIVE-030_OFFICIAL_BUNDLE_ACCESSOR_UNAVAILABLE',
  'GOV-LIVE-049_LOCAL_CANONICAL_BUNDLE_ACCEPTANCE_REMOVED'
]) {
  if (!schemaWorkflow.includes(required)) errors.push(`schema workflow missing ${required}.`);
}
const evidenceWorkflow = readText('.github/workflows/governance-exact-head-evidence.yml');
for (const required of [
  'name: Verify Governance Exact-Head Evidence',
  'actions: read',
  'pull-requests: read',
  'Schema validation',
  'Verify Project Gate Contract Pin',
  'github_actions_api',
  'scripts/validate-governance-progress-evidence.mjs',
  'persist-credentials: false'
]) {
  if (!evidenceWorkflow.includes(required)) errors.push(`external evidence workflow missing ${required}.`);
}
const central = readText('scripts/validate.mjs');
for (const required of [
  'scripts/validate-governance-progress-evidence.mjs',
  'scripts/validate-pr-template-hygiene.mjs'
]) {
  if (!central.includes(required)) errors.push(`central validation missing ${required}.`);
}
if (
  projectionCases.schema_version !== 1
  || !Array.isArray(projectionCases.cases)
  || projectionCases.cases.length !== 20
  || unique(projectionCases.cases.map((item) => item.case_id)).length !== 20
) errors.push('projection registry must contain 20 unique cases.');
if (
  progressCases.schema_version !== 1
  || !Array.isArray(progressCases.cases)
  || progressCases.cases.length < 8
) errors.push('progress evidence mutation coverage is incomplete.');
if (
  templateCases.schema_version !== 1
  || !Array.isArray(templateCases.cases)
  || templateCases.cases.length < 6
) errors.push('pull request template hygiene coverage is incomplete.');

for (const artifact of plan.completion_evidence?.required_artifacts || []) {
  if (!fs.existsSync(artifact)) errors.push(`missing artifact: ${artifact}.`);
}
if (errors.length) {
  printFailure('Governance authority validation failed:', errors);
  process.exit(1);
}
console.log('Governance authority validation passed.');
console.log(`scope_revision=${scopeRevision}`);
console.log(`merge_commit=${mergeCommit}`);
console.log(`reviewed_head=${reviewedHead}`);
console.log('pr_55_post_merge_verification=REPOSITORY_CONFIRMED');
console.log('closure_exact_head_ci=EXTERNAL_EXACT_HEAD_CI_PENDING');
console.log('fresh_pr_inspector_rereview=required');
console.log(`immutable_inspector_commit=${inspectorCommit}`);
console.log('official_projection=project_decision');
console.log('official_completion=verify_completed_review');
console.log('official_provenance=verify_review_directory');
console.log('local_projection_replica=removed');
console.log('local_evidence_id_replica=removed');
console.log('github_source_live_green=fail_closed');
console.log(`enforcement_status=${enforcementStatus}`);
