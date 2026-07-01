#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-visual-parity-check.mjs <file>');process.exit(2)}
const v=readJson(f), e=[]; const fail=(id,message)=>e.push({id,message}); const majors=(v.major_deltas||[]).join(' ').toLowerCase();
if(v.parity_result==='pass'&&(v.major_deltas||[]).length) fail('EV4-VPAR-001','visual parity cannot pass with major deltas.');
if(v.parity_result==='pass'&&(v.hard_invariant_failures||[]).length) fail('EV4-VPAR-006','visual parity cannot pass with hard invariant failures.');
if(v.parity_result==='pass'&&majors.includes('primary anchor')) fail('EV4-VPAR-002','visual parity cannot pass if primary anchor is wrong.');
if(v.parity_result==='pass'&&majors.includes('repeated unit')) fail('EV4-VPAR-003','visual parity cannot pass if repeated unit form is wrong.');
if(v.parity_result==='pass'&&majors.includes('distribution')) fail('EV4-VPAR-004','visual parity cannot pass if distribution model is wrong.');
if(v.connector_checked&&v.card_and_anchor_established!==true) fail('EV4-VPAR-005','connector parity can be checked only after card and anchor placement are established.');
for(const d of v.ambiguous_deltas||[]){ if(d.zone!=='ambiguous'||!d.numeric_tolerance_ref) fail('EV4-VPAR-007','ambiguous deltas require numeric ambiguous-zone tolerance references.'); }
const ambiguousMetrics=new Set((v.ambiguous_deltas||[]).map((d)=>d.metric));
for(const q of v.judgment_prompt_policy?.questions||[]){ if((v.major_deltas||[]).length||(v.hard_invariant_failures||[]).length) fail('EV4-VPAR-008','judgment questions are blocked for major deltas or hard invariant failures.'); if(!ambiguousMetrics.has(q.delta_metric)) fail('EV4-VPAR-009','judgment questions are allowed only for ambiguous deltas.'); }
if(v.desktop_complete_wording_allowed===true && v.golden_reference_parity_status!=='pass') fail('EV4-VPAR-010','desktop complete wording requires passing golden reference parity.');
finish('Visual Parity Checklist', f, e);
