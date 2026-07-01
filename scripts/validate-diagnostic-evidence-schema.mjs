#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { finish } from './contract-lib.mjs';

const allowedContexts = new Set(['frontend','editor_iframe','editor_parent_shell','unknown']);

function readJsonMaybe(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function validateOutput(filePath) {
  const o = readJsonMaybe(filePath);
  const errors = [];
  if (o.diagnosticType !== 'read-only rendered DOM/computed-style evidence') errors.push({id:'EV4-DE-001', message:'invalid or missing diagnosticType'});
  if (!o.templateId) errors.push({id:'EV4-DE-002', message:'missing templateId'});
  if (!o.templateVersion) errors.push({id:'EV4-DE-003', message:'missing templateVersion'});
  if (!allowedContexts.has(o.executionContext)) errors.push({id:'EV4-DE-004', message:'invalid executionContext'});
  if (!o.viewport || typeof o.viewport.width !== 'number' || typeof o.viewport.height !== 'number' || typeof o.viewport.devicePixelRatio !== 'number') errors.push({id:'EV4-DE-005', message:'invalid viewport'});
  if (!Array.isArray(o.targets) || o.targets.length === 0) errors.push({id:'EV4-DE-006', message:'targets must be non-empty'});
  for (const target of o.targets || []) {
    if (!target.label || !target.selector) errors.push({id:'EV4-DE-007', message:'target missing label or selector'});
    if (!Number.isInteger(target.matchCount) || target.matchCount < 1) errors.push({id:'EV4-DE-008', message:`target ${target.label || ''} matchCount must be at least 1`});
    if (!Array.isArray(target.matches)) errors.push({id:'EV4-DE-009', message:'matches must be an array'});
    if (typeof target.truncated !== 'boolean') errors.push({id:'EV4-DE-010', message:'truncated must be boolean'});
    for (const match of target.matches || []) {
      for (const value of Object.values(match.box || {})) if (typeof value !== 'number') errors.push({id:'EV4-DE-011', message:'box values must be numbers'});
      for (const value of Object.values(match.computed || {})) if (!(typeof value === 'string' || value === null)) errors.push({id:'EV4-DE-012', message:'computed values must be strings or null'});
    }
  }
  return errors;
}

const errors = [];
for (const file of fs.readdirSync('tests/valid').filter(f=>f.startsWith('diagnostic_evidence_')&&f.endsWith('.json'))) {
  errors.push(...validateOutput(path.join('tests/valid', file)));
}
for (const file of fs.readdirSync('tests/invalid').filter(f=>f.startsWith('diagnostic_evidence_')&&f.endsWith('.json'))) {
  const full = path.join('tests/invalid', file);
  try {
    const invalidErrors = validateOutput(full);
    if (invalidErrors.length === 0) errors.push({id:'EV4-DE-013', message:`invalid diagnostic evidence unexpectedly passed: ${full}`});
    else console.log(`Invalid diagnostic evidence correctly failed: ${full}`);
  } catch {
    console.log(`Invalid diagnostic evidence correctly failed JSON parsing: ${full}`);
  }
}
finish('Diagnostic Evidence Output', 'tests/valid/diagnostic_evidence_*.json', errors);
