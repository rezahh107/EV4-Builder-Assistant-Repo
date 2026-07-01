#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
import { renderTemplate } from './render-build-intent-brief.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-build-intent-brief.mjs <file>');process.exit(2)}
const registry=readJson('data/build-intent-templates.fa.json');
const b=readJson(f).build_intent_brief, e=[]; const fail=(id,message)=>e.push({id,message});
const required=['approved_structure_tree','approved_class_map','selected_candidate_id','reference_paradigm_lock','golden_reference_contract','production_ready'];
for(const r of required) if(!b.may_not_override.includes(r)) fail('EV4-BIB-001',`may_not_override must include ${r}.`);
if(b.source==='builder') fail('EV4-BIB-002','Builder-generated design narrative is forbidden.');
const t=registry.templates.find((x)=>x.template_id===b.template_id && x.template_version===b.template_version_used);
if(!t) fail('EV4-BIB-003','pinned template not found.');
if(t){try{const out=renderTemplate(t.template,b.tokens,t.output_max_chars); if(out.rendered_text!==b.rendered_text) fail('EV4-BIB-004','rendered_text does not match deterministic template render.'); if(out.rendered_brief_hash!==b.rendered_brief_hash) fail('EV4-BIB-005','rendered_brief_hash mismatch.');}catch(err){fail('EV4-BIB-006',err.message)}}
finish('Build Intent Brief', f, e);
