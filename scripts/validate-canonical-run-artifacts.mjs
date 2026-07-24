#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { sortedCanonicalJson } from './lib/canonical-builder-package.mjs';
import { runAjv } from './lib/builder-runtime-transition.mjs';
import { validateCanonicalRun } from './lib/runtime/canonical-run-runtime.mjs';

const ROOT = process.cwd();
const runDirectory = path.resolve(ROOT, process.argv[2] || '');
const errors = [];

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
function generationFiles(ref) { return ['checkpoint.json', 'run-manifest.json', 'runtime-context.json', 'session-state.json'].map((name) => `${ref}/${name}`); }
function findGenerationByCheckpoint(checkpointId) {
  const root = path.join(runDirectory, 'generations');
  for (const name of fs.readdirSync(root).sort()) {
    if (!/^\d{6}$/.test(name)) continue;
    const file = path.join(root, name, 'checkpoint.json');
    if (!fs.existsSync(file)) continue;
    const checkpoint = readJson(file);
    if (checkpoint.checkpoint_id === checkpointId) return { number: Number.parseInt(name, 10), ref: `generations/${name}`, checkpoint, manifest: readJson(path.join(root, name, 'run-manifest.json')), context: readJson(path.join(root, name, 'runtime-context.json')), session: readJson(path.join(root, name, 'session-state.json')) };
  }
  return null;
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
function validateSchema(schema, file, refs = []) {
  const result = runAjv(schema, file, refs);
  if (!result.passed) fail(`Schema validation failed for ${path.relative(runDirectory, file)}: ${result.detail}`);
}
function validateResult({ operation, ref, schema, expectedSchema, extraExpected = [] }) {
  const file = safeRef(ref);
  if (!file || !fs.existsSync(file)) { fail(`${operation} artifact is missing or unsafe: ${ref}`); return null; }
  const result = readJson(file);
  validateSchema(schema, file);
  if (result.schema !== expectedSchema || result.status !== 'accepted' || result.blocking_diagnostics?.length !== 0) fail(`${operation} result acceptance fields are invalid.`);
  const generation = findGenerationByCheckpoint(result.resulting_checkpoint?.checkpoint_id);
  if (!generation) { fail(`${operation} resulting generation cannot be located.`); return result; }
  const expected = ['CURRENT.json', ...generationFiles(generation.ref), ref, ...extraExpected].sort();
  if (!sameSet(result.publication?.files, expected)) fail(`${operation} publication set differs from independent canonical expectation.`);
  if (result.run_id !== generation.manifest.run_id) fail(`${operation} Run binding differs from resulting generation.`);
  if (result.context_digest && result.context_digest !== generation.context.context_digest) fail(`${operation} Context binding differs from resulting generation.`);
  if (result.package_digest && result.package_digest !== generation.context.canonical_package_digest) fail(`${operation} Package binding differs from resulting generation.`);
  if (result.selected_candidate_id && result.selected_candidate_id !== generation.context.selected_candidate_id) fail(`${operation} Candidate binding differs from resulting generation.`);
  if (result.batch_id && result.batch_id !== generation.context.action_batch.batch_id) fail(`${operation} Batch binding differs from resulting generation.`);
  if (result.action_ids && !sameSet(result.action_ids, generation.context.action_batch.action_ids)) fail(`${operation} Action ID binding differs from resulting generation.`);
  if (result.action_digests && sortedCanonicalJson(result.action_digests) !== sortedCanonicalJson(generation.context.action_batch.action_digests)) fail(`${operation} Action digest binding differs from resulting generation.`);
  if (result.resulting_checkpoint?.checkpoint_sequence !== generation.checkpoint.checkpoint_sequence || result.resulting_checkpoint?.parent_checkpoint_id !== generation.checkpoint.parent_checkpoint_id) fail(`${operation} resulting Checkpoint lineage differs from generation.`);
  if (generation.number > 1) {
    const predecessor = path.join(runDirectory, 'generations', String(generation.number - 1).padStart(6, '0'), 'checkpoint.json');
    if (!fs.existsSync(predecessor)) fail(`${operation} predecessor generation is missing.`);
    else {
      const checkpoint = readJson(predecessor);
      if (result.predecessor_checkpoint?.checkpoint_id !== checkpoint.checkpoint_id || result.predecessor_checkpoint?.checkpoint_sequence !== checkpoint.checkpoint_sequence) fail(`${operation} predecessor Checkpoint binding is invalid.`);
    }
  }
  if (result.responsive_complete !== false || result.production_ready !== false) fail(`${operation} overclaims Responsive or production readiness.`);
  return result;
}

if (!process.argv[2]) {
  console.error('Usage: node scripts/validate-canonical-run-artifacts.mjs <run-directory>');
  process.exit(2);
}
const loaded = validateCanonicalRun(runDirectory, { fullDerivation: true });
if (!loaded.passed) errors.push(...loaded.diagnostics.map((entry) => `${entry.code}: ${entry.message}`));
for (const name of ['run-manifest.json', 'runtime-context.json', 'session-state.json', 'checkpoint.json']) if (fs.existsSync(path.join(runDirectory, name))) fail(`Forbidden mutable top-level Authority file exists: ${name}`);

if (loaded.passed) {
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
  else {
    const ref = path.relative(runDirectory, intakeFiles[0]).split(path.sep).join('/');
    const result = readJson(intakeFiles[0]);
    const expected = ['CURRENT.json', ...generationFiles('generations/000001'), ref, 'source/selected-source.json', ...(loaded.manifest.source_mode === 'project-gate' ? ['source/project-gate-receipt.json'] : [])].sort();
    validateSchema('schemas/real-intake-result.v2.schema.json', intakeFiles[0]);
    if (!sameSet(result.publication?.files, expected)) fail('real-intake publication set differs from independent canonical expectation.');
    if (result.resulting_checkpoint?.checkpoint_sequence !== 1 || result.resulting_checkpoint?.parent_checkpoint_id !== null) fail('real-intake initial Checkpoint lineage is invalid.');
  }
  if (loaded.manifest.active_emit_result_ref) validateResult({ operation: 'emit-batch', ref: loaded.manifest.active_emit_result_ref, schema: 'schemas/emit-batch-result.v2.schema.json', expectedSchema: 'ev4-builder-emit-batch-result@2.0.0' });
  if (loaded.manifest.active_confirmation_result_ref) {
    validateResult({ operation: 'confirm-batch', ref: loaded.manifest.active_confirmation_result_ref, schema: 'schemas/confirmation-result.v2.schema.json', expectedSchema: 'ev4-builder-confirmation-result@2.0.0', extraExpected: [loaded.manifest.active_confirmation_receipt_ref] });
    const receiptFile = safeRef(loaded.manifest.active_confirmation_receipt_ref);
    if (!receiptFile || !fs.existsSync(receiptFile)) fail('Confirmation Receipt is missing.');
    else validateSchema('schemas/confirmation-receipt.v2.schema.json', receiptFile);
  }
  for (const ref of loaded.manifest.evidence_attachment_result_refs || []) {
    const result = readJson(safeRef(ref));
    validateResult({ operation: 'attach-evidence', ref, schema: 'schemas/evidence-attachment-result.v1.schema.json', expectedSchema: 'ev4-builder-evidence-attachment-result@1.0.0', extraExpected: [result.evidence_snapshot_ref] });
  }
  if (loaded.manifest.completion_result_ref) {
    const result = validateResult({ operation: 'real-completion', ref: loaded.manifest.completion_result_ref, schema: 'schemas/completion-result.v2.schema.json', expectedSchema: 'ev4-builder-completion-result@2.0.0', extraExpected: [loaded.manifest.completion_status_ref, loaded.manifest.completion_gate_ref] });
    if (result?.builder_build_complete !== true || result?.runtime_state !== 'COMPLETED') fail('Completion result is not truthfully terminal.');
    if (loaded.current.runtime_state !== 'COMPLETED') fail('Completion result exists without terminal CURRENT State.');
  }
}
if (errors.length) {
  console.error('Canonical Run artifact validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Canonical Run generations, CURRENT pointer, and independent publication validation passed.');
