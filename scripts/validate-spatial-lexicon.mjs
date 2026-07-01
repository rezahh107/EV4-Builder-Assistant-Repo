#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-spatial-lexicon.mjs <file>');process.exit(2)}
const l=readJson(f).spatial_lexicon, e=[]; const fail=(id,message)=>e.push({id,message});
const blocked=['approved_structure_tree','approved_class_map','selected_candidate_id','element_count','reference_paradigm_lock','golden_reference_contract','responsive_strategy','production_ready'];
const seenIds = new Set();
for(const t of l.terms){
 if(seenIds.has(t.id)) fail('EV4-SPLEX-004',`duplicate term ID: ${t.id}`);
 seenIds.add(t.id);
 if(t.may_directly_emit_numeric_value!==false) fail('EV4-SPLEX-001',`${t.id} may not directly emit numeric values.`);
 if(!t.blocked_translation_surface?.length) fail('EV4-SPLEX-002',`${t.id} requires blocked_translation_surface.`);
 if((t.allowed_translation_surface||[]).some((s)=>blocked.includes(s))) fail('EV4-SPLEX-003',`${t.id} cannot allow blocked structural surface ${t.allowed_translation_surface}.`);
}
finish('Spatial Lexicon', f, e);
