#!/usr/bin/env node
import fs from 'node:fs';
import {
  findForbiddenKeys, printFailure, readJson, readText, readYaml,
  setEquals, unique, validateSchema
} from './governance-lib.mjs';

const errors = [];
const specs = [
  ['policy','governance/AI_AUTHORITY_POLICY.yml','governance/schemas/ai-authority-policy.schema.json'],
  ['memory','planning/CAPABILITY_MEMORY.yml','governance/schemas/capability-memory.schema.json'],
  ['plan','planning/GOVERNANCE_ADOPTION_PLAN.yml','governance/schemas/governance-adoption-plan.schema.json'],
  ['lifecycle','governance/REVIEW_LIFECYCLE.yml','governance/schemas/review-lifecycle.schema.json']
];
const loaded = {};
for (const [name,statePath,schemaPath] of specs) {
  const state = readYaml(statePath);
  loaded[name] = state;
  for (const error of validateSchema(readJson(schemaPath), state)) errors.push(`${name}: ${error}`);
}
const {policy,memory,plan,lifecycle} = loaded;
const receiptSchema = readJson('governance/schemas/review-receipt.schema.json');
const authorityLock = readJson('governance/external-authorities/project-gate-authority.v1.json');
const scenario = readJson('tests/governance/scenario-base.json');
const authorityFixture = readJson('tests/governance/invalid/authority_failures.json');
const projectionCases = readJson('tests/governance/pr-inspector-projection-cases.json');
const progressCases = readJson('tests/governance/progress-evidence-cases.json');
const templateCases = readJson('tests/governance/pr-template-hygiene-cases.json');

const repository = 'rezahh107/EV4-Builder-Assistant-Repo';
const repositoryId = 1282136475;
const inspectorRepository = 'rezahh107/PR-Inspector';
const inspectorRepositoryId = 1288323264;
const inspectorCommit = '273ba7d4a6930015eb07c32c5de7210fa4692b1c';
const inspectorProtocol = 'v1.11.1';
const projectGateRepository = 'rezahh107/EV4-Project-Gate';
const projectGateRepositoryId = 1286355650;
const projectGateCommit = 'd0d90165980c087b6e9b3d7af0aac7933fe22ec9';
const previousHead = '7b7272e08da8dfebb5dbaa15a821d67783173bed';
const scopeRevision = 'GOV-004-v9';
const previousScopeRevision = 'GOV-004-v8';
const implementationContext = 'builder-project-gate-governance-enforcement-repair';
const requiredWorkflows = ['Schema validation','Verify Project Gate Contract Pin','Verify Governance Exact-Head Evidence'];
const enforcementStatus = 'mixed_sequence_ci_and_fail_closed_validator_backed';
const governanceMergeCommit = '65450bc5a4d19edf66098669a6fd48bdcda3ed70';
const governanceReviewedHead = '064805f59762e191ae386423b07d73bcf5cae7be';
const policyStatus = 'deterministic_enforcement_implemented_on_main_external_exact_head_evidence_repair_pending';

for (const [label,actual] of [
  ['policy repository',policy.repository_identity?.repository],
  ['memory repository',memory.repository],
  ['plan repository',plan.plan_identity?.target_repository],
  ['scope repository',plan.scope_projection?.project],
  ['lifecycle repository',lifecycle.repository]
]) if (actual !== repository) errors.push(`${label}: received ${actual}.`);

if (memory.source_commit !== previousHead || plan.repository_state?.current_source_commit !== previousHead || plan.scope_projection?.source_commit !== previousHead) errors.push('v9 repair source head identity is invalid.');
if (policy.policy_version !== 6 || policy.status !== policyStatus || policy.repository_identity?.foundation_source_commit !== governanceMergeCommit) errors.push('policy repair identity is invalid.');
const verifiedMerge = plan.repository_state?.verified_current_increment_merge || {};
if (verifiedMerge.increment_id !== 'GOV-003-004-COMPLETE-GOVERNANCE-ENFORCEMENT' || verifiedMerge.pr !== 55 || verifiedMerge.reviewed_head_sha !== governanceReviewedHead || verifiedMerge.merge_commit !== governanceMergeCommit || verifiedMerge.reviewed_head_tree_preserved !== true || verifiedMerge.additional_file_changes_in_merge_commit !== 0 || verifiedMerge.state !== 'merged_and_repository_content_verified' || verifiedMerge.evidence_state !== 'REPOSITORY_CONFIRMED') errors.push('verified PR 55 merge evidence is invalid.');
if (memory.scope_revision !== scopeRevision || plan.current_increment?.scope_revision !== scopeRevision || plan.scope_projection?.scope_revision !== scopeRevision || plan.scope_change_disclosure?.to_scope_revision !== scopeRevision) errors.push(`scope revisions must equal ${scopeRevision}.`);
if (plan.previous_scope_snapshot?.scope_revision !== previousScopeRevision || plan.previous_scope_snapshot?.source_commit !== previousHead) errors.push('previous v8 scope identity is invalid.');
if (plan.scope_change_disclosure?.from_scope_revision !== previousScopeRevision || plan.scope_change_disclosure?.revision_reason !== 'live_inspector_external_authority_and_required_check_enforcement') errors.push('v8 to v9 disclosure is invalid.');
if ((plan.scope_change_disclosure?.lifecycle_changes || []).length || (plan.scope_change_disclosure?.deleted_target_ids || []).length || (plan.scope_change_disclosure?.newly_introduced_target_ids || []).length) errors.push('v9 repair must not mutate capability lifecycle or target identity.');
if (plan.current_increment?.implementation_context_id !== implementationContext) errors.push('v9 implementation context is invalid.');

const capabilities = memory.capabilities || [];
const ids = capabilities.map(item => item.capability_id);
if (unique(ids).length !== ids.length) errors.push('capability IDs must be unique.');
if (!setEquals(ids, plan.scope_projection?.long_term_target_ids || [])) errors.push('scope target IDs must equal capability memory IDs.');
const byId = Object.fromEntries(capabilities.map(item => [item.capability_id,item]));
const expectedLifecycle = {
  'GOV-CAP-001':'implemented','GOV-CAP-002':'implemented','GOV-CAP-003':'implemented','GOV-CAP-004':'implemented','GOV-CAP-005':'implemented',
  'PROD-CAP-001':'deferred_not_deleted','PROD-CAP-002':'deferred_not_deleted','PROD-CAP-003':'deferred_not_deleted','PROD-CAP-004':'deferred_not_deleted','PROD-CAP-005':'implemented_elsewhere'
};
for (const [id,state] of Object.entries(expectedLifecycle)) if (byId[id]?.lifecycle !== state) errors.push(`${id}: expected ${state}.`);
if (byId['PROD-CAP-003']?.name !== 'builder_local_project_gate_runtime_integration') errors.push('PROD-CAP-003 identity mismatch.');
if (byId['PROD-CAP-005']?.name !== 'external_project_gate_ce_to_builder_orchestration') errors.push('PROD-CAP-005 identity mismatch.');
if (!setEquals(memory.implemented_elsewhere_ids || [], ['PROD-CAP-005']) || !setEquals(plan.scope_projection?.implemented_elsewhere_ids || [], ['PROD-CAP-005'])) errors.push('implemented_elsewhere set mismatch.');
if (!setEquals(plan.scope_projection?.deferred_not_deleted_ids || [], ['PROD-CAP-001','PROD-CAP-002','PROD-CAP-003','PROD-CAP-004'])) errors.push('deferred set mismatch.');
if (!setEquals(plan.scope_projection?.excluded_now_ids || [], ['PROD-CAP-001','PROD-CAP-002','PROD-CAP-003','PROD-CAP-004','PROD-CAP-005'])) errors.push('excluded set mismatch.');
const implementedIds = ids.filter(id => byId[id]?.lifecycle === 'implemented');
const committedIds = ids.filter(id => byId[id]?.lifecycle === 'committed_now');
const deferredIds = ids.filter(id => byId[id]?.lifecycle === 'deferred_not_deleted');
const implementedElsewhereIds = ids.filter(id => byId[id]?.lifecycle === 'implemented_elsewhere');
if (!setEquals(plan.scope_projection?.implemented_ids || [], implementedIds)) errors.push('implemented set mismatch.');
if (!setEquals(plan.scope_projection?.committed_now_ids || [], committedIds)) errors.push('committed set mismatch.');
if (!setEquals(plan.scope_projection?.deferred_not_deleted_ids || [], deferredIds)) errors.push('deferred set mismatch from capability memory.');
if (!setEquals(plan.scope_projection?.implemented_elsewhere_ids || [], implementedElsewhereIds)) errors.push('implemented_elsewhere set mismatch from capability memory.');
if ((memory.rejected_ids || []).length || (memory.superseded_ids || []).length || (plan.scope_projection?.rejected_ids || []).length || (plan.scope_projection?.superseded_ids || []).length) errors.push('rejected or superseded set unexpectedly populated.');
const counts = plan.scope_change_disclosure?.set_counts || {};
for (const [name,expected] of Object.entries({target:10,implemented:5,committed:0,deferred:4,implemented_elsewhere:1,excluded:5,rejected:0,superseded:0})) if (counts[name] !== expected) errors.push(`scope count ${name} mismatch.`);

if (authorityLock.schema_version !== 1 || authorityLock.authority_id !== 'ev4-project-gate-ce-to-builder-authority-v1') errors.push('Project Gate authority lock identity invalid.');
if (authorityLock.repository !== projectGateRepository || authorityLock.repository_id !== projectGateRepositoryId || authorityLock.commit_sha !== projectGateCommit) errors.push('Project Gate repository or commit lock mismatch.');
if (authorityLock.commit_api_url !== `https://api.github.com/repos/${projectGateRepository}/commits/${projectGateCommit}` || authorityLock.commit_html_url !== `https://github.com/${projectGateRepository}/commit/${projectGateCommit}`) errors.push('Project Gate commit URL lock mismatch.');
const expectedExternalFiles = {
  'src/ev4_transition/data/capability-status.v1.json':'babaa185193bb9213649c07824a08662955a31f5',
  'docs/IMPLEMENTATION_STATUS.yaml':'4b2c81499c0cde17c1413f59bed6c959564cb6e9',
  'docs/PG_C2B_OPERATOR_WORKFLOW.md':'9fa5c639e63515ad9b98ef13b524ac91c3646cc6'
};
if (!setEquals((authorityLock.files || []).map(item => item.path), Object.keys(expectedExternalFiles))) errors.push('Project Gate authority file set mismatch.');
for (const item of authorityLock.files || []) {
  if (item.blob_sha !== expectedExternalFiles[item.path]) errors.push(`Project Gate authority blob mismatch: ${item.path}`);
  if (!(item.required_utf8_substrings || []).length) errors.push(`Project Gate semantic requirements missing: ${item.path}`);
}
const prod5Authorities = byId['PROD-CAP-005']?.authority || [];
if (!prod5Authorities.includes('governance/external-authorities/project-gate-authority.v1.json')) errors.push('PROD-CAP-005 must depend on the external authority lock.');
for (const externalPath of Object.keys(expectedExternalFiles)) if (!prod5Authorities.includes(`${projectGateRepository}@${projectGateCommit}:${externalPath}`)) errors.push(`PROD-CAP-005 missing external path: ${externalPath}`);
if (plan.repository_state?.exact_head_ci_mechanism?.external_project_gate_authority_lock !== 'governance/external-authorities/project-gate-authority.v1.json') errors.push('adoption plan external authority lock mismatch.');
if (plan.repository_state?.exact_head_ci_mechanism?.external_project_gate_evidence?.repository_id !== projectGateRepositoryId || plan.repository_state?.exact_head_ci_mechanism?.external_project_gate_evidence?.commit_sha !== projectGateCommit) errors.push('adoption plan Project Gate API identity mismatch.');

const inspector = lifecycle.canonical_pr_inspector_authority || {};
if (lifecycle.protocol_version !== 6) errors.push('review lifecycle protocol_version must equal 6.');
for (const [field,expected] of Object.entries({repository:inspectorRepository,repository_id:inspectorRepositoryId,active_protocol_version:inspectorProtocol,immutable_commit_sha:inspectorCommit,official_projection_function:'pr_inspector.decision_projection.project_decision',official_completion_boundary:'pr_inspector.official_review.verify_completed_review',official_synthetic_boundary:'pr_inspector.review_provenance.verify_review_directory',official_regression_test:'scripts/test-pr-inspector-official-integration-v1-11-1.py',external_retrievable_accessor_available:false,external_bundle_locator:'unavailable'})) if (inspector[field] !== expected) errors.push(`canonical inspector ${field} mismatch.`);
if (!setEquals(inspector.official_provenance_functions || [], ['pr_inspector.review_provenance.verify_github_commit_payload','pr_inspector.review_provenance.verify_review_directory','pr_inspector.review_provenance.event_evidence_fields'])) errors.push('official provenance function set mismatch.');
const live = lifecycle.live_receipt_validation || {};
if (live.github_source_command !== 'node scripts/validate-governance-sequence.mjs --mode=live --source=github' || live.official_synthetic_test_command !== 'python scripts/test-pr-inspector-official-integration-v1-11-1.py' || live.required_check_run_binding_command !== 'node scripts/validate-governance-sequence.mjs --mode=run-bindings' || live.activation_state !== 'official_external_bundle_accessor_unavailable_fail_closed' || live.external_official_bundle_accessor_available !== false || live.technical_status_authority !== 'immutable_pr_inspector_project_decision' || live.provenance_authority !== 'immutable_pr_inspector_review_provenance' || live.authoritative_api_origin !== 'https://api.github.com' || live.caller_controlled_api_origin_allowed !== false || live.redirects_allowed !== false || (live.required_token_permissions || []).length) errors.push('live fail-closed review boundary mismatch.');
if (receiptSchema.properties?.scope_revision?.const !== scopeRevision || receiptSchema.properties?.implementation_context_id?.const !== implementationContext) errors.push('receipt scope/context binding mismatch.');
if (receiptSchema.properties?.inspector_commit_sha?.const !== inspectorCommit || receiptSchema.properties?.protocol_version?.const !== inspectorProtocol || receiptSchema.properties?.inspector_repository_id?.const !== inspectorRepositoryId) errors.push('receipt live inspector identity mismatch.');
if (receiptSchema.properties?.exact_head_ci_run_ids?.minItems !== 3 || receiptSchema.properties?.exact_head_ci_run_ids?.maxItems !== 3 || receiptSchema.properties?.exact_head_ci_runs?.minItems !== 3 || receiptSchema.properties?.exact_head_ci_runs?.maxItems !== 3) errors.push('receipt must require exactly three run IDs and run bindings.');
const receiptFields = ['repository','pull_request','base_sha','reviewed_head_sha','scope_revision','implementation_context_id','exact_head_ci_run_ids','exact_head_ci_runs','reviewed_at','inspector_repository','inspector_repository_id','inspector_commit_sha','inspector_commit_api_url','inspector_commit_html_url','inspector_evidence_source','protocol_version','review_evidence_id','review_package_canonical_sha256','review_package_file_sha256','decision_projection_sha256','artifact_manifest_sha256','review_validity','technical_status','approval_requirement','next_action_kind'];
if (!setEquals(lifecycle.required_receipt_fields || [], receiptFields) || !setEquals(receiptSchema.required || [], receiptFields)) errors.push('receipt required fields mismatch.');
for (const forbidden of ['reviewer_actor_login','reviewer_context_id','independent','findings']) if (receiptSchema.properties?.[forbidden] !== undefined) errors.push(`receipt schema must not authorize ${forbidden}.`);

const checks = lifecycle.required_check_set?.checks || [];
if (lifecycle.required_check_set?.version !== 2 || checks.length !== 3 || !setEquals(checks.map(item => item.workflow_name), requiredWorkflows)) errors.push('canonical required workflow set must contain exactly three workflows.');
if (!setEquals(checks.map(item => item.check_id), ['implementation_validation','project_gate_pin','governance_exact_head_evidence'])) errors.push('canonical required check IDs mismatch.');
for (const check of checks) if (check.event !== 'pull_request' || check.producer_repository !== repository || check.producer_repository_id !== repositoryId || check.head_binding !== 'reviewed_head_sha' || check.run_identity_source !== 'github_actions_api') errors.push(`required check producer/head binding mismatch: ${check.workflow_name}`);
if (!setEquals(plan.repository_state?.exact_head_ci_mechanism?.required_workflows || [], requiredWorkflows) || plan.repository_state?.exact_head_ci_mechanism?.required_check_set_version !== 2) errors.push('adoption plan required check set mismatch.');
const mechanism = plan.repository_state?.exact_head_ci_mechanism || {};
if (mechanism.workflow !== '.github/workflows/schema-validation.yml' || mechanism.project_gate_workflow !== '.github/workflows/project-gate-contract-pin.yml' || mechanism.external_evidence_workflow !== '.github/workflows/governance-exact-head-evidence.yml' || mechanism.external_evidence_validator !== 'scripts/validate-governance-progress-evidence.mjs' || mechanism.repository_authored_confirmation_allowed !== false || mechanism.immutable_pr_inspector_checkout !== inspectorCommit || mechanism.active_pr_inspector_protocol !== inspectorProtocol) errors.push('exact-head mechanism identity mismatch.');
if (plan.completion_evidence?.exact_head_ci_required !== true || plan.completion_evidence?.external_exact_head_evidence_required !== true || plan.completion_evidence?.external_project_gate_authority_evidence_required !== true || plan.completion_evidence?.independent_review_required !== true || plan.completion_evidence?.user_merge_required !== true || plan.completion_evidence?.post_merge_verification_required !== true) errors.push('completion evidence requirements are incomplete.');
const postMerge = plan.completion_evidence?.post_merge_verification || {};
if (postMerge.merge_commit !== governanceMergeCommit || postMerge.reviewed_head_sha !== governanceReviewedHead || postMerge.live_default_branch !== 'main' || postMerge.reviewed_head_tree_preserved !== true || postMerge.additional_file_changes_in_merge_commit !== 0 || postMerge.evidence_state !== 'REPOSITORY_CONFIRMED') errors.push('PR 55 post-merge verification evidence is invalid.');

if (scenario.previous?.scope_revision !== previousScopeRevision || scenario.previous?.head_sha !== previousHead || scenario.current?.scope_revision !== scopeRevision || scenario.review_receipt?.scope_revision !== scopeRevision || scenario.review_receipt?.implementation_context_id !== implementationContext) errors.push('scenario scope binding mismatch.');
if (!setEquals(scenario.current?.required_check_set || [], requiredWorkflows) || !setEquals(Object.keys(scenario.ci?.required_checks || {}), requiredWorkflows)) errors.push('scenario required check set mismatch.');
if (!setEquals(scenario.review_receipt?.exact_head_ci_run_ids || [], [5001,5002,5003]) || !setEquals((scenario.review_receipt?.exact_head_ci_runs || []).map(item => item.run_id), [5001,5002,5003])) errors.push('scenario run ID binding mismatch.');
if (scenario.review_receipt?.inspector_commit_sha !== inspectorCommit || scenario.review_receipt?.protocol_version !== inspectorProtocol) errors.push('scenario inspector identity mismatch.');
for (const run of scenario.review_receipt?.exact_head_ci_runs || []) {
  if (run.producer_repository !== repository || run.producer_repository_id !== repositoryId || run.pull_request !== 59 || run.head_sha !== scenario.current?.head_sha || run.event !== 'pull_request' || run.status !== 'completed' || run.conclusion !== 'success') errors.push(`scenario run producer/head/status mismatch: ${run.workflow_name}`);
  if (run.run_api_url !== `https://api.github.com/repos/${repository}/actions/runs/${run.run_id}`) errors.push(`scenario run API URL mismatch: ${run.workflow_name}`);
}

const expectedEnforcement = {
  'AIGOV-START-001':'validator_backed','AIGOV-SCOPE-001':'sequence_ci_enforced','AIGOV-SCOPE-DISCLOSURE-001':'sequence_ci_enforced','AIGOV-PROGRESS-001':'sequence_ci_enforced','AIGOV-EVIDENCE-001':'ci_enforced','AIGOV-INDEPENDENCE-001':'fail_closed_validator_backed','AIGOV-STALE-001':'fail_closed_validator_backed','AIGOV-MERGE-001':'fail_closed_validator_backed','AIGOV-SECURITY-PROFILE-001':'validator_backed','AIGOV-HUMAN-001':'validator_backed','AIGOV-COACH-001':'validator_backed'
};
for (const [id,expected] of Object.entries(expectedEnforcement)) {
  if (policy.current_enforcement?.[id] !== expected) errors.push(`${id}: enforcement mismatch.`);
  const rule = policy.rules?.[id];
  for (const field of ['risk','session_scope','trigger','predicate','enforcement','recovery_action']) if (rule?.[field] === undefined || rule?.[field] === null) errors.push(`${id}: missing ${field}.`);
}
const expectedGreen = {exact_head_matches_receipt:true,scope_revision_matches_receipt:true,independent_reviewer:true,all_required_exact_head_checks_success:true,unresolved_blocking_findings:false,scope_change_disclosure_valid:true,prohibited_human_technical_gate_absent:true,security_profile_valid:true,completion_evidence_complete:true};
for (const [key,expected] of Object.entries(expectedGreen)) if (lifecycle.green_merge_predicates?.[key] !== expected) errors.push(`Green predicate ${key} mismatch.`);
for (const item of authorityFixture.green_merge_predicate_cases || []) {
  const value = {...lifecycle.green_merge_predicates,...(item.overrides || {})};
  if (Object.entries(expectedGreen).every(([key,expected]) => value[key] === expected)) errors.push(`authority fixture ${item.case_id} unexpectedly passed.`);
}
const forbiddenFields = ['human_technical_approval','owner_technical_signoff','owner_scope_acknowledgement','human_review_required','specialist_signoff'];
for (const [name,state] of Object.entries(loaded)) for (const finding of findForbiddenKeys(state,forbiddenFields)) errors.push(`${name}: prohibited human technical gate at ${finding}.`);
const controls = policy.security_profile?.mandatory_minimum_controls || [];
for (const control of ['no_secrets_credentials_tokens_passwords_or_private_keys','destructive_action_requires_exact_target_scope_and_recovery_path','missing_access_identity_or_evidence_must_fail_closed']) if (!controls.includes(control)) errors.push(`missing control: ${control}.`);
const requiredNonClaims = ['automatic_premerge_live_receipt_ci_enforced','official_remote_review_bundle_accessor_available','canonical_pr_inspector_bundle_live_verified','independent_review_live_enforced','merge_recommendation_live_enforced','target_repository_independently_implements_pr_inspector_projection','target_repository_independently_implements_review_provenance'];
for (const value of requiredNonClaims) {
  if (!policy.non_claims?.includes(value)) errors.push(`policy non-claim missing: ${value}.`);
  if (!plan.prohibited_claims?.includes(value)) errors.push(`plan prohibited claim missing: ${value}.`);
}
for (const value of ['repository_authored_exact_head_ci_confirmation','builder_local_project_gate_runtime_implemented','project_gate_receipt_is_builder_semantic_input','project_gate_replaces_builder_contracts','real_non_synthetic_ce_to_builder_handoff_proven']) if (!plan.prohibited_claims?.includes(value)) errors.push(`plan prohibited claim missing: ${value}.`);
if (lifecycle.current_enforcement_status !== enforcementStatus || memory.current_enforcement_status !== enforcementStatus || plan.current_enforcement_status !== enforcementStatus) errors.push('enforcement status mismatch.');

const carrierText = {'README.md':readText('README.md'),'STATUS.md':readText('STATUS.md'),'AGENTS.md':readText('AGENTS.md'),'planning/CAPABILITY_MEMORY.yml':readText('planning/CAPABILITY_MEMORY.yml')};
const invalidPatterns = new Map([
  ['The Project Gate program is not implemented.','PG-AUTH-001_EXTERNAL_CAPABILITY_DENIED'],
  ['The external Project Gate verifier remains future work.','PG-AUTH-002_EXTERNAL_VERIFIER_FUTURE_ONLY'],
  ['project_gate_runtime: implemented','PG-AUTH-003_EXTERNAL_LOCAL_CONFLATION'],
  ['name: project_gate_verifier_and_runtime','PG-AUTH-004_AMBIGUOUS_CAPABILITY_IDENTITY'],
  ['real_non_synthetic_ce_to_builder_handoff: proven','PG-AUTH-005_REAL_HANDOFF_OVERCLAIM'],
  ['production_ready: true','PG-AUTH-006_PRODUCTION_READY_OVERCLAIM'],
  ['Project Gate replaces Builder contracts.','PG-AUTH-007_BUILDER_AUTHORITY_REPLACED'],
  ['project_gate_receipt_is_builder_semantic_input: true','PG-AUTH-008_RECEIPT_INPUT_CONFLATION'],
  ['direct_controlled_ce_to_builder_path: unsupported','PG-AUTH-009_DIRECT_CONTROLLED_PATH_REMOVED']
]);
for (const item of authorityFixture.project_gate_authority_cases || []) if (invalidPatterns.get(item.text) !== item.expected_diagnostic) errors.push(`authority mutation fixture ${item.case_id} is not recognized deterministically.`);
for (const [text,diagnostic] of invalidPatterns) for (const [carrierPath,content] of Object.entries(carrierText)) if (content.includes(text)) errors.push(`${diagnostic}:${carrierPath}`);
for (const snippet of ['ai_governance_scope_revision: GOV-004-v9','ai_governance_pr_inspector_protocol: v1.11.1','ai_governance_required_check_set: three_exact_head_workflows','project_gate_external_authority_evidence: github_api_commit_blob_verified_on_ci']) if (!carrierText['STATUS.md'].includes(snippet)) errors.push(`STATUS.md missing: ${snippet}`);

const schemaWorkflow = readText('.github/workflows/schema-validation.yml');
for (const required of [inspectorCommit,'v1.11.1','repository: rezahh107/PR-Inspector','persist-credentials: false','fetch-depth: 1','scripts/test-pr-inspector-official-integration-v1-11-1.py','scripts/verify-pr-inspector-bundle.py','GOV-LIVE-030_OFFICIAL_BUNDLE_ACCESSOR_UNAVAILABLE','GOV-LIVE-049_LOCAL_CANONICAL_BUNDLE_ACCEPTANCE_REMOVED']) if (!schemaWorkflow.includes(required)) errors.push(`schema workflow missing ${required}.`);
for (const stale of ['88e8610bcc2ada48c8cf902d23d4296983310872','v1.10.0']) if (schemaWorkflow.includes(stale)) errors.push(`schema workflow retains stale inspector identity: ${stale}`);
const evidenceWorkflow = readText('.github/workflows/governance-exact-head-evidence.yml');
for (const required of ['name: Verify Governance Exact-Head Evidence','actions: read','pull-requests: read','Schema validation','Verify Project Gate Contract Pin','governance/external-authorities/project-gate-authority.v1.json','repository_id','commit_api_url','blob_sha','git_blob_sha','semantic_substrings_verified','scripts/validate-governance-progress-evidence.mjs','persist-credentials: false']) if (!evidenceWorkflow.includes(required)) errors.push(`external evidence workflow missing ${required}.`);
const central = readText('scripts/validate.mjs');
for (const required of ['scripts/validate-governance-progress-evidence.mjs','scripts/validate-pr-template-hygiene.mjs','scripts/validate-governance-authorities.mjs','scripts/validate-governance-sequence.mjs']) if (!central.includes(required)) errors.push(`central validation missing ${required}.`);
const progressSource = readText('scripts/validate-governance-progress-evidence.mjs');
for (const required of ['PG-AUTH-EVIDENCE-003_REPOSITORY_ID_MISMATCH','PG-AUTH-EVIDENCE-005_COMMIT_MISMATCH','PG-AUTH-EVIDENCE-011_BLOB_MISMATCH','PG-AUTH-EVIDENCE-014_SEMANTIC_CONTENT_NOT_VERIFIED']) if (!progressSource.includes(required)) errors.push(`progress validator missing ${required}.`);
const sequenceSource = readText('scripts/validate-governance-sequence.mjs');
for (const required of ['GOV-SEQ-030_RUN_ID_BINDING_MISMATCH','GOV-SEQ-031_REQUIRED_WORKFLOW_RUN_SET_MISMATCH','GOV-SEQ-032_RUN_HEAD_MISMATCH_OR_STALE','GOV-SEQ-033_RUN_PRODUCER_IDENTITY_MISMATCH','GOV-SEQ-034_RUN_API_IDENTITY_MISMATCH','PR Inspector v1.11.1']) if (!sequenceSource.includes(required)) errors.push(`sequence validator missing ${required}.`);
for (const forbidden of ['function projectionFromPackage','function canonicalEvidenceId','canonicalJsonBytes','artifact_bytes_base64']) if (sequenceSource.includes(forbidden)) errors.push(`local replica remains: ${forbidden}.`);
const adapter = readText('scripts/verify-pr-inspector-bundle.py');
for (const required of ['from pr_inspector.decision_projection import project_decision','verify_completed_review','verify_github_commit_payload','verify_review_directory','event_evidence_fields']) if (!adapter.includes(required)) errors.push(`adapter missing ${required}.`);
for (const forbidden of ['def canonical_evidence_id','def projection_from_package','def collect_reason_instances']) if (adapter.includes(forbidden)) errors.push(`adapter replica: ${forbidden}.`);

if (projectionCases.schema_version !== 1 || !Array.isArray(projectionCases.cases) || projectionCases.cases.length !== 20 || unique(projectionCases.cases.map(item => item.case_id)).length !== 20) errors.push('projection registry must contain 20 unique cases.');
if (progressCases.schema_version !== 2 || !Array.isArray(progressCases.cases) || progressCases.cases.length < 10) errors.push('progress evidence mutation coverage is incomplete.');
if (templateCases.schema_version !== 1 || !Array.isArray(templateCases.cases) || templateCases.cases.length < 6) errors.push('pull request template hygiene coverage is incomplete.');
for (const artifact of plan.completion_evidence?.required_artifacts || []) if (!fs.existsSync(artifact)) errors.push(`missing artifact: ${artifact}.`);

const progress = plan.progress_gate || {};
if (plan.current_increment?.implementation_status !== 'implemented_on_branch_pending_external_exact_head_ci_and_fresh_rereview' || progress.implementation_status !== 'implemented_on_branch_pending_external_exact_head_ci_and_fresh_rereview' || progress.required_artifacts_verified_on_live_default_branch !== false || progress.validator_result !== 'EXTERNAL_EXACT_HEAD_CI_PENDING' || progress.ci_result !== 'EXTERNAL_EXACT_HEAD_CI_PENDING' || progress.independent_review_result !== 'FRESH_PR_INSPECTOR_REREVIEW_REQUIRED' || progress.post_merge_verification_result !== 'GOV_004_V9_NOT_MERGED') errors.push('v9 progress state must remain pending.');
if (Object.prototype.hasOwnProperty.call(progress,'exact_head_ci_run_ids') || progress.validator_result === 'CI_CONFIRMED_FOR_REVIEWED_HEAD') errors.push('repository-authored CI confirmation forbidden.');
if (!setEquals(progress.open_gates || [], ['external_exact_head_ci_evidence','external_project_gate_authority_evidence','fresh_pr_inspector_rereview','official_external_pr_inspector_bundle_accessor','historical_independent_review_evidence_gap','authority_reconciliation_pr_merge','gov_004_v9_post_merge_verification'])) errors.push('remaining v9 gates mismatch.');

if (errors.length) {
  printFailure('Governance authority validation failed:', errors);
  process.exit(1);
}
console.log('Governance authority validation passed.');
console.log(`scope_revision=${scopeRevision}`);
console.log(`inspector_protocol=${inspectorProtocol}`);
console.log(`immutable_inspector_commit=${inspectorCommit}`);
console.log('required_workflows=Schema validation,Verify Project Gate Contract Pin,Verify Governance Exact-Head Evidence');
console.log('project_gate_authority=github_api_repository_commit_blob_semantic_evidence');
console.log('run_id_binding=workflow_head_producer_api_identity');
console.log('fresh_pr_inspector_rereview=required');
console.log(`enforcement_status=${enforcementStatus}`);
