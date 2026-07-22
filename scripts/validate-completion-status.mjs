#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/validate-completion-status.mjs <file>');
  process.exit(2);
}

const completion = readJson(filePath);
const states = completion.states || {};
const errors = [];
const fail = (id, message) => errors.push({ id, message });

if (completion.production_ready && !(completion.evidence?.frontend && completion.evidence?.responsive && completion.evidence?.accessibility && completion.evidence?.browser && completion.evidence?.export && completion.evidence?.final_qa)) {
  fail('EV4-CSTATUS-001', 'production_ready requires separate frontend, responsive, accessibility, browser, export, and final QA evidence.');
}

if (completion.claim_scope === 'desktop') {
  const requiredBuilderStates = ['scaffold_built', 'structure_built', 'content_filled', 'desktop_layout_established', 'export_checked'];
  for (const state of requiredBuilderStates) {
    if (states[state] !== true) fail('EV4-CSTATUS-002', `desktop Builder completion requires ${state}=true.`);
  }
  if (completion.evidence?.export !== true) fail('EV4-CSTATUS-003', 'desktop Builder completion requires export evidence truth.');
  if (completion.scope_excludes_responsive !== true) fail('EV4-CSTATUS-004', 'desktop Builder completion must explicitly exclude Responsive completion.');
  if (completion.production_ready !== false) fail('EV4-CSTATUS-005', 'desktop Builder completion must keep production_ready=false.');
  if (completion.reference_paradigm_lock_present && states.desktop_reference_paradigm_matched !== true) {
    fail('EV4-CSTATUS-006', 'desktop Builder completion cannot claim a locked reference paradigm before it is matched.');
  }
}

if (completion.claim_scope === 'section' && !completion.scope_excludes_responsive && (!states.tablet_checked || !states.mobile_checked)) {
  fail('EV4-CSTATUS-007', 'section complete requires tablet/mobile checked unless scope excludes them.');
}

if (completion.claim_scope === 'acceptable' && (!completion.acceptable_scope || !completion.acceptable_checklist)) {
  fail('EV4-CSTATUS-008', 'acceptable must specify scope and checklist.');
}

finish('Completion Hierarchy', filePath, errors);
