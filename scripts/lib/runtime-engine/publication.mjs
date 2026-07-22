import fs from 'node:fs';
import path from 'node:path';
import { RuntimeTransactionError, diagnostic, resolvePath, sameCanonical, stableJson, validateJsonFile } from './common.mjs';

function listFiles(directory, prefix = '') {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const absolute = path.join(directory, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    if (fs.statSync(absolute).isDirectory()) files.push(...listFiles(absolute, relative));
    else files.push(relative);
  }
  return files;
}

function exactDirectoryMatches(directory, files) {
  const expectedNames = Object.keys(files).sort();
  const actualNames = listFiles(directory);
  if (!sameCanonical(expectedNames, actualNames)) return false;
  return expectedNames.every((name) => fs.readFileSync(path.join(directory, name), 'utf8') === files[name]);
}

export function publishAtomicDirectory(outputDirectory, values, validateStage, options = {}) {
  const output = resolvePath(outputDirectory);
  const parent = path.dirname(output);
  const basename = path.basename(output);
  const serialized = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, stableJson(value)]));
  fs.mkdirSync(parent, { recursive: true });

  if (fs.existsSync(output)) {
    if (exactDirectoryMatches(output, serialized)) return { atomic: true, idempotent: true, output_directory: output };
    throw new RuntimeTransactionError('PUBLICATION-CONFLICT', 'Output directory already exists with different transaction carriers.');
  }

  const staging = fs.mkdtempSync(path.join(parent, `.${basename}.tmp-`));
  const failAfter = Number(options.failAfterWrites ?? process.env.EV4_TRANSACTION_FAIL_AFTER_WRITES ?? 0);
  let writes = 0;
  try {
    for (const [name, body] of Object.entries(serialized).sort(([left], [right]) => left.localeCompare(right))) {
      const target = path.join(staging, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, body, { encoding: 'utf8', flag: 'wx' });
      writes += 1;
      if (failAfter > 0 && writes >= failAfter) throw new Error('simulated_atomic_publication_failure');
    }
    validateStage(staging);
    fs.renameSync(staging, output);
    return { atomic: true, idempotent: false, output_directory: output };
  } catch (error) {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
    if (error instanceof RuntimeTransactionError) throw error;
    throw new RuntimeTransactionError('PUBLICATION-FAILED', 'Atomic Runtime Transaction publication failed.', [diagnostic('PUBLICATION-FAILED', 'No terminal carrier was published.', error.message)]);
  }
}

export function validateGeneratedStage(staging, kind) {
  const checks = [
    ['session-state.json', 'schemas/session-state.schema.json', ['schemas/checkpoint.schema.json', 'schemas/evidence-record.schema.json', 'schemas/repair-packet.schema.json'], 'scripts/validate-session-state.mjs'],
    ['checkpoint.json', 'schemas/checkpoint.schema.json', ['schemas/evidence-record.schema.json'], 'scripts/validate-checkpoint.mjs'],
    ['transition-result.json', 'schemas/runtime-transition-result.schema.json', [], null]
  ];
  if (kind === 'completion') checks.push(['completion-result.json', 'schemas/completion-result.v1.schema.json', [], null]);
  if (kind === 'resume') checks.push(['resume-result.json', 'schemas/resume-result.v1.schema.json', [], null]);
  const diagnostics = [];
  for (const [name, schema, refs, semantic] of checks) {
    const result = validateJsonFile(path.join(staging, name), schema, refs, semantic);
    diagnostics.push(...result.diagnostics);
  }
  const generatedSession = JSON.parse(fs.readFileSync(path.join(staging, 'session-state.json'), 'utf8'));
  const generatedCheckpoint = JSON.parse(fs.readFileSync(path.join(staging, 'checkpoint.json'), 'utf8'));
  if (generatedSession.last_verified_checkpoint?.checkpoint_id !== generatedCheckpoint.checkpoint_id || !sameCanonical(generatedSession.last_verified_checkpoint, generatedCheckpoint)) {
    diagnostics.push(diagnostic('GENERATED-CARRIER-BINDING-INVALID', 'Generated Session State is not bound to the exact generated Checkpoint.'));
  }
  if (kind === 'completion') {
    for (const field of ['session_id', 'package_digest', 'source_file_sha256', 'action_ledger_id', 'action_ledger_sequence', 'action_ledger_digest', 'evidence_ledger_digest']) {
      if (generatedCheckpoint[field] === undefined || generatedCheckpoint[field] === null || generatedCheckpoint[field] === '') {
        diagnostics.push(diagnostic('GENERATED-COMPLETION-FIELD-MISSING', `Generated COMPLETED Checkpoint is missing ${field}.`));
      }
    }
    if (generatedSession.runtime_state !== 'COMPLETED' || generatedCheckpoint.runtime_state !== 'COMPLETED') {
      diagnostics.push(diagnostic('GENERATED-COMPLETION-STATE-INVALID', 'Completion publication must contain Engine-generated COMPLETED carriers.'));
    }
  }
  if (diagnostics.length > 0) throw new RuntimeTransactionError('GENERATED-CARRIER-INVALID', 'Generated Runtime Transaction carriers failed validation.', diagnostics);
}
