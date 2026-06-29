#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-completion-status.mjs <file>');process.exit(2)}
const c=readJson(f), s=c.states||{}, e=[]; const fail=(id,message)=>e.push({id,message});
if(c.production_ready&&!(c.evidence?.frontend&&c.evidence?.responsive&&c.evidence?.accessibility&&c.evidence?.browser&&c.evidence?.export&&c.evidence?.final_qa)) fail('EV4-CSTATUS-001','production_ready requires separate frontend, responsive, accessibility, browser, export, and final QA evidence.');
if(c.claim_scope==='desktop'&&c.reference_paradigm_lock_present&&s.desktop_reference_paradigm_matched!==true) fail('EV4-CSTATUS-002','desktop complete cannot be claimed before reference paradigm is matched.');
if(c.claim_scope==='section'&&!c.scope_excludes_responsive&&(!s.tablet_checked||!s.mobile_checked)) fail('EV4-CSTATUS-003','section complete requires tablet/mobile checked unless scope excludes them.');
if(c.claim_scope==='acceptable'&&(!c.acceptable_scope||!c.acceptable_checklist)) fail('EV4-CSTATUS-004','acceptable must specify scope and checklist.');
finish('Completion Hierarchy', f, e);
