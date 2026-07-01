#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { finish } from './contract-lib.mjs';

const selectorPattern = /^[A-Za-z0-9_.#\- >]+$/;
const labelPattern = /^[\p{L}\p{N} _.-]{1,80}$/u;
const forbiddenTokenTerms = ['fetch','XMLHttpRequest','sendBeacon','document.cookie','localStorage','sessionStorage','wp.data.dispatch','script'];
const allowedStates = new Set(['CORRECTION','EVIDENCE_REQUIRED','insufficient_evidence','repair','claim_level_verification']);

function readJsonSafe(filePath) {
  try {
    return { value: JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8')), errors: [] };
  } catch (error) {
    return { value: null, errors: [{ id: 'EV4-DR-000', message: `invalid JSON in ${filePath}: ${error.message}` }] };
  }
}

function badToken(value) {
  const text = String(value || '');
  if (/[`"';<>\n\r\\{}()\[\]=,:/]/.test(text)) return true;
  return forbiddenTokenTerms.some((term) => text.toLowerCase().includes(term.toLowerCase()));
}

export function validateRequestObject(r, sourceLabel = '<object>') {
  const errors = [];
  if (!r || typeof r !== 'object' || Array.isArray(r)) {
    errors.push({ id: 'EV4-DR-001', message: `${sourceLabel} must be a JSON object` });
    return errors;
  }
  if (r.schema !== 'ev4-diagnostic-request@1.0.0') errors.push({ id: 'EV4-DR-002', message: 'invalid request schema' });
  if (!allowedStates.has(r.runtime_state)) errors.push({ id: 'EV4-DR-003', message: 'diagnostic request is not in an allowed evidence/correction context' });
  if (r.source !== 'diagnostic_template_registry') errors.push({ id: 'EV4-DR-004', message: 'diagnostic request must source code from registry' });
  if (!Array.isArray(r.targets) || r.targets.length === 0) errors.push({ id: 'EV4-DR-005', message: 'targets must be a non-empty array' });
  const targets = Array.isArray(r.targets) ? r.targets : [];
  for (const target of targets) {
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      errors.push({ id: 'EV4-DR-006', message: 'target must be an object' });
      continue;
    }
    if (!labelPattern.test(String(target.label || '')) || badToken(target.label)) errors.push({ id: 'EV4-DR-007', message: `unsafe label token: ${target.label}` });
    if (!selectorPattern.test(String(target.selector || '')) || badToken(target.selector)) errors.push({ id: 'EV4-DR-008', message: `unsafe selector token: ${target.selector}` });
  }
  return errors;
}

function validateRequest(filePath) {
  const parsed = readJsonSafe(filePath);
  return [...parsed.errors, ...validateRequestObject(parsed.value, filePath)];
}

const errors = [];
const validFiles = fs.existsSync('tests/valid') ? fs.readdirSync('tests/valid').filter((file) => file.startsWith('diagnostic_request_') && file.endsWith('.json')) : [];
for (const file of validFiles) errors.push(...validateRequest(path.join('tests/valid', file)));
const invalidFiles = fs.existsSync('tests/invalid') ? fs.readdirSync('tests/invalid').filter((file) => file.startsWith('diagnostic_request_') && file.endsWith('.json')) : [];
for (const file of invalidFiles) {
  const full = path.join('tests/invalid', file);
  const invalidErrors = validateRequest(full);
  if (invalidErrors.length === 0) errors.push({ id: 'EV4-DR-009', message: `invalid diagnostic request unexpectedly passed: ${full}` });
  else console.log(`Invalid diagnostic request correctly failed: ${full}`);
}
finish('Diagnostic Request Tokens', 'tests/valid/diagnostic_request_*.json', errors);
