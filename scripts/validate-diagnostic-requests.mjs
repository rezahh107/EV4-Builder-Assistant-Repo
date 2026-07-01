#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readJson, finish } from './contract-lib.mjs';

const selectorPattern = /^[A-Za-z0-9_.#\- >]+$/;
const labelPattern = /^[\p{L}\p{N} _.-]{1,80}$/u;
const forbiddenTokenTerms = ['fetch','XMLHttpRequest','sendBeacon','document.cookie','localStorage','sessionStorage','wp.data.dispatch','script'];
const allowedStates = new Set(['CORRECTION','EVIDENCE_REQUIRED','insufficient_evidence','repair','claim_level_verification']);

function badToken(value) {
  const text = String(value || '');
  if (/[`"';<>\n\r\\{}()\[\]=,:/]/.test(text)) return true;
  return forbiddenTokenTerms.some(term => text.toLowerCase().includes(term.toLowerCase()));
}

function validateRequest(filePath) {
  const r = readJson(filePath);
  const errors = [];
  if (r.schema !== 'ev4-diagnostic-request@1.0.0') errors.push({id:'EV4-DR-001', message:'invalid request schema'});
  if (!allowedStates.has(r.runtime_state)) errors.push({id:'EV4-DR-002', message:'diagnostic request is not in an allowed evidence/correction context'});
  if (r.source !== 'diagnostic_template_registry') errors.push({id:'EV4-DR-003', message:'diagnostic request must source code from registry'});
  if (!Array.isArray(r.targets) || r.targets.length === 0) errors.push({id:'EV4-DR-004', message:'targets must be non-empty'});
  for (const target of r.targets || []) {
    if (!labelPattern.test(String(target.label || '')) || badToken(target.label)) errors.push({id:'EV4-DR-005', message:`unsafe label token: ${target.label}`});
    if (!selectorPattern.test(String(target.selector || '')) || badToken(target.selector)) errors.push({id:'EV4-DR-006', message:`unsafe selector token: ${target.selector}`});
  }
  return errors;
}

const errors = [];
for (const file of fs.readdirSync('tests/valid').filter(f=>f.startsWith('diagnostic_request_')&&f.endsWith('.json'))) {
  errors.push(...validateRequest(path.join('tests/valid', file)));
}
for (const file of fs.readdirSync('tests/invalid').filter(f=>f.startsWith('diagnostic_request_')&&f.endsWith('.json'))) {
  const full = path.join('tests/invalid', file);
  try {
    const invalidErrors = validateRequest(full);
    if (invalidErrors.length === 0) errors.push({id:'EV4-DR-007', message:`invalid diagnostic request unexpectedly passed: ${full}`});
    else console.log(`Invalid diagnostic request correctly failed: ${full}`);
  } catch {
    console.log(`Invalid diagnostic request correctly failed JSON parsing: ${full}`);
  }
}
finish('Diagnostic Request Tokens', 'tests/valid/diagnostic_request_*.json', errors);
