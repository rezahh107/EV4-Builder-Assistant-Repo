#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  printFailure,
  readJson,
  setDifference,
  setEquals,
  unique,
  validateSchema
} from './governance-lib.mjs';

const RECEIPT_SCHEMA = readJson('governance/schemas/review-receipt.schema.json');
const BASE_SCENARIO = readJson('tests/governance/scenario-base.json');

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
  const previousMap = capabilityMap(previous.capabilities);
  const currentMap = capabilityMap(current.capabilities);
  const previousIds = [...previousMap.keys()];
  const currentIds = [...currentMap.keys()];
  const deletedTargetIds = setDifference(previousIds, currentIds);
  const newlyIntroducedTargetIds = setDifference(currentIds, previousIds);
  const lifecycleChanges = [];

  for (const id of currentIds) {
    const before = previousMap.get(id);
    const after = currentMap.get(id);
    if (before?.length === 1 && after?.length === 1 && before[0] !== after[0]) {
      lifecycleChanges.push({ capability_id: id, from: before[0], to: after[0] });
    }
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
  for (const [id, lifecycles] of currentMap.entries()) {
    if (unique(lifecycles).length > 1) diagnostics.push(`GOV-SEQ-002_LIFECYCLE_CONFLICT:${id}`);
  }

  const expectedDisclosure = expectedScopeDisclosure(previous, current);
  if (expectedDisclosure.deletedTargetIds.length > 0) {
    diagnostics.push(`GOV-SEQ-003_SILENT_TARGET_DELETION:${expectedDisclosure.deletedTargetIds.join(',')}`);
  }

  const changed =
    expectedDisclosure.deletedTargetIds.length > 0 ||
    expectedDisclosure.newlyIntroducedTargetIds.length > 0 ||
    expectedDisclosure.lifecycleChanges.length > 0 ||
    !setEquals(previous.required_check_set || [], current.required_check_set || []);
  if (changed && previous.scope_revision === current.scope_revision) diagnostics.push('GOV-SEQ-004_SCOPE_REVISION_NOT_BUMPED');

  const disclosure = scenario.scope_disclosure || {};
  const disclosedChanges = [...(disclosure.lifecycle_changes || [])].sort((a, b) => a.capability_id.localeCompare(b.capability_id));
  if (
    disclosure.from_scope_revision !== previous.scope_revision ||
    disclosure.to_scope_revision !== current.scope_revision ||
    !setEquals(disclosure.deleted_target_ids || [], expectedDisclosure.deletedTargetIds) ||
    !setEquals(disclosure.newly_introduced_target_ids || [], expectedDisclosure.newlyIntroducedTargetIds) ||
    JSON.stringify(disclosedChanges) !== JSON.stringify(expectedDisclosure.lifecycleChanges)
  ) diagnostics.push('GOV-SEQ-005_SCOPE_DISCLOSURE_MISMATCH');

  const receipt = scenario.review_receipt;
  if (receipt) {
    for (const error of validateSchema(RECEIPT_SCHEMA, receipt, '$.review_receipt')) diagnostics.push(`GOV-SEQ-006_REVIEW_RECEIPT_SCHEMA:${error}`);
    if (receipt.independent !== true || receipt.implementation_context_id === receipt.reviewer_context_id) diagnostics.push('GOV-SEQ-007_REVIEW_NOT_INDEPENDENT');
    if (receipt.reviewed_head_sha !== current.head_sha) diagnostics.push('GOV-SEQ-008_REVIEW_HEAD_MISMATCH_OR_STALE');
    if (receipt.scope_revision !== current.scope_revision) diagnostics.push('GOV-SEQ-009_REVIEW_SCOPE_REVISION_MISMATCH_OR_STALE');

    if (receipt.technical_status === 'GREEN_MERGE_RECOMMENDED') {
      const requiredChecks = current.required_check_set || [];
      const checks = scenario.ci?.required_checks || {};
      const allChecksSuccess = scenario.ci?.head_sha === current.head_sha && requiredChecks.every((name) => checks[name] === 'success') && Object.keys(checks).every((name) => requiredChecks.includes(name));
      if (!allChecksSuccess || (receipt.exact_head_ci_run_ids || []).length === 0) diagnostics.push('GOV-SEQ-010_GREEN_WITHOUT_EXACT_HEAD_CI');

      const completion = scenario.completion || {};
      const requiredArtifacts = completion.required_artifacts || [];
      const presentArtifacts = completion.present_artifacts || [];
      if (requiredArtifacts.length === 0 || !setEquals(requiredArtifacts, presentArtifacts) || !/^[0-9a-f]{40}$/.test(completion.implementation_commit || '') || !Array.isArray(completion.ci_run_ids) || completion.ci_run_ids.length === 0) diagnostics.push('GOV-SEQ-011_INCOMPLETE_COMPLETION_EVIDENCE');
      if ((receipt.findings || []).some((finding) => finding.blocking === true)) diagnostics.push('GOV-SEQ-012_GREEN_WITH_BLOCKING_FINDING');
    }
  }

  if (scenario.claims?.uses_ai_review_signal_as_fact === true) diagnostics.push('GOV-SEQ-013_AI_REVIEW_SIGNAL_USED_AS_FACT');
  const forbiddenHumanFields = scenario.claims?.human_technical_gate_fields || [];
  if (forbiddenHumanFields.length > 0) diagnostics.push(`GOV-SEQ-014_HUMAN_TECHNICAL_GATE:${forbiddenHumanFields.join(',')}`);

  const security = scenario.security || {};
  if (security.repository_visibility === 'public' && security.public_repository_disposition !== 'retain_minimum_security_with_public_repository_hygiene') diagnostics.push('GOV-SEQ-015_PUBLIC_SECURITY_DISPOSITION_MISSING');
  if (security.contains_secret === true) diagnostics.push('GOV-SEQ-016_SECRET_EXPOSURE');
  if (security.destructive_action?.requested === true && (!security.destructive_action.exact_target || !security.destructive_action.recovery_path)) diagnostics.push('GOV-SEQ-017_UNBOUNDED_DESTRUCTIVE_ACTION');

  const postMerge = scenario.post_merge_verification;
  if (postMerge?.attempted === true && (postMerge.live_default_branch_contains_reviewed_tree !== true || !/^[0-9a-f]{40}$/.test(postMerge.merge_commit || '') || postMerge.authorities_synchronized !== true || postMerge.claims_within_evidence !== true)) diagnostics.push('GOV-SEQ-018_POST_MERGE_VERIFICATION_INCOMPLETE');

  return unique(diagnostics).sort();
}

function listJsonFiles(directory) {
  return fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort().map((name) => path.join(directory, name));
}

const errors = [];
for (const filePath of listJsonFiles('tests/governance/valid')) {
  const document = readJson(filePath);
  for (const entry of document.scenarios || []) {
    const scenario = deepMerge(BASE_SCENARIO, entry.overrides || {});
    scenario.scenario_id = entry.scenario_id;
    const diagnostics = evaluateScenario(scenario);
    if (diagnostics.length > 0) errors.push(`${filePath}:${entry.scenario_id}: expected valid, got ${JSON.stringify(diagnostics)}.`);
  }
}
for (const filePath of listJsonFiles('tests/governance/invalid')) {
  const document = readJson(filePath);
  for (const entry of document.scenarios || []) {
    const scenario = deepMerge(BASE_SCENARIO, entry.overrides || {});
    scenario.scenario_id = entry.scenario_id;
    const diagnostics = evaluateScenario(scenario);
    const expected = entry.expected_diagnostics || [];
    for (const code of expected) {
      if (!diagnostics.some((diagnostic) => diagnostic === code || diagnostic.startsWith(`${code}:`))) errors.push(`${filePath}:${entry.scenario_id}: missing expected diagnostic ${code}; got ${JSON.stringify(diagnostics)}.`);
    }
    if (diagnostics.length === 0) errors.push(`${filePath}:${entry.scenario_id}: invalid fixture unexpectedly passed.`);
  }
}

if (errors.length > 0) {
  printFailure('Governance sequence validation failed:', errors);
  process.exit(1);
}
console.log('Governance sequence validation passed.');
console.log(`valid_files=${listJsonFiles('tests/governance/valid').length}`);
console.log(`invalid_files=${listJsonFiles('tests/governance/invalid').length}`);
