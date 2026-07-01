#!/usr/bin/env node
import { readJson, finish } from './contract-lib.mjs';
const f=process.argv[2]; if(!f){console.error('Usage: node scripts/validate-user-facing-wording.mjs <file>');process.exit(2)}
const w=readJson(f), s=w.completion_status||{}, e=[]; const fail=(id,message)=>e.push({id,message}); const m=String(w.message||'').toLowerCase();
const safePhrases=['desktop scaffold complete','desktop visual parity pending','desktop reference parity not checked','structure confirmed','control value confirmed','production_ready=false','responsive not_checked','evidence insufficient'];
let scrubbed=m; for(const phrase of safePhrases) scrubbed=scrubbed.replaceAll(phrase.toLowerCase(),'');
const blocked=['تمام شد','complete','completed','done','production-ready','ready','قابل قبول','نهایی','desktop complete','section complete'];
const sortedBlocked = [...blocked].sort((a, b) => b.length - a.length);
for(const term of sortedBlocked){
  const regex = new RegExp('(?<![\\p{L}\\p{N}])' + term + '(?![\\p{L}\\p{N}])', 'ui');
  if(regex.test(scrubbed)&&!(w.allowed_terms||[]).includes(term)){
    if(term.includes('production')&&!s.production_ready) fail('EV4-WORD-001','production-ready wording requires production_ready contract.');
    else if(term.includes('desktop')&&(!s.desktop_reference_paradigm_matched||!s.desktop_visual_parity_checked||!['pass','not_required'].includes(s.golden_reference_parity_status ?? null))) fail('EV4-WORD-002','desktop complete wording requires desktop parity and passing Golden Reference parity.');
    else if(term.includes('section')&&(!s.tablet_checked||!s.mobile_checked)) fail('EV4-WORD-003','section complete wording requires responsive checks.');
    else if(['تمام شد','complete','completed','done','ready','قابل قبول','نهایی'].includes(term)&&!s.production_ready) fail('EV4-WORD-004','gated completion wording \' + term + '\' requires relevant completion-status allowance.');
    scrubbed = scrubbed.replace(regex, '');
  }
}
finish('User-Facing Status Wording', f, e);
