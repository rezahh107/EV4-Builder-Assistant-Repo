#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
import { ALLOWED_TOKENS } from './render-build-intent-brief.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-build-intent-template.mjs <file>');process.exit(2)}
const r=readJson(f), e=[]; const fail=(id,message)=>e.push({id,message});
const seenTemplates = new Set();
for(const t of r.templates){
 const key = t.template_id + '@' + t.template_version;
 if(seenTemplates.has(key)) fail('EV4-BITPL-004',`duplicate template ID and version: ${key}`);
 seenTemplates.add(key);
 if(t.forbidden_free_text!==true) fail('EV4-BITPL-001','templates must forbid free text.');
 const seen=[...t.template.matchAll(/\{([^}]+)\}/g)].map((m)=>m[1]);
 for(const token of seen) if(!ALLOWED_TOKENS.includes(token)) fail('EV4-BITPL-002',`unknown template token ${token}.`);
 for(const token of t.required_tokens) if(!seen.includes(token)) fail('EV4-BITPL-003',`required token ${token} not present in template.`);
}
finish('Build Intent Template Registry', f, e);
