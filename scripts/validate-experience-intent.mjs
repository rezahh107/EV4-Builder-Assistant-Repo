#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-experience-intent.mjs <file>');process.exit(2)}
const raw=readJson(f), e=[]; const fail=(id,message)=>e.push({id,message});
const x=raw?.experience_intent;
const blocked=['approved_structure_tree','approved_class_map','selected_candidate_id','element_count','reference_paradigm_lock','golden_reference_contract','responsive_strategy','production_ready'];
if(!x || typeof x !== 'object' || Array.isArray(x)){
 fail('EV4-XINT-000','Missing experience_intent root object.');
} else {
 const blockedEffectSurface = Array.isArray(x.blocked_effect_surface) ? x.blocked_effect_surface : [];
 const allowedEffectSurface = Array.isArray(x.allowed_effect_surface) ? x.allowed_effect_surface : [];
 for(const s of blocked) if(!blockedEffectSurface.includes(s)) fail('EV4-XINT-001',`blocked_effect_surface must include ${s}.`);
 for(const s of allowedEffectSurface) if(blocked.includes(s)) fail('EV4-XINT-002',`experience intent cannot affect blocked surface ${s}.`);
}
finish('Experience Intent', f, e);
