#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-user-facing-wording.mjs <file>');process.exit(2)}
const w=readJson(f), s=w.completion_status||{}, e=[]; const fail=(id,message)=>e.push({id,message}); const originalMessage=String(w.message||''); const m=originalMessage.toLowerCase();
const safePhrases=['desktop scaffold complete','desktop visual parity pending','desktop reference parity not checked','structure confirmed','control value confirmed','production_ready=false','responsive not_checked','evidence insufficient'];
let scrubbed=m; for(const phrase of safePhrases) scrubbed=scrubbed.replaceAll(phrase.toLowerCase(),'');
const blocked=['تمام شد','complete','completed','done','production-ready','ready','قابل قبول','نهایی','desktop complete','section complete'];
const sortedBlocked = [...blocked].sort((a, b) => b.length - a.length);
for(const term of sortedBlocked){
  const regex = new RegExp('(?<![\\p{L}\\p{N}])' + term + '(?![\\p{L}\\p{N}])', 'ui');
  if(regex.test(scrubbed)&&!(w.allowed_terms||[]).includes(term)){
    if(term.includes('production')&&!s.production_ready) fail('EV4-WORD-001','production-ready wording requires production_ready contract.');
    else if(term.includes('desktop')&&(!s.desktop_reference_paradigm_matched||!s.desktop_visual_parity_checked)) fail('EV4-WORD-002','desktop complete wording requires desktop parity checked.');
    else if(term.includes('section')&&(!s.tablet_checked||!s.mobile_checked)) fail('EV4-WORD-003','section complete wording requires responsive checks.');
    else if(['تمام شد','complete','completed','done','ready','قابل قبول','نهایی'].includes(term)&&!s.production_ready) fail('EV4-WORD-004',`gated completion wording '${term}' requires relevant completion-status allowance.`);
    scrubbed = scrubbed.replace(regex, '');
  }
}
const classLabelPattern=/(کلاس|css\s+classes?|class\s+(?:to\s+apply|name)|elementor\s+class)/iu;
const classTokenPattern=/(\b[a-z][a-z0-9_-]{1,63}\b)/u;
const scopePattern=/(local\s+classes|global\s+classes|محل\s+ثبت\s*:?\s*(?:local|global)|نوع\s+کلاس\s*(?:در\s+elementor)?\s*:?\s*(?:local|global)|elementor\s*>\s*(?:local|global)\s+classes)/iu;
if(classLabelPattern.test(originalMessage)&&classTokenPattern.test(originalMessage)&&!scopePattern.test(originalMessage)) fail('EV4-WORD-005','Elementor class instruction must include Local Classes or Global Classes near the class name.');
finish('User-Facing Status Wording', f, e);
