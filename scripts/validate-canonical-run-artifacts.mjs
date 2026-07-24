#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { runAjv } from './lib/builder-runtime-transition.mjs';
import { validateCanonicalRun } from './lib/runtime/canonical-run-runtime.mjs';
import { completeHappyRun } from './lib/runtime/runtime-test-fixtures.mjs';

const ROOT = process.cwd();
const selfTestRoot = process.argv[2] ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-run-artifact-validator-'));
const runDirectory = process.argv[2] ? path.resolve(ROOT, process.argv[2]) : completeHappyRun(selfTestRoot, 'artifact-validator').runDirectory;
const errors = [];
if (selfTestRoot) process.on('exit', () => fs.rmSync(selfTestRoot, { recursive: true, force: true }));

function fail(message) { errors.push(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function safeRef(ref) {
  if (typeof ref !== 'string' || !ref || path.isAbsolute(ref) || ref.includes('\\')) return null;
  const candidate = path.resolve(runDirectory, ref);
  const relative = path.relative(runDirectory, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return candidate;
}
function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}
function validateSchema(schema, file, refs = []) {
  const result = runAjv(schema, file, refs);
  if (!result.passed) fail(`Schema validation failed for ${path.relative(runDirectory, file)}: ${result.detail}`);
}
function validateJsonRef(ref, expectedSchema, schemaFile = null, refs = []) {
  const file = safeRef(ref);
  if (!file || !fs.existsSync(file)) { fail(`Artifact is missing or unsafe: ${ref}`); return null; }
  let value;
  try { value = readJson(file); }
  catch (error) { fail(`Artifact is malformed: ${ref}: ${error.message}`); return null; }
  if (value?.schema !== expectedSchema) fail(`Artifact Schema differs for ${ref}: ${value?.schema || '<missing>'}`);
  if (schemaFile) validateSchema(schemaFile, file, refs);
  return value;
}
function findFiles(directory, filename) {
  const found = [];
  if (!fs.existsSync(directory)) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...findFiles(file, filename));
    else if (entry.name === filename) found.push(file);
  }
  return found;
}

const loaded = validateCanonicalRun(runDirectory, { fullDerivation: true });
if (!loaded.passed) errors.push(...loaded.diagnostics.map((entry) => `${entry.code}: ${entry.message}${entry.detail ? `: ${entry.detail}` : ''}`));
for (const name of ['run-manifest.json', 'runtime-context.json', 'session-state.json', 'checkpoint.json']) if (fs.existsSync(path.join(runDirectory, name))) fail(`Forbidden mutable top-level Authority file exists: ${name}`);

if (loaded.manifest) {
  validateSchema('schemas/current-generation.schema.json', path.join(runDirectory, 'CURRENT.json'));
  const generations = fs.readdirSync(path.join(runDirectory, 'generations')).filter((name) => /^\d{6}$/.test(name)).sort();
  for (const name of generations) {
    const directory = path.join(runDirectory, 'generations', name);
    const files = fs.readdirSync(directory).sort();
    if (!sameSet(files, ['checkpoint.json', 'run-manifest.json', 'runtime-context.json', 'session-state.json'])) fail(`Generation ${name} has an invalid authoritative file set.`);
    validateSchema('schemas/run-manifest.schema.json', path.join(directory, 'run-manifest.json'));
    validateSchema('schemas/session-state.schema.json', path.join(directory, 'session-state.json'), ['schemas/checkpoint.schema.json', 'schemas/evidence-record.schema.json', 'schemas/repair-packet.schema.json']);
    validateSchema('schemas/checkpoint.schema.json', path.join(directory, 'checkpoint.json'), ['schemas/evidence-record.schema.json']);
  }
  const intakeFiles = findFiles(path.join(runDirectory, 'transitions', 'intake'), 'real-intake-result.json');
  if (intakeFiles.length !== 1) fail(`Expected exactly one real-intake result, found ${intakeFiles.length}.`);
  else validateSchema('schemas/real-intake-result.v2.schema.json', intakeFiles[0]);
  if (loaded.manifest.active_emit_result_ref) validateJsonRef(loaded.manifest.active_emit_result_ref, 'ev4-builder-emit-batch-result@2.0.0', 'schemas/emit-batch-result.v2.schema.json');
  if (loaded.manifest.active_confirmation_receipt_ref) validateJsonRef(loaded.manifest.active_confirmation_receipt_ref, 'ev4-builder-confirmation-receipt@2.0.0', 'schemas/confirmation-receipt.v2.schema.json');
  if (loaded.manifest.active_confirmation_result_ref) validateJsonRef(loaded.manifest.active_confirmation_result_ref, 'ev4-builder-confirmation-result@2.0.0', 'schemas/confirmation-result.v2.schema.json');
  for (const ref of loaded.manifest.evidence_snapshot_refs || []) validateJsonRef(ref, 'ev4-builder-evidence-source@1.0.0');
  for (const ref of loaded.manifest.evidence_attachment_result_refs || []) validateJsonRef(ref, 'ev4-builder-evidence-attachment-result@1.0.0', 'schemas/evidence-attachment-result.v1.schema.json');
  if (loaded.manifest.completion_result_ref) validateJsonRef(loaded.manifest.completion_result_ref, 'ev4-builder-completion-result@2.0.0', 'schemas/completion-result.v2.schema.json');
  if (loaded.manifest.completion_status_ref) validateJsonRef(loaded.manifest.completion_status_ref, 'ev4-builder-derived-completion-status@1.0.0');
  if (loaded.manifest.completion_gate_ref) validateJsonRef(loaded.manifest.completion_gate_ref, 'ev4-builder-derived-completion-gate@1.0.0');
}

if (errors.length) {
  console.error('Canonical Run artifact validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Canonical Run Schemas and shared-planner committed transition exactness validation passed.');
