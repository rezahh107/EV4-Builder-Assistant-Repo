#!/usr/bin/env node
import fs from 'node:fs';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/validate-elementor-asset-generation-check.mjs <check.json>');
  process.exit(2);
}

const check = JSON.parse(fs.readFileSync(input, 'utf8'));
const errors = [];
const add = code => errors.push(code);
const target = String(check.target_use || '').toLowerCase();
const isElementor = target.includes('elementor');

if (check.schema !== 'ev4-elementor-asset-generation-check@0.1.0') add('EV4-ASSET-001');
if (check.generated_by_builder === true && isElementor && check.knowledge_lookup_performed !== true) add('EV4-ASSET-002');
if (check.asset_type === 'svg' && isElementor && check.compatibility_profile !== 'elementor_safe_svg') add('EV4-ASSET-003');
if (check.official_docs_required === true && check.official_docs_checked !== true) add('EV4-ASSET-004');
if (check.contains_forbidden_features === true && check.safe_to_generate === true) add('EV4-ASSET-005');
if (check.required_features_present === false && check.safe_to_generate === true) add('EV4-ASSET-006');
if (check.local_kb_conflicts_with_official_docs === true && check.safe_to_generate === true) add('EV4-ASSET-007');
if (check.safe_to_generate === true && check.required_next_action !== 'generate_asset') add('EV4-ASSET-008');
if (check.already_generated === true && check.safe_to_generate !== true && check.repair_packet_required !== true) add('EV4-ASSET-009');

if (errors.length > 0) {
  console.error(`Elementor asset generation check failed: ${input}`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Elementor asset generation check passed: ${input}`);
