#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-evidence-claims.mjs <file>');process.exit(2)}
const c=readJson(f), e=[]; const fail=(id,message)=>e.push({id,message}); const s=c.supported_assertions||[];
if(c.evidence_type==='frontend_screenshot'&&s.includes('hidden_control_value')) fail('EV4-EVID-001','frontend screenshot does not prove hidden control values.');
if(['frontend_screenshot','canvas_screenshot'].includes(c.evidence_type)&&s.includes('mobile_ready')&&!s.includes('mobile_visible')) fail('EV4-EVID-002','desktop/frontend screenshot does not prove mobile/tablet readiness.');
if(c.evidence_type==='structure_panel_screenshot'&&s.includes('frontend_render')) fail('EV4-EVID-003','structure panel screenshot proves structure visibility only.');
if(c.evidence_type==='selected_element_screenshot'&&s.includes('final_frontend_visual_parity')) fail('EV4-EVID-004','control screenshot does not prove final frontend visual parity.');
finish('Evidence-to-Claim Gate', f, e);
