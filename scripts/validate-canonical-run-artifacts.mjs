#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { computeCanonicalDigest, computePackageDigest, sortedCanonicalJson } from './lib/canonical-builder-package.mjs';
import { initializeAtomicRun, validateCanonicalRun } from './lib/runtime/canonical-run-runtime.mjs';

const ROOT = process.cwd();
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const SCHEMAS = Object.freeze({
  'run-manifest.json': 'schemas/run-manifest.schema.json',
  'real-intake-result.json': 'schemas/real-intake-result.v2.schema.json',
  'emit-batch-result.json': 'schemas/emit-batch-result.v2.schema.json',
  'confirmation-receipt.json': 'schemas/confirmation-receipt.v2.schema.json',
  'confirmation-result.json': 'schemas/confirmation-result.v2.schema.json',
  'evidence-attachment-result.json': 'schemas/evidence-attachment-result.v1.schema.json',
  'completion-result.json': 'schemas/completion-result.v2.schema.json'
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function runAjv(schema, file) {
  const result = spawnSync(NPX, ['--yes', 'ajv-cli@5', 'validate', '--spec=draft2020', '--strict=false', '-s', schema, '-d', file], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    shell: false
  });
  return { passed: !result.error && result.status === 0, detail: result.error?.message || result.stderr || result.stdout || '' };
}

function listJson(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const file = path.join(directory, name);
    if (fs.statSync(file).isDirectory()) files.push(...listJson(file));
    else if (name.endsWith('.json')) files.push(file);
  }
  return files;
}

export function validateRunArtifacts(runDirectory) {
  const run = path.resolve(runDirectory);
  const errors = [];
  const runtime = validateCanonicalRun(run, { fullDerivation: true });
  for (const entry of runtime.diagnostics || []) errors.push(`${entry.code}: ${entry.message}`);
  if (!runtime.manifest || !runtime.context || !runtime.checkpoint) return { passed: false, errors };
  const { manifest, context, checkpoint } = runtime;
  const candidates = [
    path.join(run, 'run-manifest.json'),
    path.join(run, 'real-intake-result.json'),
    ...listJson(path.join(run, 'transitions')).filter((file) => Object.hasOwn(SCHEMAS, path.basename(file))),
    ...listJson(path.join(run, 'outputs')).filter((file) => Object.hasOwn(SCHEMAS, path.basename(file)))
  ];
  const seen = new Set();
  for (const file of candidates) {
    const key = fs.realpathSync(file);
    if (seen.has(key)) continue;
    seen.add(key);
    const name = path.basename(file);
    const schema = SCHEMAS[name];
    const schemaResult = runAjv(schema, file);
    if (!schemaResult.passed) {
      errors.push(`${path.relative(run, file)} failed ${schema}: ${schemaResult.detail.trim()}`);
      continue;
    }
    const value = readJson(file);
    if (name !== 'run-manifest.json' && value.run_id !== manifest.run_id) errors.push(`${name} has foreign run_id.`);
    if (Object.hasOwn(value, 'context_digest') && value.context_digest !== context.context_digest) errors.push(`${name} has stale Context digest.`);
    if (Object.hasOwn(value, 'package_digest') && value.package_digest !== context.canonical_package_digest) errors.push(`${name} has foreign Package digest.`);
    if (Object.hasOwn(value, 'selected_candidate_id') && value.selected_candidate_id !== context.selected_candidate_id) errors.push(`${name} has foreign Candidate.`);
    if (Object.hasOwn(value, 'batch_id') && value.batch_id !== context.action_batch.batch_id) errors.push(`${name} has foreign Batch.`);
    if (value.action_ids && !sameSet(value.action_ids, context.action_batch.action_ids)) errors.push(`${name} has foreign Action IDs.`);
    if (value.action_digests && sortedCanonicalJson(value.action_digests) !== sortedCanonicalJson(context.action_batch.action_digests)) errors.push(`${name} has foreign Action digests.`);
    if (value.publication?.files) {
      for (const relative of value.publication.files) if (!fs.existsSync(path.join(run, relative))) errors.push(`${name} publication file is missing: ${relative}.`);
    }
    if (value.status === 'accepted' && (value.blocking_diagnostics || []).length !== 0) errors.push(`${name} accepted with blocking diagnostics.`);
    if (value.responsive_complete !== undefined && value.responsive_complete !== false) errors.push(`${name} overclaims Responsive completion.`);
    if (value.production_ready !== undefined && value.production_ready !== false) errors.push(`${name} overclaims production readiness.`);
    if (name === 'confirmation-receipt.json') {
      const clone = structuredClone(value);
      delete clone.receipt_digest;
      if (value.receipt_digest !== computeCanonicalDigest(clone)) errors.push('Confirmation Receipt digest is invalid.');
    }
    if (value.resulting_checkpoint?.checkpoint_id === checkpoint.checkpoint_id && value.resulting_checkpoint.checkpoint_sequence !== checkpoint.checkpoint_sequence) errors.push(`${name} current Checkpoint sequence binding is invalid.`);
  }
  return { passed: runtime.passed && errors.length === 0, errors, validated_files: [...seen].length };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function selfTest() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-run-artifact-validation-'));
  try {
    const source = readJson(path.join(ROOT, 'tests/valid/runtime-transaction/carriers/builder_context_package.json'));
    for (const entry of source.source_payload_ledger || []) entry.source_ref = `operator-content:${entry.payload_name}`;
    source.input_authorization.package_digest.value = computePackageDigest(source);
    const sourceFile = path.join(temp, 'builder-input.json');
    const runDirectory = path.join(temp, 'run');
    writeJson(sourceFile, source);
    const intake = initializeAtomicRun({ sourceMode: 'manual-builder-input', builderInputFile: sourceFile, runDirectory });
    if (!intake.passed) throw new Error(JSON.stringify(intake.diagnostics));
    const result = validateRunArtifacts(runDirectory);
    if (!result.passed) throw new Error(result.errors.join(' | '));
    console.log(`Canonical Run artifact validation self-test passed: ${result.validated_files} files.`);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

const runArgument = process.argv[2];
if (!runArgument || runArgument === '--self-test') {
  selfTest();
} else {
  const result = validateRunArtifacts(runArgument);
  if (!result.passed) {
    console.error('Canonical Run artifact validation failed:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`Canonical Run artifact validation passed: ${result.validated_files} files.`);
}
