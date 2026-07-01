#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readJson, finish } from './contract-lib.mjs';

const registryPath = 'data/diagnostic-templates.v1.json';
const allowedContexts = new Set(['CORRECTION','EVIDENCE_REQUIRED','insufficient_evidence','repair','claim_level_verification']);
const unsafeTerms = [
  'fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'eval(', 'new Function',
  'localStorage.setItem', 'sessionStorage.setItem', 'document.cookie =',
  'classList.add', 'classList.remove', 'classList.toggle', '.style =',
  'insertAdjacentHTML', 'innerHTML =', 'outerHTML =', 'appendChild', 'remove()',
  'click()', 'submit()', 'wp.data.dispatch', 'setTimeout(', 'setInterval('
];

function validateRegistry(filePath) {
  const registry = readJson(filePath);
  const errors = [];
  if (registry.schema !== 'ev4-diagnostic-template-registry@1.0.0') errors.push({id:'EV4-DT-001', message:'invalid registry schema'});
  if (!Array.isArray(registry.templates) || registry.templates.length === 0) errors.push({id:'EV4-DT-002', message:'registry requires templates'});
  for (const t of registry.templates || []) {
    if (t.mode !== 'read_only') errors.push({id:'EV4-DT-003', message:`${t.template_id} must be read_only`});
    if (!String(t.code_template || '').includes('__EV4_TARGETS_JSON__')) errors.push({id:'EV4-DT-004', message:`${t.template_id} missing target placeholder`});
    for (const c of t.allowed_contexts || []) if (!allowedContexts.has(c)) errors.push({id:'EV4-DT-005', message:`${t.template_id} has invalid context ${c}`});
    const code = String(t.code_template || '');
    for (const term of unsafeTerms) {
      if (code.includes(term)) errors.push({id:'EV4-DT-006', message:`${t.template_id} contains unsafe term ${term}`});
    }
  }
  return errors;
}

const errors = validateRegistry(registryPath);
for (const file of fs.existsSync('tests/invalid') ? fs.readdirSync('tests/invalid').filter(f=>f.startsWith('diagnostic_template_')&&f.endsWith('.json')) : []) {
  const full = path.join('tests/invalid', file);
  const invalidErrors = validateRegistry(full);
  if (invalidErrors.length === 0) errors.push({id:'EV4-DT-007', message:`invalid diagnostic template unexpectedly passed: ${full}`});
  else console.log(`Invalid diagnostic template correctly failed: ${full}`);
}
finish('Diagnostic Template Registry', registryPath, errors);
