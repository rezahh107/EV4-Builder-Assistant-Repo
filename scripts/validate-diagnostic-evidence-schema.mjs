#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { finish } from './contract-lib.mjs';

const allowedContexts = new Set(['frontend','editor_iframe','editor_parent_shell','unknown']);

function readJsonSafe(filePath) {
  try {
    return { value: JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8')), errors: [] };
  } catch (error) {
    return { value: null, errors: [{ id: 'EV4-DE-000', message: `invalid JSON in ${filePath}: ${error.message}` }] };
  }
}

function validateOutputObject(o, sourceLabel = '<object>') {
  const errors = [];
  if (!o || typeof o !== 'object' || Array.isArray(o)) {
    errors.push({ id: 'EV4-DE-001', message: `${sourceLabel} must be a JSON object` });
    return errors;
  }
  if (o.diagnosticType !== 'read-only rendered DOM/computed-style evidence') errors.push({ id: 'EV4-DE-002', message: 'invalid or missing diagnosticType' });
  if (!o.templateId) errors.push({ id: 'EV4-DE-003', message: 'missing templateId' });
  if (!o.templateVersion) errors.push({ id: 'EV4-DE-004', message: 'missing templateVersion' });
  if (!allowedContexts.has(o.executionContext)) errors.push({ id: 'EV4-DE-005', message: 'invalid executionContext' });
  if (!o.viewport || typeof o.viewport.width !== 'number' || typeof o.viewport.height !== 'number' || typeof o.viewport.devicePixelRatio !== 'number') errors.push({ id: 'EV4-DE-006', message: 'invalid viewport' });
  if (!Array.isArray(o.targets) || o.targets.length === 0) errors.push({ id: 'EV4-DE-007', message: 'targets must be a non-empty array' });
  const targets = Array.isArray(o.targets) ? o.targets : [];
  for (const target of targets) {
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
      errors.push({ id: 'EV4-DE-008', message: 'target must be an object' });
      continue;
    }
    if (!target.label || !target.selector) errors.push({ id: 'EV4-DE-009', message: 'target missing label or selector' });
    if (!Number.isInteger(target.matchCount) || target.matchCount < 1) errors.push({ id: 'EV4-DE-010', message: `target ${target.label || ''} matchCount must be at least 1` });
    if (!Array.isArray(target.matches)) errors.push({ id: 'EV4-DE-011', message: 'matches must be an array' });
    if (typeof target.truncated !== 'boolean') errors.push({ id: 'EV4-DE-012', message: 'truncated must be boolean' });
    const matches = Array.isArray(target.matches) ? target.matches : [];
    for (const match of matches) {
      if (!match || typeof match !== 'object' || Array.isArray(match)) {
        errors.push({ id: 'EV4-DE-013', message: 'match must be an object' });
        continue;
      }
      const box = match.box && typeof match.box === 'object' && !Array.isArray(match.box) ? match.box : {};
      const computed = match.computed && typeof match.computed === 'object' && !Array.isArray(match.computed) ? match.computed : {};
      if (!match.box || typeof match.box !== 'object' || Array.isArray(match.box)) errors.push({ id: 'EV4-DE-014', message: 'box must be an object' });
      if (!match.computed || typeof match.computed !== 'object' || Array.isArray(match.computed)) errors.push({ id: 'EV4-DE-015', message: 'computed must be an object' });
      for (const value of Object.values(box)) if (typeof value !== 'number') errors.push({ id: 'EV4-DE-016', message: 'box values must be numbers' });
      for (const value of Object.values(computed)) if (!(typeof value === 'string' || value === null)) errors.push({ id: 'EV4-DE-017', message: 'computed values must be strings or null' });
    }
  }
  return errors;
}

function validateOutput(filePath) {
  const parsed = readJsonSafe(filePath);
  return [...parsed.errors, ...validateOutputObject(parsed.value, filePath)];
}

const errors = [];
const validFiles = fs.existsSync('tests/valid') ? fs.readdirSync('tests/valid').filter((file) => file.startsWith('diagnostic_evidence_') && file.endsWith('.json')) : [];
for (const file of validFiles) errors.push(...validateOutput(path.join('tests/valid', file)));
const invalidFiles = fs.existsSync('tests/invalid') ? fs.readdirSync('tests/invalid').filter((file) => file.startsWith('diagnostic_evidence_') && file.endsWith('.json')) : [];
for (const file of invalidFiles) {
  const full = path.join('tests/invalid', file);
  const invalidErrors = validateOutput(full);
  if (invalidErrors.length === 0) errors.push({ id: 'EV4-DE-018', message: `invalid diagnostic evidence unexpectedly passed: ${full}` });
  else console.log(`Invalid diagnostic evidence correctly failed: ${full}`);
}
finish('Diagnostic Evidence Output', 'tests/valid/diagnostic_evidence_*.json', errors);
