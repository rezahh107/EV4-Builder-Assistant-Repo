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
  { name: 'AI authority policy', statePath: 'governance/AI_AUTHORITY_POLICY.yml', schemaPath: 'governance/schemas/ai-authority-policy.schema.json' },
  { name: 'Capability memory', statePath: 'planning/CAPABILITY_MEMORY.yml', schemaPath: 'governance/schemas/capability-memory.schema.json' },
  { name: 'Governance adoption plan', statePath: 'planning/GOVERNANCE_ADOPTION_PLAN.yml', schemaPath: 'governance/schemas/governance-adoption-plan.schema.json' },
  { name: 'Review lifecycle', statePath: 'governance/REVIEW_LIFECYCLE.yml', schemaPath: 'governance/schemas/review-lifecycle.schema.json' }
];

const loaded = {};
const errors = [];
for (const authority of authorities) {
  const state = readYaml(authority.statePath);
  const schema = readJson(authority.schemaPath);
  loaded[authority.statePath] = state;
  for (const error of validateSchema(schema, state)) errors.push(`${authority.name}: ${error}`);
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
]) if (actual !== repository) errors.push(`${label}: expected ${repository}, received ${actual}.`);

const revisions = [memory.scope_revision, plan.current_increment?.scope_revision, plan.scope_projection?.scope_revision, plan.scope_change_disclosure?.to_scope_revision];
if (!revisions.every((revision) => revision === revisions[0])) errors.push(`scope revisions must match: ${JSON.stringify(revisions)}.`);
if (plan.current_increment?.implementation_context_id !== 'repo-maintainer-gov-003-004') errors.push('current_increment.implementation_context_id must identify the implementation context.');

const capabilities = memory.capabilities || [];
const capabilityIds = capabilities.map((item) => item.capability_id);
if (unique(capabilityIds).length !== capabilityIds.length) errors.push('capability IDs must be unique.');
if (!setEquals(capabilityIds, plan.scope_projection?.long_term_target_ids || [])) errors.push('long_term_target_ids must exactly match capability memory IDs.');
const lifecycleById = Object.fromEntries(capabilities.map((item) => [item.capability_id, item.lifecycle]));
const derivedImplemented = capabilityIds.filter((id) => lifecycleById[id] === 'implemented').sort();
const derivedCommitted = capabilityIds.filter((id) => lifecycleById[id] === 'committed_now').sort();
const derivedDeferred = capabilityIds.filter((id) => lifecycleById[id] === 'deferred_not_deleted').sort();
if (!setEquals(derivedImplemented, plan.scope_projection?.implemented_ids || [])) errors.push('implemented_ids must match capability memory lifecycle=implemented.');
if (!setEquals(derivedCommitted, plan.scope_projection?.committed_now_ids || [])) errors.push('committed_now_ids must match capability memory lifecycle=committed_now.');
if (!setEquals(derivedDeferred, plan.scope_projection?.deferred_not_deleted_ids || [])) errors.push('deferred_not_deleted_ids must match capability memory lifecycle=deferred_not_deleted.');
if (!setEquals(plan.scope_projection?.excluded_now_ids || [], derivedDeferred)) errors.push('excluded_now_ids must equal the current deferred_not_deleted capability set.');

for (const [id, expected] of Object.entries({ 'GOV-CAP-001':'implemented','GOV-CAP-002':'implemented','GOV-CAP-003':'committed_now','GOV-CAP-004':'committed_now','GOV-CAP-005':'committed_now' })) {
  if (lifecycleById[id] !== expected) errors.push(`${id}: expected lifecycle ${expected}, received ${lifecycleById[id]}.`);
}
for (const id of ['PROD-CAP-001','PROD-CAP-002','PROD-CAP-003','PROD-CAP-004']) if (lifecycleById[id] !== 'deferred_not_deleted') errors.push(`${id}: product capability must remain deferred_not_deleted.`);
for (const capability of capabilities) {
  if (capability.capability_id.startsWith('GOV-')) {
    if (!Array.isArray(capability.authority) || capability.authority.length === 0) errors.push(`${capability.capability_id}: governance authority must be a non-empty sequence.`);
  } else if (typeof capability.source_authority !== 'string') errors.push(`${capability.capability_id}: product capability must retain source_authority.`);
}

const previous = plan.previous_scope_snapshot?.lifecycle_by_id || {};
const currentIds = new Set(capabilityIds);
const deletedTargets = Object.keys(previous).filter((id) => !currentIds.has(id)).sort();
if (!setEquals(deletedTargets, plan.scope_change_disclosure?.deleted_target_ids || [])) errors.push(`deleted_target_ids disclosure mismatch: computed=${JSON.stringify(deletedTargets)}.`);
if (deletedTargets.length > 0) errors.push(`silent capability deletion is forbidden: ${deletedTargets.join(', ')}.`);
const introducedTargets = capabilityIds.filter((id) => !Object.prototype.hasOwnProperty.call(previous, id)).sort();
if (!setEquals(introducedTargets, plan.scope_change_disclosure?.newly_introduced_target_ids || [])) errors.push(`newly_introduced_target_ids disclosure mismatch: computed=${JSON.stringify(introducedTargets)}.`);
const normalizeChange = (change) => ({ capability_id: change.capability_id ?? null, from: change.from ?? null, to: change.to ?? null });
const computedChanges = capabilityIds.filter((id) => Object.prototype.hasOwnProperty.call(previous,id) && previous[id] !== lifecycleById[id]).map((id) => normalizeChange({capability_id:id,from:previous[id],to:lifecycleById[id]})).sort((a,b)=>(a.capability_id??'').localeCompare(b.capability_id??''));
const disclosedChanges = [...(plan.scope_change_disclosure?.lifecycle_changes || [])].map(normalizeChange).sort((a,b)=>(a.capability_id??'').localeCompare(b.capability_id??''));
if (JSON.stringify(computedChanges) !== JSON.stringify(disclosedChanges)) errors.push(`scope lifecycle disclosure mismatch: computed=${JSON.stringify(computedChanges)} disclosed=${JSON.stringify(disclosedChanges)}.`);
if (plan.scope_change_disclosure?.disclosure_computed_from_capability_ids !== true) errors.push('scope disclosure must state disclosure_computed_from_capability_ids=true.');
if (plan.scope_change_disclosure?.revision_reason !== 'live_review_receipt_validation_and_versioned_required_check_contract') errors.push('scope disclosure must record the GOV-004-v2 revision reason.');

const forbiddenFields = ['human_technical_approval','owner_technical_signoff','owner_scope_acknowledgement','human_review_required','specialist_signoff'];
for (const [filePath,state] of Object.entries(loaded)) for (const finding of findForbiddenKeys(state,forbiddenFields)) errors.push(`${filePath}: prohibited human technical gate field at ${finding}.`);
const publicDisposition = policy.security_profile?.activation_trigger_evaluation?.public_repository?.decision;
if (publicDisposition !== 'retain_minimum_security_with_public_repository_hygiene') errors.push('public repository security trigger requires an explicit minimum-security disposition.');
const controls = policy.security_profile?.mandatory_minimum_controls || [];
for (const requiredControl of ['no_secrets_credentials_tokens_passwords_or_private_keys','destructive_action_requires_exact_target_scope_and_recovery_path','missing_access_identity_or_evidence_must_fail_closed']) if (!controls.includes(requiredControl)) errors.push(`missing mandatory security control: ${requiredControl}.`);

const expectedEnforcement = {
  'AIGOV-START-001':'validator_backed','AIGOV-SCOPE-001':'sequence_ci_enforced','AIGOV-SCOPE-DISCLOSURE-001':'sequence_ci_enforced','AIGOV-PROGRESS-001':'sequence_ci_enforced','AIGOV-EVIDENCE-001':'ci_enforced','AIGOV-INDEPENDENCE-001':'live_validator_backed','AIGOV-STALE-001':'live_validator_backed','AIGOV-MERGE-001':'live_validator_backed','AIGOV-SECURITY-PROFILE-001':'validator_backed','AIGOV-HUMAN-001':'validator_backed','AIGOV-COACH-001':'validator_backed'
};
for (const [ruleId,expected] of Object.entries(expectedEnforcement)) if (policy.current_enforcement?.[ruleId] !== expected) errors.push(`${ruleId}: expected enforcement ${expected}, received ${policy.current_enforcement?.[ruleId]}.`);
const requiredGateFields = ['risk','session_scope','trigger','predicate','enforcement','recovery_action'];
for (const ruleId of Object.keys(expectedEnforcement)) {
  const definition = policy.rules?.[ruleId];
  if (!definition) { errors.push(`${ruleId}: gate definition is missing.`); continue; }
  for (const field of requiredGateFields) if (definition[field] === undefined || definition[field] === null) errors.push(`${ruleId}: gate definition is missing ${field}.`);
  if (!Array.isArray(definition.predicate) || definition.predicate.length < 2) errors.push(`${ruleId}: gate predicate must contain at least two checks.`);
}

const disclosureCounts = plan.scope_change_disclosure?.set_counts || {};
const computedCounts = {target:capabilityIds.length,implemented:derivedImplemented.length,committed:derivedCommitted.length,deferred:derivedDeferred.length,excluded:(plan.scope_projection?.excluded_now_ids||[]).length,rejected:(plan.scope_projection?.rejected_ids||[]).length,superseded:(plan.scope_projection?.superseded_ids||[]).length};
for (const [name,expected] of Object.entries(computedCounts)) if (disclosureCounts[name] !== expected) errors.push(`scope disclosure set_counts.${name}: expected ${expected}, received ${disclosureCounts[name]}.`);
if (plan.scope_change_disclosure?.reviewed_head_binding_required !== true) errors.push('scope disclosure must require exact reviewed-head binding.');
if (plan.scope_change_disclosure?.exact_head_binding_carrier !== 'governance/schemas/review-receipt.schema.json') errors.push('scope disclosure exact-head binding carrier must be the canonical review receipt schema.');
const previousSourceCommit = plan.previous_scope_snapshot?.source_commit;
if (!/^[0-9a-f]{40}$/.test(previousSourceCommit || '')) errors.push('previous_scope_snapshot.source_commit must be an exact commit SHA.');
if (plan.scope_change_disclosure?.source_object_identities?.previous_scope_source_commit !== previousSourceCommit) errors.push('scope disclosure previous source commit identity is missing or mismatched.');
if (plan.scope_change_disclosure?.source_object_identities?.current_scope_source_identity !== 'github_pull_request_head_sha') errors.push('scope disclosure current source identity must be github_pull_request_head_sha.');
if (plan.scope_change_disclosure?.owner_facing_disclosure_rendered !== true) errors.push('owner-facing scope disclosure must be rendered.');

const expectedGreenPredicates = {exact_head_matches_receipt:true,scope_revision_matches_receipt:true,independent_reviewer:true,all_required_exact_head_checks_success:true,unresolved_blocking_findings:false,scope_change_disclosure_valid:true,prohibited_human_technical_gate_absent:true,security_profile_valid:true,completion_evidence_complete:true};
function greenPredicateErrors(predicates) { const findings=[]; for (const [key,expected] of Object.entries(expectedGreenPredicates)) if (predicates?.[key] !== expected) findings.push(`GOV-AUTH-001_GREEN_PREDICATE_VALUE:${key}:expected=${expected}:received=${predicates?.[key]}`); return findings; }
errors.push(...greenPredicateErrors(lifecycle.green_merge_predicates));
const authorityFixturePath='tests/governance/invalid/authority_failures.json';
if (fs.existsSync(authorityFixturePath)) {
  const fixture=readJson(authorityFixturePath);
  for (const entry of fixture.green_merge_predicate_cases || []) {
    const diagnostics=greenPredicateErrors({...lifecycle.green_merge_predicates,...(entry.overrides||{})});
    for (const expected of entry.expected_diagnostics || []) if (!diagnostics.some((diagnostic)=>diagnostic===expected||diagnostic.startsWith(`${expected}:`))) errors.push(`${authorityFixturePath}:${entry.case_id}: missing expected diagnostic ${expected}; got ${JSON.stringify(diagnostics)}.`);
    if (diagnostics.length===0) errors.push(`${authorityFixturePath}:${entry.case_id}: invalid Green predicate fixture unexpectedly passed.`);
  }
}

const expectedChecks=[{check_id:'implementation_validation',workflow_name:'Schema validation',event:'pull_request'},{check_id:'project_gate_pin',workflow_name:'Verify Project Gate Contract Pin',event:'pull_request'}].sort((a,b)=>a.check_id.localeCompare(b.check_id));
const actualChecks=[...(lifecycle.required_check_set?.checks||[])].map((item)=>({check_id:item.check_id,workflow_name:item.workflow_name,event:item.event})).sort((a,b)=>(a.check_id||'').localeCompare(b.check_id||''));
if (lifecycle.required_check_set?.version !== 1 || JSON.stringify(actualChecks)!==JSON.stringify(expectedChecks)) errors.push('review lifecycle required_check_set must match the explicit versioned canonical workflow set.');
if (!setEquals(lifecycle.receipt_transport||[],['pull_request_review','pull_request_comment'])) errors.push('review lifecycle receipt_transport must contain only supported non-head-mutating transports.');
if (!setEquals(lifecycle.live_receipt_validation?.supported_transports||[],lifecycle.receipt_transport||[])) errors.push('live receipt supported transports must match the canonical receipt transports.');
if (lifecycle.live_receipt_validation?.mode !== 'github_api_read_only_operator_invoked') errors.push('live receipt validation mode must be github_api_read_only_operator_invoked.');
if (lifecycle.live_receipt_validation?.marker !== 'AI_GOVERNANCE_REVIEW_RECEIPT') errors.push('live receipt validation marker is missing or mismatched.');
if (lifecycle.live_receipt_validation?.command !== 'node scripts/validate-governance-sequence.mjs --mode=live --source=github') errors.push('live receipt validation command must use the canonical operator-invoked validator path.');
if (lifecycle.live_receipt_validation?.activation_state !== 'premerge_operator_invoked_default_branch_workflow_not_claimed') errors.push('live receipt validation activation state must explicitly avoid an unsupported pre-merge workflow claim.');
if (!setEquals(lifecycle.live_receipt_validation?.required_token_permissions||[],['actions_read','contents_read','issues_read','pull_requests_read'])) errors.push('live receipt validation token permissions must remain the bounded read-only set.');
if (lifecycle.current_enforcement_status !== 'mixed_sequence_ci_and_live_validator_backed') errors.push('review lifecycle current_enforcement_status must match the mixed executable evidence level.');
if (memory.current_enforcement_status !== 'mixed_sequence_ci_and_live_validator_backed' || plan.current_enforcement_status !== 'mixed_sequence_ci_and_live_validator_backed') errors.push('capability memory and adoption plan must use the mixed executable evidence status.');
if (!policy.non_claims?.includes('automatic_premerge_live_receipt_ci_enforced') || !plan.prohibited_claims?.includes('automatic_premerge_live_receipt_ci_enforced')) errors.push('unsupported automatic pre-merge receipt CI enforcement must be an explicit non-claim.');

for (const artifact of plan.completion_evidence?.required_artifacts || []) if (!fs.existsSync(artifact)) errors.push(`required governance artifact is missing: ${artifact}.`);
if (errors.length>0) { printFailure('Governance authority validation failed:',errors); process.exit(1); }
console.log('Governance authority validation passed.');
console.log(`scope_revision=${revisions[0]}`);
console.log(`capabilities=${capabilityIds.length}`);
console.log(`lifecycle_changes=${computedChanges.length}`);
console.log(`required_check_set_version=${lifecycle.required_check_set.version}`);
console.log('live_receipt_validation=github_api_read_only_operator_invoked');
