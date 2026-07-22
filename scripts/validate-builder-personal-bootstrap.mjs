#!/usr/bin/env node
import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('manifests/builder-conversation-bootstrap.v1.json', 'utf8'));
const errors = [];
const fail = (code, message) => errors.push({ code, message });

if (manifest.personal_intake_authorization_schema !== 'ev4-builder-intake-authorization@1.0.0') fail('BINS-BOOT-001', 'Unexpected personal intake authorization schema.');
if (manifest.personal_intake_authorization_filename_hint !== 'builder-intake-authorization.json') fail('BINS-BOOT-002', 'Unexpected authorization filename hint.');
if (manifest.personal_intake_authorization_required_for_build_active !== true) fail('BINS-BOOT-003', 'Accepted personal authorization must be required for BUILD_ACTIVE.');
if (manifest.personal_intake_inspector !== 'scripts/builder-inspector.mjs') fail('BINS-BOOT-004', 'Unexpected personal Inspector entrypoint.');

for (const key of ['valid_builder_input_only', 'valid_builder_input_plus_receipt']) {
  const route = manifest.routing_cases?.[key] || {};
  if (route.route !== 'waiting_for_matching_intake_authorization') fail('BINS-BOOT-005', `${key} must wait for matching authorization.`);
  if (route.personal_authorization_required !== true) fail('BINS-BOOT-006', `${key} must require personal authorization.`);
  if (route.normal_builder_batch_allowed !== false) fail('BINS-BOOT-007', `${key} must block normal batches.`);
}

const accepted = manifest.routing_cases?.valid_builder_input_plus_authorization || {};
const expected = {
  route: 'validate_matching_intake_authorization',
  required_authorization_schema: 'ev4-builder-intake-authorization@1.0.0',
  accepted_status_required: true,
  exact_source_byte_binding_required: true,
  canonical_package_digest_binding_required: true,
  selected_candidate_binding_required: true,
  approved_workflow_mode: 'APPROVED_HANDOFF_MODE',
  approved_runtime_state: 'BUILD_ACTIVE'
};
for (const [key, value] of Object.entries(expected)) if (accepted[key] !== value) fail('BINS-BOOT-008', `valid_builder_input_plus_authorization.${key} must equal ${JSON.stringify(value)}.`);

const carriers = [
  'AGENTS.md',
  'README.md',
  'docs/PERSONAL_BUILDER_INSPECTOR.md',
  'dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt'
];
for (const file of carriers) {
  const text = fs.readFileSync(file, 'utf8');
  for (const token of ['builder-intake-authorization.json', 'scripts/builder-inspector.mjs', 'BATCH-001']) {
    if (!text.includes(token)) fail('BINS-BOOT-009', `${file} is missing ${token}.`);
  }
}

if (errors.length) {
  console.error('Builder personal bootstrap validation failed:');
  for (const error of errors) console.error(`- ${error.code}: ${error.message}`);
  process.exit(1);
}
console.log('Builder personal bootstrap validation passed.');
