#!/usr/bin/env node
import fs from 'node:fs';
import { readJson, finish } from './contract-lib.mjs';
const files=['core/MASTER_PROMPT.md','core/SESSION_STATE_MACHINE.md','protocols/BUILDER_BATCH_OUTPUT_FORMAT.md','protocols/USER_FACING_STATUS_WORDING.md','protocols/VISUAL_PARITY_CHECK.md'];
const text=files.map((f)=>fs.readFileSync(f,'utf8')).join('\n');
const staticErrors=[];
for(const term of ['Golden Reference','Build Intent Brief','تصویر ذهنی','deterministic','must not invent','must not paraphrase']){
 if(!text.includes(term)) staticErrors.push({id:'EV4-RUNTIME-001',message:'runtime files must mention ' + term + '.'});
}
function errorsFor(x){
 const e=[]; const fail=(id,message)=>e.push({id,message});
 if(!x) return e;
 if(x.runtime_response?.includes('تصویر ذهنی') && x.brief_validated!==true) fail('EV4-RUNTIME-002','displays an invalid/unvalidated brief.');
 if(x.runtime_response?.includes('desktop complete') && x.golden_reference_parity_status!=='pass') fail('EV4-RUNTIME-003','allows desktop complete before golden reference parity.');
 if(x.builder_generated_design_narrative===true) fail('EV4-RUNTIME-004','lets Builder generate design narrative.');
 if(x.brief_paraphrased===true) fail('EV4-RUNTIME-005','lets Builder paraphrase rendered_text.');
 if(x.expected_valid===true && x.must_show_brief===true && !x.runtime_response?.includes('تصویر ذهنی')) fail('EV4-RUNTIME-006','must show validated تصویر ذهنی.');
 return e;
}
const all=[...staticErrors];
for(const f of process.argv.slice(2)){
 const x=readJson(f); const errs=errorsFor(x);
 if(x?.expected_valid===false){
  if(errs.length===0) all.push({id:'EV4-RUNTIME-INVALID',message:'Invalid runtime fixture unexpectedly passed: ' + f});
  else console.log('Invalid runtime fixture correctly failed: ' + f);
 } else {
  for(const er of errs) all.push({id:er.id,message:f + ': ' + er.message});
  if(errs.length===0) console.log('Runtime behavior validation passed: ' + f);
 }
}
finish('Runtime Behavior', process.argv.slice(2).join(',')||'runtime files', all);
