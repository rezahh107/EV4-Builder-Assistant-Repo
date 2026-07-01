#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const selectorPattern = /^[A-Za-z0-9_.#\- >]+$/;
const labelPattern = /^[\p{L}\p{N} _.-]{1,80}$/u;
const forbiddenTokenTerms = ['fetch','XMLHttpRequest','sendBeacon','document.cookie','localStorage','sessionStorage','wp.data.dispatch','script'];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
  } catch (error) {
    fail(`Invalid JSON: ${filePath}: ${error.message}`);
  }
}

function badToken(value) {
  const text = String(value || '');
  if (/[`"';<>\n\r\\{}()\[\]=,:/]/.test(text)) return true;
  return forbiddenTokenTerms.some((term) => text.toLowerCase().includes(term.toLowerCase()));
}

function validateTargets(targets) {
  if (!Array.isArray(targets) || targets.length === 0) fail('diagnostic targets must be a non-empty array');
  for (const target of targets) {
    if (!target || typeof target !== 'object' || Array.isArray(target)) fail('diagnostic target must be an object');
    if (!labelPattern.test(String(target.label || '')) || badToken(target.label)) fail(`unsafe diagnostic label: ${target.label}`);
    if (!selectorPattern.test(String(target.selector || '')) || badToken(target.selector)) fail(`unsafe diagnostic selector: ${target.selector}`);
  }
}

function readTemplateCode(template) {
  if (typeof template.code_template === 'string') return template.code_template;
  if (template.code_template_encoding !== 'base64' || typeof template.code_template_path !== 'string') fail('diagnostic template must provide code_template or base64 code_template_path');
  if (!/^data\/diagnostic-templates\/[A-Za-z0-9_.-]+\.js\.b64$/.test(template.code_template_path)) fail('invalid diagnostic code_template_path');
  try {
    const encoded = fs.readFileSync(path.resolve(template.code_template_path), 'utf8').trim();
    return Buffer.from(encoded, 'base64').toString('utf8');
  } catch (error) {
    fail(`failed to read diagnostic template file: ${error.message}`);
  }
}

const registryPath = process.argv[2] || 'data/diagnostic-templates.v1.json';
const requestPath = process.argv[3];
if (!requestPath) fail('Usage: node scripts/render-diagnostic-template.mjs <registry.json> <diagnostic-request.json>');

const registry = readJson(registryPath);
const request = readJson(requestPath);
const templates = Array.isArray(registry.templates) ? registry.templates : [];
const template = templates.find((item) => item && item.template_id === request.template_id);
if (!template) fail(`unknown diagnostic template_id: ${request.template_id}`);
if (template.mode !== 'read_only') fail(`diagnostic template is not read_only: ${request.template_id}`);
const allowedContexts = Array.isArray(template.allowed_contexts) ? template.allowed_contexts : [];
if (!allowedContexts.includes(request.runtime_state)) fail(`runtime_state not allowed for diagnostic template: ${request.runtime_state}`);
if (request.source !== 'diagnostic_template_registry') fail('diagnostic request source must be diagnostic_template_registry');
validateTargets(request.targets);
const code = readTemplateCode(template);
const placeholderCount = (code.match(/__EV4_TARGETS_JSON__/g) || []).length;
if (placeholderCount !== 1) fail('diagnostic template must contain exactly one target placeholder');
const rendered = code.replace('__EV4_TARGETS_JSON__', () => JSON.stringify(request.targets));
console.log(rendered);
