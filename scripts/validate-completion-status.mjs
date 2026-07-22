#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/validate-completion-status.mjs <file>');
  process.exit(2);
}

const completion = readJson(file);
const states = completion.states || {};
const errors = [];
const fail = (id, message) => errors.push({ id, message });

if (completion.production_ready && !(completion.evidence?.frontend && completion.evidence?.responsive && completion.evidence?.accessibility && completion.evidence?.browser && completion.evidence?.export && completion.evidence?.final_qa)) {
  fail('EV4-CSTATUS-001', 'production_ready requires separate frontend, responsive, accessibility, browser, export, and final QA evidence.');
}
if (completion.claim_scope === 'desktop' && completion.reference_paradigm_lock_present && states.desktop_reference_paradigm_matched !== true) fail('EV4-CSTATUS-002', 'desktop complete cannot be claimed before reference paradigm is matched.');
if (completion.claim_scope === 'section' && !completion.scope_excludes_responsive && (!states.tablet_checked || !states.mobile_checked)) fail('EV4-CSTATUS-003', 'section complete requires tablet/mobile checked unless scope excludes them.');
if (completion.claim_scope === 'acceptable' && (!completion.acceptable_scope || !completion.acceptable_checklist)) fail('EV4-CSTATUS-004', 'acceptable must specify scope and checklist.');

if (completion.completion_scope === 'desktop_builder_complete') {
  if (completion.claim_scope !== 'desktop') fail('EV4-CSTATUS-101', 'desktop_builder_complete requires claim_scope desktop.');
  if (completion.scope_excludes_responsive !== true) fail('EV4-CSTATUS-102', 'desktop_builder_complete must explicitly exclude Responsive completion.');
  if (completion.responsive_complete !== false) fail('EV4-CSTATUS-103', 'desktop_builder_complete requires responsive_complete false.');
  if (completion.production_ready !== false) fail('EV4-CSTATUS-104', 'desktop_builder_complete requires production_ready false.');
}

finish('Completion Hierarchy', file, errors);
