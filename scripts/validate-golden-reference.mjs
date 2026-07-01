#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-golden-reference.mjs <file>');process.exit(2)}
const raw=readJson(f), e=[]; const fail=(id,message)=>e.push({id,message});
const c=raw?.golden_reference_contract;
if(!c || typeof c !== 'object' || Array.isArray(c)){
 fail('EV4-GREF-000','Missing golden_reference_contract root object.');
} else {
 if(c.reference_role==='golden_reference_contract' && c.locked!==true) fail('EV4-GREF-001','golden reference contracts must be locked.');
 if(c.reference_role==='golden_reference_contract' && (!c.hard_invariants || c.hard_invariants.length===0)) fail('EV4-GREF-002','locked golden references require hard invariants.');
 if(c.reference_role==='golden_reference_contract' && !c.visual_tolerance_policy) fail('EV4-GREF-003','visual-parity golden references require visual_tolerance_policy.');
 if(!c.source_asset_id || !c.source_asset_digest) fail('EV4-GREF-004','structured visual references require source_asset_id and source_asset_digest.');
 const seenInvariants = new Set();
 for(const inv of Array.isArray(c.hard_invariants) ? c.hard_invariants : []){
  if(seenInvariants.has(inv?.id)) fail('EV4-GREF-006',`duplicate hard invariant ID: ${inv?.id}`);
  seenInvariants.add(inv?.id);
 }
 const metrics = c.visual_tolerance_policy?.metrics;
 if(c.visual_tolerance_policy && !Array.isArray(metrics)) fail('EV4-GREF-008','visual_tolerance_policy.metrics must be an array.');
 const seenMetrics = new Set();
 for(const m of Array.isArray(metrics) ? metrics : []){
  if(seenMetrics.has(m?.metric)) fail('EV4-GREF-007',`duplicate metric name: ${m?.metric}`);
  seenMetrics.add(m?.metric);
  for(const zone of ['pass','ambiguous','major']){
   const z=m?.[zone];
   if(!z || typeof z !== 'object' || Array.isArray(z) || Object.keys(z).length===0 || !Object.values(z).every((v)=>typeof v==='number')) fail('EV4-GREF-005',`metric ${m?.metric} requires numeric ${zone} zone.`);
  }
 }
}
finish('Golden Reference Contract', f, e);
