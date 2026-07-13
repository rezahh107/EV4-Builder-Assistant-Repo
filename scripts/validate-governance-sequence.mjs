#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  parseYamlSubset, printFailure, readJson, readYaml,
  setDifference, setEquals, unique, validateSchema
} from './governance-lib.mjs';

const RECEIPT_SCHEMA = readJson('governance/schemas/review-receipt.schema.json');
const BASE_SCENARIO = readJson('tests/governance/scenario-base.json');
const REVIEW_LIFECYCLE = readYaml('governance/REVIEW_LIFECYCLE.yml');
const ADOPTION_PLAN = readYaml('planning/GOVERNANCE_ADOPTION_PLAN.yml');

function argumentValue(name) {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function deepMerge(base, override) {
  if (Array.isArray(override)) return structuredClone(override);
  if (!override || typeof override !== 'object') return override;
  const result = structuredClone(base ?? {});
  for (const [key, value] of Object.entries(override)) {
    if (Array.isArray(value)) result[key] = structuredClone(value);
    else if (value && typeof value === 'object') result[key] = deepMerge(result[key], value);
    else result[key] = value;
  }
  return result;
}
function capabilityMap(capabilities = []) {
  const map = new Map();
  for (const item of capabilities) {
    if (!map.has(item.capability_id)) map.set(item.capability_id, []);
    map.get(item.capability_id).push(item.lifecycle);
  }
  return map;
}
function expectedScopeDisclosure(previous, current) {
  const before = capabilityMap(previous.capabilities);
  const after = capabilityMap(current.capabilities);
  const deletedTargetIds = setDifference([...before.keys()], [...after.keys()]);
  const newlyIntroducedTargetIds = setDifference([...after.keys()], [...before.keys()]);
  const lifecycleChanges = [];
  for (const id of after.keys()) {
    const oldStates = before.get(id);
    const newStates = after.get(id);
    if (oldStates?.length === 1 && newStates?.length === 1 && oldStates[0] !== newStates[0]) lifecycleChanges.push({ capability_id: id, from: oldStates[0], to: newStates[0] });
  }
  lifecycleChanges.sort((a, b) => a.capability_id.localeCompare(b.capability_id));
  return { deletedTargetIds, newlyIntroducedTargetIds, lifecycleChanges };
}
function evaluateScenario(scenario) {
  const diagnostics = [];
  const previous = scenario.previous || {};
  const current = scenario.current || {};
  const currentMap = capabilityMap(current.capabilities);
  const currentIds = (current.capabilities || []).map((item) => item.capability_id);
  if (unique(currentIds).length !== currentIds.length) diagnostics.push('GOV-SEQ-001_DUPLICATE_CAPABILITY_ID');
  for (const [id, states] of currentMap) if (unique(states).length > 1) diagnostics.push(`GOV-SEQ-002_LIFECYCLE_CONFLICT:${id}`);
  const expected = expectedScopeDisclosure(previous, current);
  if (expected.deletedTargetIds.length) diagnostics.push(`GOV-SEQ-003_SILENT_TARGET_DELETION:${expected.deletedTargetIds.join(',')}`);
  const changed = expected.deletedTargetIds.length || expected.newlyIntroducedTargetIds.length || expected.lifecycleChanges.length || !setEquals(previous.required_check_set || [], current.required_check_set || []);
  if (changed && previous.scope_revision === current.scope_revision) diagnostics.push('GOV-SEQ-004_SCOPE_REVISION_NOT_BUMPED');
  const disclosure = scenario.scope_disclosure || {};
  const normalize = (item) => ({ capability_id: item.capability_id ?? null, from: item.from ?? null, to: item.to ?? null });
  const disclosed = [...(disclosure.lifecycle_changes || [])].map(normalize).sort((a, b) => (a.capability_id || '').localeCompare(b.capability_id || ''));
  const computed = expected.lifecycleChanges.map(normalize).sort((a, b) => (a.capability_id || '').localeCompare(b.capability_id || ''));
  if (disclosure.from_scope_revision !== previous.scope_revision || disclosure.to_scope_revision !== current.scope_revision || !setEquals(disclosure.deleted_target_ids || [], expected.deletedTargetIds) || !setEquals(disclosure.newly_introduced_target_ids || [], expected.newlyIntroducedTargetIds) || JSON.stringify(disclosed) !== JSON.stringify(computed)) diagnostics.push('GOV-SEQ-005_SCOPE_DISCLOSURE_MISMATCH');
  const receipt = scenario.review_receipt;
  if (!receipt) diagnostics.push('GOV-SEQ-019_REVIEW_RECEIPT_MISSING');
  else {
    for (const error of validateSchema(RECEIPT_SCHEMA, receipt, '$.review_receipt')) diagnostics.push(`GOV-SEQ-006_REVIEW_RECEIPT_SCHEMA:${error}`);
    if (receipt.independent !== true || receipt.implementation_context_id === receipt.reviewer_context_id) diagnostics.push('GOV-SEQ-007_REVIEW_NOT_INDEPENDENT');
    if (receipt.reviewed_head_sha !== current.head_sha) diagnostics.push('GOV-SEQ-008_REVIEW_HEAD_MISMATCH_OR_STALE');
    if (receipt.scope_revision !== current.scope_revision) diagnostics.push('GOV-SEQ-009_REVIEW_SCOPE_REVISION_MISMATCH_OR_STALE');
    if (receipt.technical_status === 'GREEN_MERGE_RECOMMENDED') {
      const checks = scenario.ci?.required_checks || {};
      const required = current.required_check_set || [];
      const exactHeadChecks = scenario.ci?.head_sha === current.head_sha && required.every((name) => checks[name] === 'success');
      if (!exactHeadChecks || !(receipt.exact_head_ci_run_ids || []).length) diagnostics.push('GOV-SEQ-010_GREEN_WITHOUT_EXACT_HEAD_CI');
      const completion = scenario.completion || {};
      if (!(completion.required_artifacts || []).length || !setEquals(completion.required_artifacts || [], completion.present_artifacts || []) || !/^[0-9a-f]{40}$/.test(completion.implementation_commit || '') || !(completion.ci_run_ids || []).length) diagnostics.push('GOV-SEQ-011_INCOMPLETE_COMPLETION_EVIDENCE');
      if ((receipt.findings || []).some((finding) => finding.blocking === true)) diagnostics.push('GOV-SEQ-012_GREEN_WITH_BLOCKING_FINDING');
    }
  }
  if (scenario.claims?.uses_ai_review_signal_as_fact === true) diagnostics.push('GOV-SEQ-013_AI_REVIEW_SIGNAL_USED_AS_FACT');
  if ((scenario.claims?.human_technical_gate_fields || []).length) diagnostics.push(`GOV-SEQ-014_HUMAN_TECHNICAL_GATE:${scenario.claims.human_technical_gate_fields.join(',')}`);
  const security = scenario.security || {};
  if (security.repository_visibility === 'public' && security.public_repository_disposition !== 'retain_minimum_security_with_public_repository_hygiene') diagnostics.push('GOV-SEQ-015_PUBLIC_SECURITY_DISPOSITION_MISSING');
  if (security.contains_secret === true) diagnostics.push('GOV-SEQ-016_SECRET_EXPOSURE');
  if (security.destructive_action?.requested === true && (!security.destructive_action.exact_target || !security.destructive_action.recovery_path)) diagnostics.push('GOV-SEQ-017_UNBOUNDED_DESTRUCTIVE_ACTION');
  const postMerge = scenario.post_merge_verification;
  if (postMerge?.attempted === true && (postMerge.live_default_branch_contains_reviewed_tree !== true || !/^[0-9a-f]{40}$/.test(postMerge.merge_commit || '') || postMerge.authorities_synchronized !== true || postMerge.claims_within_evidence !== true)) diagnostics.push('GOV-SEQ-018_POST_MERGE_VERIFICATION_INCOMPLETE');
  return unique(diagnostics).sort();
}
function evaluateLiveEvidence(evidence) {
  const diagnostics = [];
  const supported = REVIEW_LIFECYCLE.live_receipt_validation?.supported_transports || [];
  if (!supported.includes(evidence.transport)) diagnostics.push('GOV-LIVE-001_UNSUPPORTED_TRANSPORT');
  if (evidence.receipt_parse_error) return ['GOV-LIVE-019_MALFORMED_RECEIPT'];
  const receipt = evidence.receipt;
  if (!receipt) return unique([...diagnostics, 'GOV-LIVE-002_RECEIPT_MISSING']).sort();
  if (typeof receipt !== 'object' || Array.isArray(receipt)) return unique([...diagnostics, 'GOV-LIVE-019_MALFORMED_RECEIPT']).sort();
  for (const error of validateSchema(RECEIPT_SCHEMA, receipt, '$.receipt')) diagnostics.push(`GOV-LIVE-003_RECEIPT_SCHEMA:${error}`);
  const current = evidence.current || {};
  if (receipt.repository !== current.repository || receipt.pull_request !== current.pull_request) diagnostics.push('GOV-LIVE-004_REPOSITORY_OR_PR_MISMATCH');
  if (receipt.base_sha !== current.base_sha) diagnostics.push('GOV-LIVE-005_BASE_SHA_MISMATCH');
  if (receipt.reviewed_head_sha !== current.head_sha) diagnostics.push('GOV-LIVE-006_HEAD_SHA_STALE');
  if (receipt.scope_revision !== current.scope_revision) diagnostics.push('GOV-LIVE-007_SCOPE_REVISION_STALE');
  if (receipt.implementation_context_id !== current.implementation_context_id) diagnostics.push('GOV-LIVE-008_IMPLEMENTATION_CONTEXT_MISMATCH');
  if (receipt.independent !== true || receipt.implementation_context_id === receipt.reviewer_context_id) diagnostics.push('GOV-LIVE-009_REVIEW_NOT_INDEPENDENT');
  if (evidence.source_author_login && evidence.pull_request_author_login && evidence.source_author_login === evidence.pull_request_author_login) diagnostics.push('GOV-LIVE-010_SELF_AUTHORED_RECEIPT');
  if (receipt.technical_status !== 'GREEN_MERGE_RECOMMENDED') diagnostics.push('GOV-LIVE-011_NON_GREEN_RECEIPT');
  if ((receipt.findings || []).some((finding) => finding?.blocking === true)) diagnostics.push('GOV-LIVE-012_GREEN_WITH_BLOCKING_FINDING');
  if (!Number.isFinite(Date.parse(receipt.reviewed_at || ''))) diagnostics.push('GOV-LIVE-018_REVIEWED_AT_INVALID');
  const runIds = receipt.exact_head_ci_run_ids || [];
  if (!Array.isArray(runIds) || !runIds.length) diagnostics.push('GOV-LIVE-013_CI_RUN_IDS_MISSING');
  const runById = new Map((evidence.ci_runs || []).map((run) => [run.id, run]));
  const successful = [];
  for (const runId of runIds) {
    const run = runById.get(runId);
    if (!run) { diagnostics.push(`GOV-LIVE-014_CI_RUN_NOT_FOUND:${runId}`); continue; }
    if (run.head_sha !== current.head_sha) diagnostics.push(`GOV-LIVE-015_CI_RUN_WRONG_HEAD:${runId}`);
    if (run.conclusion !== 'success') diagnostics.push(`GOV-LIVE-016_CI_RUN_FAILED:${runId}`);
    if (run.head_sha === current.head_sha && run.conclusion === 'success') successful.push(run);
  }
  for (const required of evidence.required_check_set?.checks || REVIEW_LIFECYCLE.required_check_set?.checks || []) if (!successful.some((run) => run.name === required.workflow_name && (!required.event || run.event === required.event))) diagnostics.push(`GOV-LIVE-017_REQUIRED_CHECK_MISSING:${required.check_id}`);
  return unique(diagnostics).sort();
}
function listJsonFiles(directory) { return fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort().map((name) => path.join(directory, name)); }
function matches(actual, expected) { return actual === expected || actual.startsWith(`${expected}:`); }
function yamlRegression() {
  const parsed = parseYamlSubset('values:\n  - https://example.com/path\n  - 2026-07-13T18:00:00Z\nempty_array: [ ]\nempty_object: { }\n');
  const errors = [];
  if (!Array.isArray(parsed.values) || parsed.values[0] !== 'https://example.com/path' || parsed.values[1] !== '2026-07-13T18:00:00Z') errors.push('YAML colon-containing array scalars were not preserved.');
  if (!Array.isArray(parsed.empty_array) || parsed.empty_array.length) errors.push('YAML whitespace-safe empty array regression failed.');
  if (!parsed.empty_object || Array.isArray(parsed.empty_object) || Object.keys(parsed.empty_object).length) errors.push('YAML whitespace-safe empty object regression failed.');
  return errors;
}
function runFixtureMode() {
  const errors = [...yamlRegression()];
  let validFiles = 0, invalidFiles = 0;
  for (const filePath of listJsonFiles('tests/governance/valid')) {
    const document = readJson(filePath);
    if (!Array.isArray(document.scenarios)) continue;
    validFiles += 1;
    for (const entry of document.scenarios) { const diagnostics = evaluateScenario(deepMerge(BASE_SCENARIO, entry.overrides || {})); if (diagnostics.length) errors.push(`${filePath}:${entry.scenario_id}: expected valid, got ${JSON.stringify(diagnostics)}.`); }
  }
  for (const filePath of listJsonFiles('tests/governance/invalid')) {
    const document = readJson(filePath);
    if (!Array.isArray(document.scenarios)) continue;
    invalidFiles += 1;
    for (const entry of document.scenarios) {
      const diagnostics = evaluateScenario(deepMerge(BASE_SCENARIO, entry.overrides || {}));
      for (const expected of entry.expected_diagnostics || []) if (!diagnostics.some((diagnostic) => matches(diagnostic, expected))) errors.push(`${filePath}:${entry.scenario_id}: missing ${expected}; got ${JSON.stringify(diagnostics)}.`);
      if (!diagnostics.length) errors.push(`${filePath}:${entry.scenario_id}: invalid fixture unexpectedly passed.`);
    }
  }
  if (errors.length) { printFailure('Governance sequence validation failed:', errors); process.exit(1); }
  console.log('Governance sequence validation passed.'); console.log('mode=fixtures'); console.log(`valid_files=${validFiles}`); console.log(`invalid_files=${invalidFiles}`); console.log('yaml_scalar_regression=passed');
}
function runLiveDocument(document, source) {
  const errors = [];
  if (Array.isArray(document.cases)) {
    for (const entry of document.cases) {
      const diagnostics = evaluateLiveEvidence(deepMerge(document.base || {}, entry.overrides || {})); const expected = entry.expected_diagnostics || [];
      if (!expected.length && diagnostics.length) errors.push(`${source}:${entry.case_id}: expected valid, got ${JSON.stringify(diagnostics)}.`);
      for (const code of expected) if (!diagnostics.some((diagnostic) => matches(diagnostic, code))) errors.push(`${source}:${entry.case_id}: missing ${code}; got ${JSON.stringify(diagnostics)}.`);
      if (expected.length && !diagnostics.length) errors.push(`${source}:${entry.case_id}: invalid live evidence unexpectedly passed.`);
    }
    if (errors.length) { printFailure('Live governance review receipt regression validation failed:', errors); process.exit(1); }
    console.log('Live governance review receipt regression validation passed.'); console.log('mode=live'); console.log(`fixture_cases=${document.cases.length}`); console.log('synthetic_evidence_only=true'); return;
  }
  const diagnostics = evaluateLiveEvidence(document); if (diagnostics.length) { printFailure('Live governance review receipt validation failed:', diagnostics); process.exit(1); }
  console.log('Live governance review receipt validation passed.'); console.log('mode=live');
}
function parseReceiptBody(body, marker) {
  const index = body.indexOf(marker); if (index === -1) return null;
  const fenced = body.slice(index + marker.length).match(/```json\s*([\s\S]*?)```/i); if (!fenced) throw new Error('receipt marker must be followed by a fenced JSON object.'); return JSON.parse(fenced[1]);
}
async function githubGet(url, token) {
  const response = await fetch(url, { headers: { Accept:'application/vnd.github+json', Authorization:`Bearer ${token}`, 'X-GitHub-Api-Version':'2022-11-28' } });
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${url}.`); return response.json();
}
async function githubList(apiBase, endpoint, token) {
  const items=[]; for (let page=1; page<=10; page+=1) { const batch=await githubGet(`${apiBase}${endpoint}${endpoint.includes('?')?'&':'?'}per_page=100&page=${page}`,token); if (!Array.isArray(batch)) throw new Error(`Expected array from ${endpoint}.`); items.push(...batch); if (batch.length<100) break; } return items;
}
async function buildGithubLiveEvidence() {
  const token=process.env.GITHUB_TOKEN, apiBase=process.env.GITHUB_API_URL||'https://api.github.com', repository=process.env.CURRENT_REPOSITORY||process.env.GITHUB_REPOSITORY, pullRequest=Number(process.env.CURRENT_PULL_REQUEST);
  if (!token || !repository || !Number.isInteger(pullRequest) || pullRequest<1) throw new Error('GITHUB_TOKEN, CURRENT_REPOSITORY, and CURRENT_PULL_REQUEST are required.');
  const pr=await githubGet(`${apiBase}/repos/${repository}/pulls/${pullRequest}`,token);
  if (process.env.CURRENT_HEAD_SHA && pr.head?.sha!==process.env.CURRENT_HEAD_SHA) throw new Error('supplied current head does not match live PR head.');
  if (process.env.CURRENT_BASE_SHA && pr.base?.sha!==process.env.CURRENT_BASE_SHA) throw new Error('supplied base SHA does not match live PR base.');
  const marker=REVIEW_LIFECYCLE.live_receipt_validation?.marker, candidates=[];
  for (const comment of await githubList(apiBase,`/repos/${repository}/issues/${pullRequest}/comments`,token)) { if (!comment.body?.includes(marker)) continue; const candidate={transport:'pull_request_comment',source_author_login:comment.user?.login,timestamp:comment.updated_at||comment.created_at,receipt:null,receipt_parse_error:null}; try{candidate.receipt=parseReceiptBody(comment.body,marker);}catch(error){candidate.receipt_parse_error=error.message;} candidates.push(candidate); }
  for (const review of await githubList(apiBase,`/repos/${repository}/pulls/${pullRequest}/reviews`,token)) { if (!review.body?.includes(marker)) continue; const candidate={transport:'pull_request_review',source_author_login:review.user?.login,timestamp:review.submitted_at,receipt:null,receipt_parse_error:null}; try{candidate.receipt=parseReceiptBody(review.body,marker);}catch(error){candidate.receipt_parse_error=error.message;} candidates.push(candidate); }
  candidates.sort((a,b)=>Date.parse(a.timestamp||0)-Date.parse(b.timestamp||0)); const selected=candidates.at(-1)||{transport:null,source_author_login:null,receipt:null,receipt_parse_error:null};
  const ciRuns=[]; for (const runId of selected.receipt?.exact_head_ci_run_ids||[]) { try { const run=await githubGet(`${apiBase}/repos/${repository}/actions/runs/${runId}`,token); ciRuns.push({id:run.id,name:run.name,event:run.event,head_sha:run.head_sha,conclusion:run.conclusion}); } catch { } }
  return {transport:selected.transport,source_author_login:selected.source_author_login,pull_request_author_login:pr.user?.login,receipt:selected.receipt,receipt_parse_error:selected.receipt_parse_error,current:{repository,pull_request:pullRequest,base_sha:pr.base?.sha,head_sha:pr.head?.sha,scope_revision:ADOPTION_PLAN.current_increment?.scope_revision,implementation_context_id:ADOPTION_PLAN.current_increment?.implementation_context_id},required_check_set:REVIEW_LIFECYCLE.required_check_set,ci_runs:ciRuns};
}
const mode=argumentValue('--mode')||'fixtures';
if (mode==='fixtures') runFixtureMode();
else if (mode==='live') { const source=argumentValue('--source'), evidenceFile=argumentValue('--evidence-file'); if (source==='github') runLiveDocument(await buildGithubLiveEvidence(),'github'); else if (evidenceFile) runLiveDocument(readJson(evidenceFile),evidenceFile); else { printFailure('Live governance review receipt validation failed:',['live mode requires --source=github or --evidence-file <path>.']); process.exit(1); } }
else { printFailure('Governance sequence validation failed:',[`unsupported mode: ${mode}.`]); process.exit(1); }
