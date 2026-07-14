#!/usr/bin/env node
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_WORKFLOWS = [
  'Schema validation',
  'Verify Project Gate Contract Pin'
];

function unique(values) {
  return [...new Set(values)];
}

function argumentValue(name) {
  const direct = process.argv.find((value) => value.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function deepMerge(base, override) {
  if (Array.isArray(override)) return structuredClone(override);
  if (!override || typeof override !== 'object') return override;
  const result = structuredClone(base ?? {});
  for (const [key, value] of Object.entries(override)) {
    if (Array.isArray(value)) result[key] = structuredClone(value);
    else if (value && typeof value === 'object') {
      result[key] = deepMerge(result[key], value);
    } else result[key] = value;
  }
  return result;
}

export function validateProgressEvidence(evidence, expected) {
  const diagnostics = [];
  const shaPattern = /^[0-9a-f]{40}$/;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return ['GOV-PROGRESS-001_EVIDENCE_OBJECT_REQUIRED'];
  }
  if (evidence.schema_version !== 1) {
    diagnostics.push('GOV-PROGRESS-002_SCHEMA_VERSION_INVALID');
  }
  if (evidence.source !== 'github_actions_api') {
    diagnostics.push('GOV-PROGRESS-003_SOURCE_NOT_GITHUB_ACTIONS_API');
  }
  if (evidence.repository !== expected.repository) {
    diagnostics.push('GOV-PROGRESS-004_REPOSITORY_MISMATCH');
  }
  if (evidence.pull_request !== expected.pull_request) {
    diagnostics.push('GOV-PROGRESS-005_PULL_REQUEST_MISMATCH');
  }
  if (!shaPattern.test(evidence.head_sha || '') || evidence.head_sha !== expected.head_sha) {
    diagnostics.push('GOV-PROGRESS-006_HEAD_MISMATCH_OR_STALE');
  }
  const expectedPrUrl = `https://api.github.com/repos/${expected.repository}/pulls/${expected.pull_request}`;
  if (evidence.pull_request_api_url !== expectedPrUrl) {
    diagnostics.push('GOV-PROGRESS-007_PULL_REQUEST_API_IDENTITY_MISMATCH');
  }

  const checks = Array.isArray(evidence.required_checks)
    ? evidence.required_checks
    : [];
  if (!Array.isArray(evidence.required_checks)) {
    diagnostics.push('GOV-PROGRESS-008_REQUIRED_CHECKS_ARRAY_REQUIRED');
  }
  const names = checks.map((item) => item?.workflow_name);
  const runIds = checks.map((item) => item?.run_id);
  if (unique(names).length !== names.length) {
    diagnostics.push('GOV-PROGRESS-009_DUPLICATE_WORKFLOW_IDENTITY');
  }
  if (unique(runIds).length !== runIds.length) {
    diagnostics.push('GOV-PROGRESS-010_DUPLICATE_RUN_IDENTITY');
  }
  const expectedNames = [...REQUIRED_WORKFLOWS].sort();
  if (JSON.stringify([...names].sort()) !== JSON.stringify(expectedNames)) {
    diagnostics.push('GOV-PROGRESS-011_REQUIRED_WORKFLOW_SET_MISMATCH');
  }

  for (const check of checks) {
    const name = check?.workflow_name || '<missing>';
    if (!Number.isInteger(check?.run_id) || check.run_id < 1) {
      diagnostics.push(`GOV-PROGRESS-012_RUN_ID_INVALID:${name}`);
      continue;
    }
    if (check.repository !== expected.repository) {
      diagnostics.push(`GOV-PROGRESS-013_CHECK_REPOSITORY_MISMATCH:${name}`);
    }
    if (check.pull_request !== expected.pull_request) {
      diagnostics.push(`GOV-PROGRESS-014_CHECK_PULL_REQUEST_MISMATCH:${name}`);
    }
    if (check.head_sha !== expected.head_sha) {
      diagnostics.push(`GOV-PROGRESS-015_CHECK_HEAD_MISMATCH_OR_STALE:${name}`);
    }
    if (check.event !== 'pull_request') {
      diagnostics.push(`GOV-PROGRESS-016_CHECK_EVENT_INVALID:${name}`);
    }
    if (check.status !== 'completed') {
      diagnostics.push(`GOV-PROGRESS-017_CHECK_NOT_COMPLETED:${name}`);
    }
    if (check.conclusion !== 'success') {
      diagnostics.push(`GOV-PROGRESS-018_CHECK_NOT_SUCCESSFUL:${name}`);
    }
    const apiUrl = `https://api.github.com/repos/${expected.repository}/actions/runs/${check.run_id}`;
    if (check.run_api_url !== apiUrl) {
      diagnostics.push(`GOV-PROGRESS-019_RUN_API_IDENTITY_MISMATCH:${name}`);
    }
    const htmlPrefix = `https://github.com/${expected.repository}/actions/runs/${check.run_id}`;
    if (typeof check.html_url !== 'string' || !check.html_url.startsWith(htmlPrefix)) {
      diagnostics.push(`GOV-PROGRESS-020_RUN_HTML_IDENTITY_MISMATCH:${name}`);
    }
  }
  return unique(diagnostics).sort();
}

function runFixtures() {
  const document = readJson(
    'tests/governance/progress-evidence-cases.json'
  );
  const errors = [];
  for (const testCase of document.cases || []) {
    const evidence = deepMerge(
      document.base_evidence,
      testCase.overrides || {}
    );
    const diagnostics = validateProgressEvidence(evidence, document.expected);
    if (testCase.valid === true && diagnostics.length) {
      errors.push(`${testCase.case_id}: ${diagnostics.join(',')}`);
    }
    for (const expectedDiagnostic of testCase.expected_diagnostics || []) {
      if (!diagnostics.some((item) => item === expectedDiagnostic || item.startsWith(`${expectedDiagnostic}:`))) {
        errors.push(`${testCase.case_id}: missing ${expectedDiagnostic}`);
      }
    }
    if (testCase.valid !== true && !diagnostics.length) {
      errors.push(`${testCase.case_id}: unexpectedly passed`);
    }
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
  const diagnostics = validateProgressEvidence(readJson(evidenceFile), {
    repository,
    pull_request: pullRequest,
    head_sha: headSha
  });
  if (diagnostics.length) {
    console.error('External exact-head progress evidence failed:');
    for (const diagnostic of diagnostics) console.error(`- ${diagnostic}`);
    process.exit(1);
  }
  console.log('External exact-head progress evidence passed.');
  console.log(`repository=${repository}`);
  console.log(`pull_request=${pullRequest}`);
  console.log(`head_sha=${headSha}`);
  console.log(`required_workflows=${REQUIRED_WORKFLOWS.join(',')}`);
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const mode = argumentValue('--mode') || 'fixtures';
  if (mode === 'fixtures') runFixtures();
  else if (mode === 'live') runLive();
  else {
    console.error(`Unsupported mode: ${mode}`);
    process.exit(1);
  }
}
