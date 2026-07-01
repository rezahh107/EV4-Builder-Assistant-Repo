#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-golden-reference.mjs <file>');process.exit(2)}
const c=readJson(f).golden_reference_contract, e=[]; const fail=(id,message)=>e.push({id,message});
if(c.reference_role==='golden_reference_contract' && c.locked!==true) fail('EV4-GREF-001','golden reference contracts must be locked.');
if(c.reference_role==='golden_reference_contract' && (!c.hard_invariants || c.hard_invariants.length===0)) fail('EV4-GREF-002','locked golden references require hard invariants.');
if(c.reference_role==='golden_reference_contract' && !c.visual_tolerance_policy) fail('EV4-GREF-003','visual-parity golden references require visual_tolerance_policy.');
if(!c.source_asset_id || !c.source_asset_digest) fail('EV4-GREF-004','structured visual references require source_asset_id and source_asset_digest.');
for(const m of c.visual_tolerance_policy?.metrics || []){
  for(const zone of ['pass','ambiguous','major']) if(!m[zone] || !Object.values(m[zone]).every((v)=>typeof v==='number')) fail('EV4-GREF-005',`metric ${m.metric} requires numeric ${zone} zone.`);
}
finish('Golden Reference Contract', f, e);
