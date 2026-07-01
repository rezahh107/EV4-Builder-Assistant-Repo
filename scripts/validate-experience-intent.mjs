#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-experience-intent.mjs <file>');process.exit(2)}
const raw=readJson(f), e=[]; const fail=(id,message)=>e.push({id,message});
const x=raw?.experience_intent;
if(!x){
  fail('EV4-XINT-000','Missing experience_intent root object.');
} else {
  const blocked=['approved_structure_tree','approved_class_map','selected_candidate_id','element_count','reference_paradigm_lock','golden_reference_contract','responsive_strategy','production_ready'];
  for(const s of blocked) if(!(x.blocked_effect_surface || []).includes(s)) fail('EV4-XINT-001','blocked_effect_surface must include ' + s + '.');
  for(const s of x.allowed_effect_surface || []) if(blocked.includes(s)) fail('EV4-XINT-002','experience intent cannot affect blocked surface ' + s + '.');
}
finish('Experience Intent', f, e);
