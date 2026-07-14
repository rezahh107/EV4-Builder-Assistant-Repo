#!/usr/bin/env node
import fs from 'node:fs';

function unique(values) {
  return [...new Set(values)];
}

export function validateTemplateHygiene(text) {
  const diagnostics = [];
  const requiredFragments = [
    '## Scope Gate',
    '## Progress Gate',
    'exact PR head SHA:',
    'required CI workflow/run evidence:',
    'merge state:',
    'post-merge verification result:',
    '## Trust and overclaim checks',
    '## Decision Escape Route / Behavioral Rule Coverage Check'
  ];
  for (const fragment of requiredFragments) {
    if (!text.includes(fragment)) {
      diagnostics.push(`PR-TEMPLATE-001_REQUIRED_GENERIC_FIELD_MISSING:${fragment}`);
    }
  }
  const forbiddenPatterns = [
    ['PR-TEMPLATE-002_CONCRETE_PR_NUMBER', /\bPR\s*#?\s*\d+\b/i],
    ['PR-TEMPLATE-003_CONCRETE_SHA', /\b[0-9a-f]{40}\b/i],
    ['PR-TEMPLATE-004_CONCRETE_SCOPE_REVISION', /\bGOV-\d{3}-v\d+\b/],
    ['PR-TEMPLATE-005_ONE_OFF_LIFECYCLE_TRANSITION', /committed_now[^\n]*implemented/i],
    ['PR-TEMPLATE-006_ONE_OFF_CLOSURE_REASON', /post_merge_governance_closure/i],
    ['PR-TEMPLATE-007_SELF_ASSERTED_CI_CONFIRMATION', /CI_CONFIRMED_FOR_REVIEWED_HEAD/],
    ['PR-TEMPLATE-008_ONE_OFF_MERGE_FACT', /reviewed_head_tree_preserved:\s*true/i]
  ];
  for (const [diagnostic, pattern] of forbiddenPatterns) {
    if (pattern.test(text)) diagnostics.push(diagnostic);
  }
  return unique(diagnostics).sort();
}

function run() {
  const errors = [];
  const template = fs.readFileSync('.github/pull_request_template.md', 'utf8');
  const templateDiagnostics = validateTemplateHygiene(template);
  if (templateDiagnostics.length) {
    errors.push(`repository_template:${templateDiagnostics.join(',')}`);
  }
  const document = JSON.parse(
    fs.readFileSync('tests/governance/pr-template-hygiene-cases.json', 'utf8')
  );
  for (const testCase of document.cases || []) {
    const diagnostics = validateTemplateHygiene(testCase.text);
    if (testCase.valid === true && diagnostics.length) {
      errors.push(`${testCase.case_id}:${diagnostics.join(',')}`);
    }
    for (const expected of testCase.expected_diagnostics || []) {
      if (!diagnostics.some((item) => item === expected || item.startsWith(`${expected}:`))) {
        errors.push(`${testCase.case_id}:missing ${expected}`);
      }
    }
    if (testCase.valid !== true && !diagnostics.length) {
      errors.push(`${testCase.case_id}:unexpectedly passed`);
    }
  }
  if (errors.length) {
    console.error('Pull request template hygiene validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log('Pull request template hygiene validation passed.');
  console.log(`fixture_cases=${document.cases.length}`);
}

run();
