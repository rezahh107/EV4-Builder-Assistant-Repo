#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { finish } from './contract-lib.mjs';

const registryPath = 'data/diagnostic-templates.v1.json';
const allowedContexts = new Set(['CORRECTION','EVIDENCE_REQUIRED','insufficient_evidence','repair','claim_level_verification']);
const unsafeTerms = [
  'fetch(', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'eval(', 'new Function',
  'localStorage.setItem', 'sessionStorage.setItem', 'document.cookie =',
  'classList.add', 'classList.remove', 'classList.toggle', '.style =',
  'insertAdjacentHTML', 'innerHTML =', 'outerHTML =', 'appendChild', 'remove()',
  'click()', 'submit()', 'wp.data.dispatch', 'setTimeout(', 'setInterval('
];

function readJsonSafe(filePath) {
  try {
    return { value: JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8')), errors: [] };
  } catch (error) {
    return { value: null, errors: [{ id: 'EV4-DT-000', message: `invalid JSON in ${filePath}: ${error.message}` }] };
  }
}

function validateRegistry(filePath) {
  const parsed = readJsonSafe(filePath);
  const errors = [...parsed.errors];
  const registry = parsed.value;
  if (!registry || typeof registry !== 'object' || Array.isArray(registry)) {
    errors.push({ id: 'EV4-DT-001', message: 'registry must be a JSON object' });
    return errors;
  }
  if (registry.schema !== 'ev4-diagnostic-template-registry@1.0.0') errors.push({ id: 'EV4-DT-002', message: 'invalid registry schema' });
  if (!Array.isArray(registry.templates) || registry.templates.length === 0) errors.push({ id: 'EV4-DT-003', message: 'registry.templates must be a non-empty array' });
  const templates = Array.isArray(registry.templates) ? registry.templates : [];
  for (const t of templates) {
    if (!t || typeof t !== 'object' || Array.isArray(t)) {
      errors.push({ id: 'EV4-DT-004', message: 'template entry must be an object' });
      continue;
    }
    const templateId = String(t.template_id || '<missing-template-id>');
    if (t.mode !== 'read_only') errors.push({ id: 'EV4-DT-005', message: `${templateId} must be read_only` });
    const contexts = Array.isArray(t.allowed_contexts) ? t.allowed_contexts : [];
    if (!Array.isArray(t.allowed_contexts) || contexts.length === 0) errors.push({ id: 'EV4-DT-006', message: `${templateId} allowed_contexts must be a non-empty array` });
    for (const c of contexts) if (!allowedContexts.has(c)) errors.push({ id: 'EV4-DT-007', message: `${templateId} has invalid context ${c}` });
    const code = typeof t.code_template === 'string' ? t.code_template : '';
    if (!code) errors.push({ id: 'EV4-DT-008', message: `${templateId} code_template must be a string` });
    const placeholderCount = (code.match(/__EV4_TARGETS_JSON__/g) || []).length;
    if (placeholderCount !== 1) errors.push({ id: 'EV4-DT-009', message: `${templateId} must contain exactly one __EV4_TARGETS_JSON__ placeholder` });
    for (const term of unsafeTerms) {
      if (code.includes(term)) errors.push({ id: 'EV4-DT-010', message: `${templateId} contains unsafe term ${term}` });
    }
  }
  return errors;
}

const errors = validateRegistry(registryPath);
const invalidFiles = fs.existsSync('tests/invalid') ? fs.readdirSync('tests/invalid').filter((file) => file.startsWith('diagnostic_template_') && file.endsWith('.json')) : [];
for (const file of invalidFiles) {
  const full = path.join('tests/invalid', file);
  const invalidErrors = validateRegistry(full);
  if (invalidErrors.length === 0) errors.push({ id: 'EV4-DT-011', message: `invalid diagnostic template unexpectedly passed: ${full}` });
  else console.log(`Invalid diagnostic template correctly failed: ${full}`);
}
finish('Diagnostic Template Registry', registryPath, errors);
