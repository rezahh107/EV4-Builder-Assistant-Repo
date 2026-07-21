#!/usr/bin/env node
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const UPSTREAM_WORKFLOWS = [
  'Schema validation',
  'Verify Project Gate Contract Pin'
];

const AUTHORITY_LOCK_PATH = 'governance/external-authorities/project-gate-authority.v1.json';

function unique(values) { return [...new Set(values)]; }
function argumentValue(name) {
  const direct = process.argv.find((value) => value.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
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

export function validateProgressEvidence(evidence, expected, authorityLock = readJson(AUTHORITY_LOCK_PATH)) {
  const diagnostics = [];
  const sha40 = /^[0-9a-f]{40}$/;
  const sha64 = /^[0-9a-f]{64}$/;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return ['GOV-PROGRESS-001_EVIDENCE_OBJECT_REQUIRED'];
  }
  if (evidence.schema_version !== 2) diagnostics.push('GOV-PROGRESS-002_SCHEMA_VERSION_INVALID');
  if (evidence.source !== 'github_actions_api') diagnostics.push('GOV-PROGRESS-003_SOURCE_NOT_GITHUB_ACTIONS_API');
  if (evidence.repository !== expected.repository) diagnostics.push('GOV-PROGRESS-004_REPOSITORY_MISMATCH');
  if (evidence.pull_request !== expected.pull_request) diagnostics.push('GOV-PROGRESS-005_PULL_REQUEST_MISMATCH');
  if (!sha40.test(evidence.head_sha || '') || evidence.head_sha !== expected.head_sha) diagnostics.push('GOV-PROGRESS-006_HEAD_MISMATCH_OR_STALE');
  const expectedPrUrl = `https://api.github.com/repos/${expected.repository}/pulls/${expected.pull_request}`;
  if (evidence.pull_request_api_url !== expectedPrUrl) diagnostics.push('GOV-PROGRESS-007_PULL_REQUEST_API_IDENTITY_MISMATCH');

  const checks = Array.isArray(evidence.upstream_checks) ? evidence.upstream_checks : [];
  if (!Array.isArray(evidence.upstream_checks)) diagnostics.push('GOV-PROGRESS-008_UPSTREAM_CHECKS_ARRAY_REQUIRED');
  const names = checks.map((item) => item?.workflow_name);
  const runIds = checks.map((item) => item?.run_id);
  if (unique(names).length !== names.length) diagnostics.push('GOV-PROGRESS-009_DUPLICATE_WORKFLOW_IDENTITY');
  if (unique(runIds).length !== runIds.length) diagnostics.push('GOV-PROGRESS-010_DUPLICATE_RUN_IDENTITY');
  if (JSON.stringify([...names].sort()) !== JSON.stringify([...UPSTREAM_WORKFLOWS].sort())) diagnostics.push('GOV-PROGRESS-011_UPSTREAM_WORKFLOW_SET_MISMATCH');
  for (const check of checks) {
    const name = check?.workflow_name || '<missing>';
    if (!Number.isInteger(check?.run_id) || check.run_id < 1) {
      diagnostics.push(`GOV-PROGRESS-012_RUN_ID_INVALID:${name}`);
      continue;
    }
    if (check.repository !== expected.repository) diagnostics.push(`GOV-PROGRESS-013_CHECK_REPOSITORY_MISMATCH:${name}`);
    if (check.pull_request !== expected.pull_request) diagnostics.push(`GOV-PROGRESS-014_CHECK_PULL_REQUEST_MISMATCH:${name}`);
    if (check.head_sha !== expected.head_sha) diagnostics.push(`GOV-PROGRESS-015_CHECK_HEAD_MISMATCH_OR_STALE:${name}`);
    if (check.event !== 'pull_request') diagnostics.push(`GOV-PROGRESS-016_CHECK_EVENT_INVALID:${name}`);
    if (check.status !== 'completed') diagnostics.push(`GOV-PROGRESS-017_CHECK_NOT_COMPLETED:${name}`);
    if (check.conclusion !== 'success') diagnostics.push(`GOV-PROGRESS-018_CHECK_NOT_SUCCESSFUL:${name}`);
    const apiUrl = `https://api.github.com/repos/${expected.repository}/actions/runs/${check.run_id}`;
    if (check.run_api_url !== apiUrl) diagnostics.push(`GOV-PROGRESS-019_RUN_API_IDENTITY_MISMATCH:${name}`);
    const htmlPrefix = `https://github.com/${expected.repository}/actions/runs/${check.run_id}`;
    if (typeof check.html_url !== 'string' || !check.html_url.startsWith(htmlPrefix)) diagnostics.push(`GOV-PROGRESS-020_RUN_HTML_IDENTITY_MISMATCH:${name}`);
  }

  const authority = evidence.external_authorities?.project_gate;
  if (!authority || typeof authority !== 'object' || Array.isArray(authority)) {
    diagnostics.push('PG-AUTH-EVIDENCE-001_PROJECT_GATE_EVIDENCE_REQUIRED');
  } else {
    if (authority.repository !== authorityLock.repository) diagnostics.push('PG-AUTH-EVIDENCE-002_REPOSITORY_MISMATCH');
    if (authority.repository_id !== authorityLock.repository_id) diagnostics.push('PG-AUTH-EVIDENCE-003_REPOSITORY_ID_MISMATCH');
    if (authority.repository_api_url !== `https://api.github.com/repos/${authorityLock.repository}`) diagnostics.push('PG-AUTH-EVIDENCE-004_REPOSITORY_API_URL_MISMATCH');
    if (authority.commit_sha !== authorityLock.commit_sha) diagnostics.push('PG-AUTH-EVIDENCE-005_COMMIT_MISMATCH');
    if (authority.commit_api_url !== authorityLock.commit_api_url) diagnostics.push('PG-AUTH-EVIDENCE-006_COMMIT_API_URL_MISMATCH');
    if (authority.commit_html_url !== authorityLock.commit_html_url) diagnostics.push('PG-AUTH-EVIDENCE-007_COMMIT_HTML_URL_MISMATCH');
    const files = Array.isArray(authority.files) ? authority.files : [];
    if (!Array.isArray(authority.files)) diagnostics.push('PG-AUTH-EVIDENCE-008_FILES_ARRAY_REQUIRED');
    const byPath = Object.fromEntries(files.map((item) => [item?.path, item]));
    if (unique(files.map((item) => item?.path)).length !== files.length) diagnostics.push('PG-AUTH-EVIDENCE-009_DUPLICATE_FILE_PATH');
    for (const expectedFile of authorityLock.files || []) {
      const actual = byPath[expectedFile.path];
      if (!actual) {
        diagnostics.push(`PG-AUTH-EVIDENCE-010_REQUIRED_FILE_MISSING:${expectedFile.path}`);
        continue;
      }
      if (actual.blob_sha !== expectedFile.blob_sha || actual.git_blob_sha !== expectedFile.blob_sha) diagnostics.push(`PG-AUTH-EVIDENCE-011_BLOB_MISMATCH:${expectedFile.path}`);
      if (!sha64.test(actual.content_sha256 || '')) diagnostics.push(`PG-AUTH-EVIDENCE-012_CONTENT_SHA256_INVALID:${expectedFile.path}`);
      const expectedContentsUrl = `https://api.github.com/repos/${authorityLock.repository}/contents/${expectedFile.path}?ref=${authorityLock.commit_sha}`;
      if (actual.contents_api_url !== expectedContentsUrl) diagnostics.push(`PG-AUTH-EVIDENCE-013_CONTENTS_API_URL_MISMATCH:${expectedFile.path}`);
      if (actual.semantic_substrings_verified !== true) diagnostics.push(`PG-AUTH-EVIDENCE-014_SEMANTIC_CONTENT_NOT_VERIFIED:${expectedFile.path}`);
    }
    if (files.length !== (authorityLock.files || []).length) diagnostics.push('PG-AUTH-EVIDENCE-015_FILE_SET_MISMATCH');
  }
  return unique(diagnostics).sort();
}

function runFixtures() {
  const document = readJson('tests/governance/progress-evidence-cases.json');
  const lock = readJson(AUTHORITY_LOCK_PATH);
  const errors = [];
  for (const testCase of document.cases || []) {
    const evidence = deepMerge(document.base_evidence, testCase.overrides || {});
    const diagnostics = validateProgressEvidence(evidence, document.expected, lock);
    if (testCase.valid === true && diagnostics.length) errors.push(`${testCase.case_id}: ${diagnostics.join(',')}`);
    for (const expectedDiagnostic of testCase.expected_diagnostics || []) {
      if (!diagnostics.some((item) => item === expectedDiagnostic || item.startsWith(`${expectedDiagnostic}:`))) errors.push(`${testCase.case_id}: missing ${expectedDiagnostic}`);
    }
    if (testCase.valid !== true && !diagnostics.length) errors.push(`${testCase.case_id}: unexpectedly passed`);
  }
  if (errors.length) {
    console.error('Governance progress evidence fixtures failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log('Governance progress evidence fixtures passed.');
  console.log(`fixture_cases=${document.cases.length}`);
}

function runLive() {
  const evidenceFile = argumentValue('--evidence-file');
  const repository = argumentValue('--expected-repository');
  const pullRequest = Number(argumentValue('--expected-pr'));
  const headSha = argumentValue('--expected-head');
  if (!evidenceFile || !repository || !Number.isInteger(pullRequest) || !headSha) {
    console.error('Live progress validation requires --evidence-file, --expected-repository, --expected-pr, and --expected-head.');
    process.exit(1);
  }
  const diagnostics = validateProgressEvidence(readJson(evidenceFile), { repository, pull_request: pullRequest, head_sha: headSha });
  if (diagnostics.length) {
    console.error('External exact-head progress evidence failed:');
    for (const diagnostic of diagnostics) console.error(`- ${diagnostic}`);
    process.exit(1);
  }
  console.log('External exact-head progress evidence passed.');
  console.log(`repository=${repository}`);
  console.log(`pull_request=${pullRequest}`);
  console.log(`head_sha=${headSha}`);
  console.log(`upstream_workflows=${UPSTREAM_WORKFLOWS.join(',')}`);
  console.log('project_gate_authority=github_api_commit_blob_verified');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const mode = argumentValue('--mode') || 'fixtures';
  if (mode === 'fixtures') runFixtures();
  else if (mode === 'live') runLive();
  else {
    console.error(`Unsupported mode: ${mode}`);
    process.exit(1);
  }
}
