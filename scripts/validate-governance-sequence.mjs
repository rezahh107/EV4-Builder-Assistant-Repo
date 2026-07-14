#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseYamlSubset, printFailure, readJson, readText, readYaml,
  setDifference, setEquals, unique, validateSchema
} from './governance-lib.mjs';

const RECEIPT_SCHEMA = readJson('governance/schemas/review-receipt.schema.json');
const BASE_SCENARIO = readJson('tests/governance/scenario-base.json');
const REVIEW_LIFECYCLE = readYaml('governance/REVIEW_LIFECYCLE.yml');
const ADOPTION_PLAN = readYaml('planning/GOVERNANCE_ADOPTION_PLAN.yml');
const CANONICAL_GITHUB_API_ORIGIN = 'https://api.github.com';
const INSPECTOR_REPOSITORY = 'rezahh107/PR-Inspector';
const INSPECTOR_REPOSITORY_ID = 1288323264;
const INSPECTOR_PROTOCOL = 'v1.10.0';
const REQUIRED_BUNDLE_FILES = [
  'review-package.json', 'DECISION_PROJECTION.json', 'artifact-manifest.json',
  'OWNER_DECISION_CARD.fa.md', 'TECHNICAL_HANDOFF.en.md', 'OWNER_RESULT.fa.txt'
];

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
  const out = new Map();
  for (const item of capabilities) {
    if (!out.has(item.capability_id)) out.set(item.capability_id, []);
    out.get(item.capability_id).push(item.lifecycle);
  }
  return out;
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
  const ids = (current.capabilities || []).map((item) => item.capability_id);
  const map = capabilityMap(current.capabilities);
  if (unique(ids).length !== ids.length) diagnostics.push('GOV-SEQ-001_DUPLICATE_CAPABILITY_ID');
  for (const [id, states] of map) if (unique(states).length > 1) diagnostics.push(`GOV-SEQ-002_LIFECYCLE_CONFLICT:${id}`);
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
    if (receipt.reviewed_head_sha !== current.head_sha) diagnostics.push('GOV-SEQ-008_REVIEW_HEAD_MISMATCH_OR_STALE');
    if (receipt.scope_revision !== current.scope_revision) diagnostics.push('GOV-SEQ-009_REVIEW_SCOPE_REVISION_MISMATCH_OR_STALE');
    if (receipt.review_validity !== 'CURRENT') diagnostics.push('GOV-SEQ-028_REVIEW_VALIDITY_NOT_CURRENT');
    if (receipt.technical_status === 'GREEN_TECHNICALLY_READY') {
      if (scenario.canonical_bundle_verified !== true) diagnostics.push('GOV-SEQ-027_CANONICAL_BUNDLE_REQUIRED');
      const checks = scenario.ci?.required_checks || {};
      const required = current.required_check_set || [];
      const exactHeadChecks = scenario.ci?.head_sha === current.head_sha && required.every((name) => checks[name] === 'success');
      if (!exactHeadChecks || !(receipt.exact_head_ci_run_ids || []).length) diagnostics.push('GOV-SEQ-010_GREEN_WITHOUT_EXACT_HEAD_CI');
      const completion = scenario.completion || {};
      if (!(completion.required_artifacts || []).length || !setEquals(completion.required_artifacts || [], completion.present_artifacts || []) || !/^[0-9a-f]{40}$/.test(completion.implementation_commit || '') || !(completion.ci_run_ids || []).length) diagnostics.push('GOV-SEQ-011_INCOMPLETE_COMPLETION_EVIDENCE');
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

function sha256(raw) { return crypto.createHash('sha256').update(raw).digest('hex'); }
function sortRecursively(value) {
  if (Array.isArray(value)) return value.map(sortRecursively);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortRecursively(value[key])]));
}
function canonicalJsonBytes(value) { return Buffer.from(`${JSON.stringify(sortRecursively(value))}\n`, 'utf8'); }
function parseJsonBytes(name, raw, diagnostics) {
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('expected JSON object');
    return parsed;
  } catch (error) {
    diagnostics.push(`GOV-LIVE-033_CANONICAL_BUNDLE_MALFORMED:${name}:${error.message}`);
    return null;
  }
}
function decodeBase64Strict(name, value, diagnostics) {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    diagnostics.push(`GOV-LIVE-033_CANONICAL_BUNDLE_MALFORMED:${name}:invalid_base64`);
    return null;
  }
  return Buffer.from(value, 'base64');
}
function projectionFromPackage(pkg) {
  const identity = pkg.review_identity || {};
  const checks = pkg.checks || [];
  const reasons = [];
  const push = (reason_code, subjects) => { if (subjects.length) reasons.push({ reason_code, subjects }); };
  if (identity.review_validity !== 'CURRENT') push('RSN-REVIEW-NOT-CURRENT', [identity.review_validity || 'UNKNOWN']);
  push('RSN-RED-GATE-FLAG', [...(pkg.red_gate_flags || [])]);
  push('RSN-REQUIRED-CHECK-FAILED', checks.filter((item) => item.required && item.result === 'FAIL').map((item) => `${item.check_id}:${item.name}`));
  push('RSN-REQUIRED-CHECK-UNRESOLVED', checks.filter((item) => item.required && ['UNKNOWN', 'NOT_RUN'].includes(item.result)).map((item) => `${item.check_id}:${item.name}`));
  const redCodes = reasons.filter((item) => ['RSN-RED-GATE-FLAG', 'RSN-REQUIRED-CHECK-FAILED'].includes(item.reason_code)).map((item) => item.reason_code);
  const yellowCodes = reasons.filter((item) => ['RSN-REVIEW-NOT-CURRENT', 'RSN-REQUIRED-CHECK-UNRESOLVED'].includes(item.reason_code)).map((item) => item.reason_code);
  const technicalStatus = redCodes.length ? 'RED_DO_NOT_MERGE' : yellowCodes.length ? 'YELLOW_CHANGES_OR_VERIFICATION_REQUIRED' : 'GREEN_TECHNICALLY_READY';
  let action = 'merge_now';
  let actionCodes = [];
  if (identity.review_validity !== 'CURRENT') { action = 'rerun_review'; actionCodes = ['RSN-REVIEW-NOT-CURRENT']; }
  else if (technicalStatus === 'RED_DO_NOT_MERGE') { action = 'repair'; actionCodes = redCodes; }
  else if (technicalStatus === 'YELLOW_CHANGES_OR_VERIFICATION_REQUIRED') { action = 'verify'; actionCodes = yellowCodes; }
  else if (pkg.decision?.approval_requirement === 'PROJECT_OWNER_CONFIRMATION') action = 'owner_confirmation';
  else if (pkg.decision?.approval_requirement === 'HUMAN_TECHNICAL_REVIEW_REQUIRED') action = 'human_technical_review';
  else if (pkg.decision?.approval_requirement === 'SECURITY_OR_DOMAIN_SPECIALIST_REQUIRED') action = 'specialist_review';
  const routing = {
    merge_now: ['none', false, false, null], owner_confirmation: ['project_owner', false, false, null],
    human_technical_review: ['human_technical_reviewer', false, true, 'human_review_handoff'],
    specialist_review: ['security_or_domain_specialist', false, true, 'specialist_review_handoff'],
    repair: ['implementer_model', true, true, 'implementer_repair_prompt'],
    verify: ['reviewer_model', false, true, 'verification_prompt'], rerun_review: ['reviewer_model', false, true, 'fresh_review_prompt']
  };
  const [recipient, mayModify, promptRequired, promptKind] = routing[action];
  const color = action === 'rerun_review' ? 'YELLOW' : technicalStatus === 'RED_DO_NOT_MERGE' ? 'RED' : action === 'merge_now' ? 'GREEN' : 'YELLOW';
  const technicalCodes = redCodes.length ? redCodes : yellowCodes;
  return {
    schema_version: 1,
    protocol_version: INSPECTOR_PROTOCOL,
    technical_status: technicalStatus,
    technical_status_reason_codes: technicalCodes,
    approval_requirement: pkg.decision?.approval_requirement,
    owner_readiness: { color, action_kind: action, message_key: `${color.toLowerCase()}_${action}`, reason_codes: [...new Set([...technicalCodes, ...actionCodes])] },
    next_action: { kind: action, recipient, may_modify_code: mayModify, prompt_required: promptRequired, prompt_kind: promptKind, reason_codes: actionCodes },
    review_identity: { validity: identity.review_validity, reviewed_head_sha: identity.reviewed_head_sha },
    reason_details: reasons,
    required_actions: [...(pkg.required_actions || [])]
  };
}
function canonicalEvidenceId(receipt, pkg, projection) {
  const payload = {
    protocol_version: receipt.protocol_version,
    target_repository: pkg.review_identity.target_repository,
    pr_number: pkg.review_identity.pr_number,
    reviewed_head_sha: pkg.review_identity.reviewed_head_sha,
    review_validity: pkg.review_identity.review_validity,
    inspector_repository: receipt.inspector_repository,
    inspector_repository_id: receipt.inspector_repository_id,
    inspector_commit_sha: receipt.inspector_commit_sha,
    inspector_commit_api_url: receipt.inspector_commit_api_url,
    inspector_commit_html_url: receipt.inspector_commit_html_url,
    inspector_evidence_source: receipt.inspector_evidence_source,
    review_package_canonical_sha256: receipt.review_package_canonical_sha256,
    review_package_file_sha256: receipt.review_package_file_sha256,
    decision_projection_sha256: receipt.decision_projection_sha256,
    artifact_manifest_sha256: receipt.artifact_manifest_sha256,
    technical_status: projection.technical_status,
    approval_requirement: projection.approval_requirement,
    next_action_kind: projection.next_action.kind
  };
  return sha256(canonicalJsonBytes(payload));
}
function verifyManifestEntry(manifest, key, expectedPath, bytes, diagnostics) {
  const entry = manifest?.[key];
  if (!entry || entry.path !== expectedPath || typeof entry.sha256 !== 'string') {
    diagnostics.push(`GOV-LIVE-038_MANIFEST_ENTRY_MISSING:${key}`);
    return;
  }
  if (entry.sha256 !== sha256(bytes)) diagnostics.push(`GOV-LIVE-039_MANIFEST_ARTIFACT_HASH_MISMATCH:${key}`);
}
function evaluateLiveEvidence(evidence) {
  const diagnostics = [];
  if (evidence.synthetic_evidence_only !== true) diagnostics.push('GOV-LIVE-048_SYNTHETIC_MARKER_MISSING');
  const receipt = evidence.receipt;
  if (!receipt) return ['GOV-LIVE-002_RECEIPT_MISSING'];
  for (const error of validateSchema(RECEIPT_SCHEMA, receipt, '$.receipt')) diagnostics.push(`GOV-LIVE-003_RECEIPT_SCHEMA:${error}`);
  const current = evidence.current || {};
  if (receipt.repository !== current.repository || receipt.pull_request !== current.pull_request) diagnostics.push('GOV-LIVE-004_REPOSITORY_OR_PR_MISMATCH');
  if (receipt.base_sha !== current.base_sha) diagnostics.push('GOV-LIVE-005_BASE_SHA_MISMATCH');
  if (receipt.reviewed_head_sha !== current.head_sha) diagnostics.push('GOV-LIVE-006_HEAD_SHA_STALE');
  if (receipt.scope_revision !== current.scope_revision) diagnostics.push('GOV-LIVE-007_SCOPE_REVISION_STALE');
  if (receipt.implementation_context_id !== current.implementation_context_id) diagnostics.push('GOV-LIVE-008_IMPLEMENTATION_CONTEXT_MISMATCH');
  if (!Number.isFinite(Date.parse(receipt.reviewed_at || ''))) diagnostics.push('GOV-LIVE-018_REVIEWED_AT_INVALID');

  const repoEvidence = evidence.inspector_repository_evidence || {};
  const commitEvidence = evidence.inspector_commit_evidence || {};
  const expectedCommitApi = `https://api.github.com/repos/${INSPECTOR_REPOSITORY}/commits/${receipt.inspector_commit_sha}`;
  const expectedCommitHtml = `https://github.com/${INSPECTOR_REPOSITORY}/commit/${receipt.inspector_commit_sha}`;
  if (receipt.inspector_repository !== INSPECTOR_REPOSITORY || receipt.inspector_repository_id !== INSPECTOR_REPOSITORY_ID || receipt.protocol_version !== INSPECTOR_PROTOCOL || receipt.inspector_evidence_source !== 'github_rest_api_https') diagnostics.push('GOV-LIVE-044_INSPECTOR_IDENTITY_MISMATCH');
  if (repoEvidence.full_name !== INSPECTOR_REPOSITORY || repoEvidence.id !== INSPECTOR_REPOSITORY_ID || repoEvidence.url !== `https://api.github.com/repos/${INSPECTOR_REPOSITORY}` || repoEvidence.html_url !== `https://github.com/${INSPECTOR_REPOSITORY}` || commitEvidence.sha !== receipt.inspector_commit_sha || commitEvidence.url !== expectedCommitApi || commitEvidence.html_url !== expectedCommitHtml || receipt.inspector_commit_api_url !== expectedCommitApi || receipt.inspector_commit_html_url !== expectedCommitHtml || evidence.inspector_lookup_error) diagnostics.push('GOV-LIVE-045_INSPECTOR_COMMIT_UNVERIFIED');

  if (evidence.official_accessor_available !== true) diagnostics.push('GOV-LIVE-030_OFFICIAL_BUNDLE_ACCESSOR_UNAVAILABLE');
  const bundle = evidence.canonical_bundle;
  if (!bundle) return unique([...diagnostics, 'GOV-LIVE-031_CANONICAL_BUNDLE_MISSING']).sort();
  if (bundle.capture_count !== 1 || bundle.refetch_after_verification === true || bundle.reopen_after_verification === true) diagnostics.push('GOV-LIVE-047_SECOND_READ_FORBIDDEN');
  const encoded = bundle.artifact_bytes_base64;
  if (!encoded || typeof encoded !== 'object' || Array.isArray(encoded)) return unique([...diagnostics, 'GOV-LIVE-031_CANONICAL_BUNDLE_MISSING']).sort();
  const captured = new Map();
  for (const name of REQUIRED_BUNDLE_FILES) {
    if (!(name in encoded) || encoded[name] === null) diagnostics.push(`GOV-LIVE-032_CANONICAL_BUNDLE_INCOMPLETE:${name}`);
    else {
      const raw = decodeBase64Strict(name, encoded[name], diagnostics);
      if (raw) captured.set(name, raw);
    }
  }
  if (diagnostics.some((item) => item.startsWith('GOV-LIVE-032_') || item.startsWith('GOV-LIVE-033_'))) return unique(diagnostics).sort();
  const packageBytes = captured.get('review-package.json');
  const projectionBytes = captured.get('DECISION_PROJECTION.json');
  const manifestBytes = captured.get('artifact-manifest.json');
  const pkg = parseJsonBytes('review-package.json', packageBytes, diagnostics);
  const projection = parseJsonBytes('DECISION_PROJECTION.json', projectionBytes, diagnostics);
  const manifest = parseJsonBytes('artifact-manifest.json', manifestBytes, diagnostics);
  if (!pkg || !projection || !manifest) return unique(diagnostics).sort();

  const identity = pkg.review_identity || {};
  if (identity.target_repository !== current.repository || identity.pr_number !== current.pull_request || identity.base_sha !== current.base_sha || identity.reviewed_head_sha !== current.head_sha) diagnostics.push('GOV-LIVE-043_CANONICAL_TARGET_IDENTITY_MISMATCH');
  if (identity.inspector_repository !== INSPECTOR_REPOSITORY || identity.inspector_commit_sha !== receipt.inspector_commit_sha || pkg.protocol_version !== INSPECTOR_PROTOCOL) diagnostics.push('GOV-LIVE-044_INSPECTOR_IDENTITY_MISMATCH');
  if (identity.review_validity !== 'CURRENT' || projection.review_identity?.validity !== 'CURRENT' || receipt.review_validity !== 'CURRENT') diagnostics.push('GOV-LIVE-042_REVIEW_VALIDITY_NOT_CURRENT');
  if (projection.review_identity?.reviewed_head_sha !== identity.reviewed_head_sha) diagnostics.push('GOV-LIVE-046_PROJECTION_PACKAGE_MISMATCH');

  const canonicalPackageHash = sha256(canonicalJsonBytes(pkg));
  const packageFileHash = sha256(packageBytes);
  const projectionHash = sha256(projectionBytes);
  const manifestHash = sha256(manifestBytes);
  if (receipt.review_package_canonical_sha256 !== canonicalPackageHash || manifest.canonical_review_package?.canonical_sha256 !== canonicalPackageHash) diagnostics.push('GOV-LIVE-034_REVIEW_PACKAGE_CANONICAL_HASH_MISMATCH');
  if (receipt.review_package_file_sha256 !== packageFileHash || manifest.canonical_review_package?.file_sha256 !== packageFileHash || manifest.canonical_review_package?.path !== 'review-package.json') diagnostics.push('GOV-LIVE-035_REVIEW_PACKAGE_FILE_HASH_MISMATCH');
  if (receipt.decision_projection_sha256 !== projectionHash || manifest.decision_projection?.sha256 !== projectionHash || manifest.decision_projection?.path !== 'DECISION_PROJECTION.json') diagnostics.push('GOV-LIVE-036_DECISION_PROJECTION_HASH_MISMATCH');
  if (receipt.artifact_manifest_sha256 !== manifestHash) diagnostics.push('GOV-LIVE-037_ARTIFACT_MANIFEST_HASH_MISMATCH');
  verifyManifestEntry(manifest, 'owner_decision_card', 'OWNER_DECISION_CARD.fa.md', captured.get('OWNER_DECISION_CARD.fa.md'), diagnostics);
  verifyManifestEntry(manifest, 'technical_handoff', 'TECHNICAL_HANDOFF.en.md', captured.get('TECHNICAL_HANDOFF.en.md'), diagnostics);
  verifyManifestEntry(manifest, 'simple_owner_result', 'OWNER_RESULT.fa.txt', captured.get('OWNER_RESULT.fa.txt'), diagnostics);
  if (!manifest.next_action_artifact || manifest.next_action_artifact.generated !== false || manifest.next_action_artifact.path !== null || manifest.next_action_artifact.sha256 !== null) diagnostics.push('GOV-LIVE-038_MANIFEST_ENTRY_MISSING:next_action_artifact');

  const expectedProjection = projectionFromPackage(pkg);
  if (JSON.stringify(sortRecursively(projection)) !== JSON.stringify(sortRecursively(expectedProjection))) diagnostics.push('GOV-LIVE-046_PROJECTION_PACKAGE_MISMATCH');
  if (receipt.technical_status !== projection.technical_status) diagnostics.push('GOV-LIVE-041_TECHNICAL_STATUS_PROJECTION_MISMATCH');
  if (receipt.review_validity !== identity.review_validity) diagnostics.push('GOV-LIVE-042_REVIEW_VALIDITY_NOT_CURRENT');
  if (receipt.review_evidence_id !== canonicalEvidenceId(receipt, pkg, projection)) diagnostics.push('GOV-LIVE-040_REVIEW_EVIDENCE_ID_MISMATCH');

  const runIds = receipt.exact_head_ci_run_ids || [];
  if (!runIds.length) diagnostics.push('GOV-LIVE-013_CI_RUN_IDS_MISSING');
  const runs = new Map((evidence.ci_runs || []).map((run) => [run.id, run]));
  const successful = [];
  for (const id of runIds) {
    const run = runs.get(id);
    if (!run) diagnostics.push(`GOV-LIVE-014_CI_RUN_NOT_FOUND:${id}`);
    else {
      if (run.head_sha !== current.head_sha) diagnostics.push(`GOV-LIVE-015_CI_RUN_WRONG_HEAD:${id}`);
      if (run.conclusion !== 'success') diagnostics.push(`GOV-LIVE-016_CI_RUN_FAILED:${id}`);
      if (run.head_sha === current.head_sha && run.conclusion === 'success') successful.push(run);
    }
  }
  for (const required of evidence.required_check_set?.checks || REVIEW_LIFECYCLE.required_check_set?.checks || []) if (!successful.some((run) => run.name === required.workflow_name && run.event === required.event)) diagnostics.push(`GOV-LIVE-017_REQUIRED_CHECK_MISSING:${required.check_id}`);
  return unique(diagnostics).sort();
}

function validateCanonicalGithubApiOrigin(candidate) {
  let url;
  try { url = new URL(candidate); } catch { throw new Error(`untrusted GitHub API origin: ${candidate}`); }
  if (url.protocol !== 'https:' || url.hostname !== 'api.github.com' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || url.origin !== CANONICAL_GITHUB_API_ORIGIN) throw new Error(`untrusted GitHub API origin: ${candidate}`);
  return url;
}
function rejectCallerControlledApiOrigin(environment = process.env) { if (Object.prototype.hasOwnProperty.call(environment, 'GITHUB_API_URL')) throw new Error('GITHUB_API_URL is forbidden; the authoritative GitHub.com API origin is fixed.'); }
function rejectRedirect(status, location) { if (status >= 300 && status < 400) throw new Error(`GitHub API redirects are forbidden${location ? `: ${location}` : ''}.`); }
function listJsonFiles(directory) { return fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort().map((name) => path.join(directory, name)); }
function matches(actual, expected) { return actual === expected || actual.startsWith(`${expected}:`); }
function yamlRegression() {
  const parsed = parseYamlSubset('values:\n  - https://example.com/path\n  - 2026-07-13T18:00:00Z\nempty_array: [ ]\nempty_object: { }\n', '<yaml-scalar-regression>');
  const errors = [];
  if (!Array.isArray(parsed.values) || parsed.values[0] !== 'https://example.com/path' || parsed.values[1] !== '2026-07-13T18:00:00Z') errors.push('YAML colon-containing array scalars were not preserved.');
  if (!Array.isArray(parsed.empty_array) || parsed.empty_array.length) errors.push('YAML whitespace-safe empty array regression failed.');
  if (!parsed.empty_object || Array.isArray(parsed.empty_object) || Object.keys(parsed.empty_object).length) errors.push('YAML whitespace-safe empty object regression failed.');
  const directory = 'tests/governance/invalid-yaml';
  for (const fileName of fs.readdirSync(directory).filter((name) => name.endsWith('.yml')).sort()) {
    const filePath = path.join(directory, fileName);
    try { parseYamlSubset(readText(filePath), filePath); errors.push(`${filePath}: duplicate YAML fixture unexpectedly passed.`); }
    catch (error) { const message = String(error.message || error); if (!message.includes(filePath) || !/line \d+/.test(message) || !message.includes('duplicate key')) errors.push(`${filePath}: duplicate diagnostic lacks file, line, or key identity: ${message}`); }
  }
  return errors;
}
function apiOriginRegression() {
  const errors = [];
  const fixture = readJson('tests/governance/invalid/api_origin_failures.json');
  try { validateCanonicalGithubApiOrigin(CANONICAL_GITHUB_API_ORIGIN); } catch (error) { errors.push(`canonical GitHub API origin was rejected: ${error.message}`); }
  for (const origin of fixture.origins || []) {
    try { validateCanonicalGithubApiOrigin(origin); errors.push(`untrusted API origin unexpectedly passed: ${origin}`); } catch { }
    try { rejectCallerControlledApiOrigin({ GITHUB_API_URL: origin }); errors.push(`caller-controlled API origin unexpectedly passed: ${origin}`); } catch { }
  }
  try { rejectRedirect(302, fixture.cross_origin_redirect); errors.push('cross-origin redirect unexpectedly passed.'); } catch { }
  return errors;
}
function runFixtureMode() {
  const errors = [...yamlRegression(), ...apiOriginRegression()];
  let validFiles = 0;
  let invalidFiles = 0;
  for (const filePath of listJsonFiles('tests/governance/valid')) {
    const document = readJson(filePath);
    if (!Array.isArray(document.scenarios)) continue;
    validFiles += 1;
    for (const entry of document.scenarios) {
      const diagnostics = evaluateScenario(deepMerge(BASE_SCENARIO, entry.overrides || {}));
      if (diagnostics.length) errors.push(`${filePath}:${entry.scenario_id}: expected valid, got ${JSON.stringify(diagnostics)}.`);
    }
  }
  for (const filePath of listJsonFiles('tests/governance/invalid')) {
    const document = readJson(filePath);
    if (!Array.isArray(document.scenarios)) continue;
    invalidFiles += 1;
    for (const entry of document.scenarios) {
      const diagnostics = evaluateScenario(deepMerge(BASE_SCENARIO, entry.overrides || {}));
      for (const expected of entry.expected_diagnostics || []) if (!diagnostics.some((item) => matches(item, expected))) errors.push(`${filePath}:${entry.scenario_id}: missing ${expected}; got ${JSON.stringify(diagnostics)}.`);
      if (!diagnostics.length) errors.push(`${filePath}:${entry.scenario_id}: invalid fixture unexpectedly passed.`);
    }
  }
  if (errors.length) { printFailure('Governance sequence validation failed:', errors); process.exit(1); }
  console.log('Governance sequence validation passed.');
  console.log('mode=fixtures');
  console.log(`valid_files=${validFiles}`);
  console.log(`invalid_files=${invalidFiles}`);
  console.log('yaml_duplicate_key_regression=passed');
  console.log('api_origin_regression=passed');
}
function runLiveDocument(document, source) {
  const errors = [];
  if (!Array.isArray(document.cases)) { printFailure('Live governance review receipt regression validation failed:', [`${source}: cases array is required.`]); process.exit(1); }
  for (const entry of document.cases) {
    const diagnostics = evaluateLiveEvidence(deepMerge(document.base || {}, entry.overrides || {}));
    const expected = entry.expected_diagnostics || [];
    if (!expected.length && diagnostics.length) errors.push(`${source}:${entry.case_id}: expected valid, got ${JSON.stringify(diagnostics)}.`);
    for (const code of expected) if (!diagnostics.some((item) => matches(item, code))) errors.push(`${source}:${entry.case_id}: missing ${code}; got ${JSON.stringify(diagnostics)}.`);
    if (expected.length && !diagnostics.length) errors.push(`${source}:${entry.case_id}: invalid live evidence unexpectedly passed.`);
  }
  if (errors.length) { printFailure('Live governance review receipt regression validation failed:', errors); process.exit(1); }
  console.log('Live governance review receipt regression validation passed.');
  console.log('mode=live');
  console.log(`fixture_cases=${document.cases.length}`);
  console.log('synthetic_evidence_only=true');
  console.log('trusted_byte_handling=capture_hash_validate_manifest_and_parse_same_in_memory_bytes');
}

const mode = argumentValue('--mode') || 'fixtures';
if (mode === 'fixtures') runFixtureMode();
else if (mode === 'live') {
  const source = argumentValue('--source');
  const evidenceFile = argumentValue('--evidence-file');
  if (source === 'github') {
    rejectCallerControlledApiOrigin();
    validateCanonicalGithubApiOrigin(CANONICAL_GITHUB_API_ORIGIN);
    printFailure('Live governance review receipt validation failed:', ['GOV-LIVE-030_OFFICIAL_BUNDLE_ACCESSOR_UNAVAILABLE: PR Inspector v1.10.0 exposes only a local review-directory accessor; typed PR comments or reviews are not canonical technical evidence.']);
    process.exit(1);
  } else if (evidenceFile) runLiveDocument(readJson(evidenceFile), evidenceFile);
  else { printFailure('Live governance review receipt validation failed:', ['live mode requires --source=github or --evidence-file <path>.']); process.exit(1); }
} else { printFailure('Governance sequence validation failed:', [`unsupported mode: ${mode}.`]); process.exit(1); }
