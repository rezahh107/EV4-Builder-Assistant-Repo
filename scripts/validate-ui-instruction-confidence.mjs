#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-ui-instruction-confidence.mjs <file>');process.exit(2)}
const u=readJson(f), e=[]; const fail=(id,message)=>e.push({id,message}); const sources=new Set(u.evidence_sources||[]);
const allowed=['visible_in_user_screenshot','directly_user_confirmed','officially_documented_for_context','installed_version_confirmed','previous_successful_same_session_action'];
if(u.ui_path_precision==='exact'&&!allowed.some(x=>sources.has(x))) fail('EV4-UI-001','exact UI path requires sufficient evidence.');
if(u.version_sensitive&&!sources.has('installed_version_confirmed')) fail('EV4-UI-002','version-sensitive controls require installed-version confirmation.');
if((u.control_contradicted_or_missing||u.unknown_layout_parent_label)&&!['CORRECTION','EVIDENCE_REQUIRED'].includes(u.runtime_state)) fail('EV4-UI-003','missing/contradicted controls or unknown layout-parent labels require CORRECTION or EVIDENCE_REQUIRED.');
finish('UI Instruction Confidence Gate', f, e);
