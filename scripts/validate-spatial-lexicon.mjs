#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-spatial-lexicon.mjs <file>');process.exit(2)}
const raw=readJson(f), e=[]; const fail=(id,message)=>e.push({id,message});
const l=raw?.spatial_lexicon;
const blocked=['approved_structure_tree','approved_class_map','selected_candidate_id','element_count','reference_paradigm_lock','golden_reference_contract','responsive_strategy','production_ready'];
if(!l || typeof l !== 'object' || Array.isArray(l)){
 fail('EV4-SPLEX-000','Missing spatial_lexicon root object.');
} else {
 const seenIds = new Set();
 if(!Array.isArray(l.terms)){
  fail('EV4-SPLEX-005','terms must be an array.');
 }
 const terms = Array.isArray(l.terms) ? l.terms : [];
 for(const t of terms){
  const id=t?.id;
  if(seenIds.has(id)) fail('EV4-SPLEX-004',`duplicate term ID: ${id}`);
  seenIds.add(id);
  if(t?.may_directly_emit_numeric_value!==false) fail('EV4-SPLEX-001',`${id} may not directly emit numeric values.`);
  if(!t?.blocked_translation_surface?.length) fail('EV4-SPLEX-002',`${id} requires blocked_translation_surface.`);
  if((t?.allowed_translation_surface||[]).some((s)=>blocked.includes(s))) fail('EV4-SPLEX-003',`${id} cannot allow blocked structural surface ${t.allowed_translation_surface}.`);
 }
}
finish('Spatial Lexicon', f, e);
