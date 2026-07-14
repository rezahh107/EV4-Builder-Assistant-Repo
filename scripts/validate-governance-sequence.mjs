#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  parseYamlSubset,
  printFailure,
  readJson,
  readText,
  setDifference,
  setEquals,
  unique,
  validateSchema
} from './governance-lib.mjs';

const RECEIPT_SCHEMA = readJson('governance/schemas/review-receipt.schema.json');
const BASE_SCENARIO = readJson('tests/governance/scenario-base.json');
const CANONICAL_GITHUB_API_ORIGIN = 'https://api.github.com';

function argumentValue(name) {
  const direct = process.argv.find((value) => value.startsWith(`${name}=`));
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
    else if (value && typeof value === 'object') {
      result[key] = deepMerge(result[key], value);
    } else result[key] = value;
  }
  return result;
}

function capabilityMap(capabilities = []) {
  const result = new Map();
  for (const item of capabilities) {
    if (!result.has(item.capability_id)) result.set(item.capability_id, []);
    result.get(item.capability_id).push(item.lifecycle);
  }
  return result;
}

function expectedDisclosure(previous, current) {
  const before = capabilityMap(previous.capabilities);
  const after = capabilityMap(current.capabilities);
  const deleted = setDifference([...before.keys()], [...after.keys()]);
  const introduced = setDifference([...after.keys()], [...before.keys()]);
  const changes = [];
  for (const id of after.keys()) {
    const oldStates = before.get(id);
    const newStates = after.get(id);
    if (
      oldStates?.length === 1
      && newStates?.length === 1
      && oldStates[0] !== newStates[0]
    ) {
      changes.push({ capability_id: id, from: oldStates[0], to: newStates[0] });
    }
  }
  changes.sort((a, b) => a.capability_id.localeCompare(b.capability_id));
  return { deleted, introduced, changes };
}

function evaluateScenario(scenario) {
  const diagnostics = [];
  const previous = scenario.previous || {};
  const current = scenario.current || {};
  const ids = (current.capabilities || []).map((item) => item.capability_id);
  const stateMap = capabilityMap(current.capabilities);
  if (unique(ids).length !== ids.length) {
    diagnostics.push('GOV-SEQ-001_DUPLICATE_CAPABILITY_ID');
  }
  for (const [id, states] of stateMap) {
    if (unique(states).length > 1) {
      diagnostics.push(`GOV-SEQ-002_LIFECYCLE_CONFLICT:${id}`);
    }
  }

  const expected = expectedDisclosure(previous, current);
  if (expected.deleted.length) {
    diagnostics.push(
      `GOV-SEQ-003_SILENT_TARGET_DELETION:${expected.deleted.join(',')}`
    );
  }
  const changed = Boolean(
    expected.deleted.length
    || expected.introduced.length
    || expected.changes.length
    || !setEquals(
      previous.required_check_set || [],
      current.required_check_set || []
    )
  );
  if (changed && previous.scope_revision === current.scope_revision) {
    diagnostics.push('GOV-SEQ-004_SCOPE_REVISION_NOT_BUMPED');
  }

  const disclosure = scenario.scope_disclosure || {};
  const normalize = (item) => ({
    capability_id: item.capability_id ?? null,
    from: item.from ?? null,
    to: item.to ?? null
  });
  const disclosed = [...(disclosure.lifecycle_changes || [])]
    .map(normalize)
    .sort((a, b) => (a.capability_id || '').localeCompare(b.capability_id || ''));
  const computed = expected.changes.map(normalize);
  if (
    disclosure.from_scope_revision !== previous.scope_revision
    || disclosure.to_scope_revision !== current.scope_revision
    || !setEquals(disclosure.deleted_target_ids || [], expected.deleted)
    || !setEquals(disclosure.newly_introduced_target_ids || [], expected.introduced)
    || JSON.stringify(disclosed) !== JSON.stringify(computed)
  ) {
    diagnostics.push('GOV-SEQ-005_SCOPE_DISCLOSURE_MISMATCH');
  }

  const receipt = scenario.review_receipt;
  if (!receipt) diagnostics.push('GOV-SEQ-019_REVIEW_RECEIPT_MISSING');
  else {
    for (const error of validateSchema(
      RECEIPT_SCHEMA,
      receipt,
      '$.review_receipt'
    )) {
      diagnostics.push(`GOV-SEQ-006_REVIEW_RECEIPT_SCHEMA:${error}`);
    }
    if (receipt.reviewed_head_sha !== current.head_sha) {
      diagnostics.push('GOV-SEQ-008_REVIEW_HEAD_MISMATCH_OR_STALE');
    }
    if (receipt.scope_revision !== current.scope_revision) {
      diagnostics.push('GOV-SEQ-009_REVIEW_SCOPE_REVISION_MISMATCH_OR_STALE');
    }
    if (receipt.review_validity !== 'CURRENT') {
      diagnostics.push('GOV-SEQ-028_REVIEW_VALIDITY_NOT_CURRENT');
    }
    if (receipt.technical_status === 'GREEN_TECHNICALLY_READY') {
      const official = scenario.official_verifier || {};
      if (
        official.executed_by !== 'immutable_official_pr_inspector_checkout'
        || official.project_decision !== true
        || official.review_provenance !== true
      ) {
        diagnostics.push('GOV-SEQ-027_OFFICIAL_PR_INSPECTOR_VERIFIER_REQUIRED');
      }
      if (receipt.next_action_kind !== 'merge_now') {
        diagnostics.push('GOV-SEQ-029_GREEN_NOT_MERGE_NOW');
      }
      const checks = scenario.ci?.required_checks || {};
      const required = current.required_check_set || [];
      const exactHeadChecks = (
        scenario.ci?.head_sha === current.head_sha
        && required.every((name) => checks[name] === 'success')
      );
      if (!exactHeadChecks || !(receipt.exact_head_ci_run_ids || []).length) {
        diagnostics.push('GOV-SEQ-010_GREEN_WITHOUT_EXACT_HEAD_CI');
      }
      const completion = scenario.completion || {};
      if (
        !(completion.required_artifacts || []).length
        || !setEquals(
          completion.required_artifacts || [],
          completion.present_artifacts || []
        )
        || !/^[0-9a-f]{40}$/.test(completion.implementation_commit || '')
        || !(completion.ci_run_ids || []).length
      ) {
        diagnostics.push('GOV-SEQ-011_INCOMPLETE_COMPLETION_EVIDENCE');
      }
    }
  }

  if (scenario.claims?.uses_ai_review_signal_as_fact === true) {
    diagnostics.push('GOV-SEQ-013_AI_REVIEW_SIGNAL_USED_AS_FACT');
  }
  if ((scenario.claims?.human_technical_gate_fields || []).length) {
    diagnostics.push(
      `GOV-SEQ-014_HUMAN_TECHNICAL_GATE:${
        scenario.claims.human_technical_gate_fields.join(',')
      }`
    );
  }
  const security = scenario.security || {};
  if (
    security.repository_visibility === 'public'
    && security.public_repository_disposition
      !== 'retain_minimum_security_with_public_repository_hygiene'
  ) diagnostics.push('GOV-SEQ-015_PUBLIC_SECURITY_DISPOSITION_MISSING');
  if (security.contains_secret === true) {
    diagnostics.push('GOV-SEQ-016_SECRET_EXPOSURE');
  }
  if (
    security.destructive_action?.requested === true
    && (
      !security.destructive_action.exact_target
      || !security.destructive_action.recovery_path
    )
  ) diagnostics.push('GOV-SEQ-017_UNBOUNDED_DESTRUCTIVE_ACTION');

  const postMerge = scenario.post_merge_verification;
  if (
    postMerge?.attempted === true
    && (
      postMerge.live_default_branch_contains_reviewed_tree !== true
      || !/^[0-9a-f]{40}$/.test(postMerge.merge_commit || '')
      || postMerge.authorities_synchronized !== true
      || postMerge.claims_within_evidence !== true
    )
  ) diagnostics.push('GOV-SEQ-018_POST_MERGE_VERIFICATION_INCOMPLETE');
  return unique(diagnostics).sort();
}

function validateCanonicalGithubApiOrigin(candidate) {
  let url;
  try { url = new URL(candidate); }
  catch { throw new Error(`untrusted GitHub API origin: ${candidate}`); }
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'api.github.com'
    || url.username
    || url.password
    || url.port
    || url.pathname !== '/'
    || url.search
    || url.hash
    || url.origin !== CANONICAL_GITHUB_API_ORIGIN
  ) throw new Error(`untrusted GitHub API origin: ${candidate}`);
  return url;
}

function rejectCallerControlledApiOrigin(environment = process.env) {
  if (Object.prototype.hasOwnProperty.call(environment, 'GITHUB_API_URL')) {
    throw new Error('GITHUB_API_URL is forbidden.');
  }
}

function rejectRedirect(status, location) {
  if (status >= 300 && status < 400) {
    throw new Error(`GitHub API redirects are forbidden${location ? `: ${location}` : ''}.`);
  }
}

function listJsonFiles(directory) {
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => path.join(directory, name));
}

function matches(actual, expected) {
  return actual === expected || actual.startsWith(`${expected}:`);
}

function parserRegressions() {
  const errors = [];
  const parsed = parseYamlSubset(
    'values:\n  - https://example.com/path\n  - 2026-07-13T18:00:00Z\nempty_array: [ ]\nempty_object: { }\n',
    '<yaml-scalar-regression>'
  );
  if (
    parsed.values?.[0] !== 'https://example.com/path'
    || parsed.values?.[1] !== '2026-07-13T18:00:00Z'
    || !Array.isArray(parsed.empty_array)
    || parsed.empty_array.length
    || !parsed.empty_object
    || Array.isArray(parsed.empty_object)
    || Object.keys(parsed.empty_object).length
  ) errors.push('YAML scalar or empty collection regression failed.');
  for (const name of fs.readdirSync('tests/governance/invalid-yaml')) {
    if (!name.endsWith('.yml')) continue;
    const file = path.join('tests/governance/invalid-yaml', name);
    try {
      parseYamlSubset(readText(file), file);
      errors.push(`${file}: duplicate YAML fixture unexpectedly passed.`);
    } catch (error) {
      const message = String(error.message || error);
      if (!message.includes(file) || !/line \d+/.test(message)) {
        errors.push(`${file}: duplicate diagnostic lacks identity.`);
      }
    }
  }
  const fixture = readJson('tests/governance/invalid/api_origin_failures.json');
  try { validateCanonicalGithubApiOrigin(CANONICAL_GITHUB_API_ORIGIN); }
  catch (error) { errors.push(error.message); }
  for (const origin of fixture.origins || []) {
    try {
      validateCanonicalGithubApiOrigin(origin);
      errors.push(`untrusted API origin unexpectedly passed: ${origin}`);
    } catch { }
    try {
      rejectCallerControlledApiOrigin({ GITHUB_API_URL: origin });
      errors.push(`caller-controlled API origin unexpectedly passed: ${origin}`);
    } catch { }
  }
  try {
    rejectRedirect(302, fixture.cross_origin_redirect);
    errors.push('cross-origin redirect unexpectedly passed.');
  } catch { }
  return errors;
}

function runFixtures() {
  const errors = parserRegressions();
  let validFiles = 0;
  let invalidFiles = 0;
  for (const file of listJsonFiles('tests/governance/valid')) {
    const document = readJson(file);
    if (!Array.isArray(document.scenarios)) continue;
    validFiles += 1;
    for (const entry of document.scenarios) {
      const diagnostics = evaluateScenario(
        deepMerge(BASE_SCENARIO, entry.overrides || {})
      );
      if (diagnostics.length) {
        errors.push(`${file}:${entry.scenario_id}: ${JSON.stringify(diagnostics)}`);
      }
    }
  }
  for (const file of listJsonFiles('tests/governance/invalid')) {
    const document = readJson(file);
    if (!Array.isArray(document.scenarios)) continue;
    invalidFiles += 1;
    for (const entry of document.scenarios) {
      const diagnostics = evaluateScenario(
        deepMerge(BASE_SCENARIO, entry.overrides || {})
      );
      for (const expected of entry.expected_diagnostics || []) {
        if (!diagnostics.some((actual) => matches(actual, expected))) {
          errors.push(`${file}:${entry.scenario_id}: missing ${expected}.`);
        }
      }
      if (!diagnostics.length) {
        errors.push(`${file}:${entry.scenario_id}: unexpectedly passed.`);
      }
    }
  }
  if (errors.length) {
    printFailure('Governance sequence validation failed:', errors);
    process.exit(1);
  }
  console.log('Governance sequence validation passed.');
  console.log(`valid_files=${validFiles}`);
  console.log(`invalid_files=${invalidFiles}`);
  console.log('local_projection_replica=removed');
  console.log('local_evidence_id_replica=removed');
}

const mode = argumentValue('--mode') || 'fixtures';
if (mode === 'fixtures') runFixtures();
else if (mode === 'live') {
  if (argumentValue('--source') === 'github') {
    rejectCallerControlledApiOrigin();
    validateCanonicalGithubApiOrigin(CANONICAL_GITHUB_API_ORIGIN);
    printFailure('Live governance review receipt validation failed:', [
      'GOV-LIVE-030_OFFICIAL_BUNDLE_ACCESSOR_UNAVAILABLE: PR Inspector v1.10.0 exposes no externally retrievable official review-bundle accessor for this repository.'
    ]);
    process.exit(1);
  }
  if (argumentValue('--evidence-file')) {
    printFailure('Live governance review receipt validation failed:', [
      'GOV-LIVE-049_LOCAL_CANONICAL_BUNDLE_ACCEPTANCE_REMOVED: synthetic review verification must run through the immutable official PR Inspector Python verifier.'
    ]);
    process.exit(1);
  }
  printFailure('Live governance review receipt validation failed:', [
    'live mode requires --source=github.'
  ]);
  process.exit(1);
} else {
  printFailure('Governance sequence validation failed:', [
    `unsupported mode: ${mode}.`
  ]);
  process.exit(1);
}
