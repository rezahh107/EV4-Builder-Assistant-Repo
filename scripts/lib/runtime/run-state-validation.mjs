import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { sha256Bytes, sortedCanonicalJson } from '../canonical-builder-package.mjs';
import { SOURCE_MODES, RUNTIME_MODES } from '../builder-explicit-source-runtime.mjs';
import { checkpointSequenceIsValid } from '../checkpoint-sequence.mjs';
import { runAjv } from '../builder-runtime-transition.mjs';
import {
  ROOT,
  HASH,
  SOURCE_MODE_VALUES,
  FORBIDDEN_TOP_LEVEL_AUTHORITY,
  diagnostic,
  resolveRoot,
  readBytes,
  readJson,
  sameSet,
  digestWithout,
  safeRunRef,
  generationRef,
  deriveFromInternalSnapshot
} from './run-primitives.mjs';

export function runNode(script, ...args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: false
  });
  const detail = result.error?.message || `${result.stderr || ''}\n${result.stdout || ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-12)
    .join(' | ')
    .slice(0, 2400);
  return { passed: !result.error && result.status === 0, detail };
}

export function validateManifestShape(manifest) {
  const diagnostics = [];
  if (manifest?.schema !== 'ev4-builder-run-manifest@1.0.0') diagnostics.push(diagnostic('RUN-MANIFEST-001', 'Unsupported Run manifest schema.'));
  if (typeof manifest?.run_id !== 'string' || !manifest.run_id) diagnostics.push(diagnostic('RUN-MANIFEST-002', 'Run manifest run_id is missing.'));
  if (!SOURCE_MODE_VALUES.has(manifest?.source_mode)) diagnostics.push(diagnostic('RUN-MANIFEST-003', 'Run manifest source_mode is invalid.'));
  if (!HASH.test(manifest?.source_snapshot_sha256 || '')) diagnostics.push(diagnostic('RUN-MANIFEST-004', 'Run manifest source snapshot hash is invalid.'));
  if (manifest?.source_mode === SOURCE_MODES.PROJECT_GATE) {
    if (manifest.receipt_snapshot_ref !== 'source/project-gate-receipt.json' || !HASH.test(manifest.receipt_snapshot_sha256 || '')) diagnostics.push(diagnostic('RUN-MANIFEST-005', 'Project Gate Receipt snapshot binding is invalid.'));
  } else if (manifest?.receipt_snapshot_ref !== null || manifest?.receipt_snapshot_sha256 !== null) {
    diagnostics.push(diagnostic('RUN-MANIFEST-006', 'Non-Project-Gate Run must use null Receipt fields.'));
  }
  if (!HASH.test(manifest?.runtime_context_digest || '') || !HASH.test(manifest?.canonical_package_digest || '')) diagnostics.push(diagnostic('RUN-MANIFEST-007', 'Run manifest Context or Package digest is invalid.'));
  if (!Number.isInteger(manifest?.current_checkpoint_sequence) || manifest.current_checkpoint_sequence < 1) diagnostics.push(diagnostic('RUN-MANIFEST-008', 'Run manifest current_checkpoint_sequence is invalid.'));
  if (!HASH.test(manifest?.manifest_digest || '') || manifest.manifest_digest !== digestWithout(manifest, 'manifest_digest')) diagnostics.push(diagnostic('RUN-MANIFEST-009', 'Run manifest digest is invalid.'));
  const generation = manifest?.generation;
  if (!Number.isInteger(generation?.number) || generation.number < 1 || generation.ref !== generationRef(generation.number)) diagnostics.push(diagnostic('RUN-MANIFEST-010', 'Generation number/ref binding is invalid.'));
  if (generation?.number === 1) {
    if (generation.predecessor_generation !== null || generation.predecessor_checkpoint_id !== null || generation.predecessor_checkpoint_sequence !== null) diagnostics.push(diagnostic('RUN-MANIFEST-011', 'Initial generation predecessor bindings must be null.'));
  } else if (generation.predecessor_generation !== generation.number - 1 || typeof generation.predecessor_checkpoint_id !== 'string' || !Number.isInteger(generation.predecessor_checkpoint_sequence)) {
    diagnostics.push(diagnostic('RUN-MANIFEST-012', 'Successor generation predecessor bindings are invalid.'));
  }
  if (generation?.resulting_checkpoint_id !== manifest?.current_checkpoint_id || generation?.resulting_checkpoint_sequence !== manifest?.current_checkpoint_sequence || generation?.runtime_state !== manifest?.current_runtime_state) diagnostics.push(diagnostic('RUN-MANIFEST-013', 'Generation resulting State bindings are stale.'));
  const ref = generation?.ref;
  if (manifest?.runtime_context_ref !== `${ref}/runtime-context.json` || manifest?.session_ref !== `${ref}/session-state.json` || manifest?.checkpoint_ref !== `${ref}/checkpoint.json`) diagnostics.push(diagnostic('RUN-MANIFEST-014', 'Manifest State refs do not point to its own immutable generation.'));
  return diagnostics;
}

export function validateCurrentPointer(pointer) {
  const diagnostics = [];
  if (pointer?.schema !== 'ev4-builder-current-generation@1.0.0') diagnostics.push(diagnostic('RUN-CURRENT-001', 'Unsupported CURRENT pointer schema.'));
  if (typeof pointer?.run_id !== 'string' || !pointer.run_id) diagnostics.push(diagnostic('RUN-CURRENT-002', 'CURRENT run_id is missing.'));
  if (!Number.isInteger(pointer?.generation) || pointer.generation < 1 || pointer.generation_ref !== generationRef(pointer.generation)) diagnostics.push(diagnostic('RUN-CURRENT-003', 'CURRENT generation binding is invalid.'));
  for (const field of ['manifest_digest', 'context_digest', 'pointer_digest']) if (!HASH.test(pointer?.[field] || '')) diagnostics.push(diagnostic('RUN-CURRENT-004', `CURRENT ${field} is invalid.`));
  if (!HASH.test(pointer?.pointer_digest || '') || pointer.pointer_digest !== digestWithout(pointer, 'pointer_digest')) diagnostics.push(diagnostic('RUN-CURRENT-005', 'CURRENT pointer digest is invalid.'));
  if (!Number.isInteger(pointer?.checkpoint_sequence) || pointer.checkpoint_sequence < 1) diagnostics.push(diagnostic('RUN-CURRENT-006', 'CURRENT checkpoint sequence is invalid.'));
  return diagnostics;
}

export function validateStateFiles(generationDirectory, prefix) {
  const diagnostics = [];
  const sessionFile = path.join(generationDirectory, 'session-state.json');
  const checkpointFile = path.join(generationDirectory, 'checkpoint.json');
  const manifestFile = path.join(generationDirectory, 'run-manifest.json');
  const sessionSchema = runAjv('schemas/session-state.schema.json', sessionFile, [
    'schemas/checkpoint.schema.json',
    'schemas/evidence-record.schema.json',
    'schemas/repair-packet.schema.json'
  ]);
  const checkpointSchema = runAjv('schemas/checkpoint.schema.json', checkpointFile, ['schemas/evidence-record.schema.json']);
  const manifestSchema = runAjv('schemas/run-manifest.schema.json', manifestFile);
  const session = runNode('scripts/validate-session-state.mjs', sessionFile);
  const checkpoint = runNode('scripts/validate-checkpoint.mjs', checkpointFile);
  if (!sessionSchema.passed || !session.passed) diagnostics.push(diagnostic(`${prefix}-SESSION`, 'Session validation failed.', sessionSchema.detail || session.detail));
  if (!checkpointSchema.passed || !checkpoint.passed) diagnostics.push(diagnostic(`${prefix}-CHECKPOINT`, 'Checkpoint validation failed.', checkpointSchema.detail || checkpoint.detail));
  if (!manifestSchema.passed) diagnostics.push(diagnostic(`${prefix}-MANIFEST`, 'Run manifest Schema validation failed.', manifestSchema.detail));
  return diagnostics;
}

export function validateGeneration(runDirectory, generationDirectory, expectedNumber = null) {
  const diagnostics = [];
  let manifest;
  let context;
  let session;
  let checkpoint;
  try {
    manifest = readJson(path.join(generationDirectory, 'run-manifest.json'));
    context = readJson(path.join(generationDirectory, 'runtime-context.json'));
    session = readJson(path.join(generationDirectory, 'session-state.json'));
    checkpoint = readJson(path.join(generationDirectory, 'checkpoint.json'));
  } catch (error) {
    return { passed: false, diagnostics: [diagnostic('RUN-GENERATION-001', 'Generation is incomplete or malformed.', error.message)] };
  }
  diagnostics.push(...validateManifestShape(manifest));
  if (expectedNumber !== null && manifest?.generation?.number !== expectedNumber) diagnostics.push(diagnostic('RUN-GENERATION-002', 'Generation number differs from selected directory.'));
  if (context?.schema !== 'ev4-builder-verified-context@1.0.0' || context?.runtime_mode !== RUNTIME_MODES.REAL) diagnostics.push(diagnostic('RUN-GENERATION-003', 'Runtime Context schema/runtime mode is invalid.'));
  if (!HASH.test(context?.context_digest || '') || context.context_digest !== digestWithout(context, 'context_digest')) diagnostics.push(diagnostic('RUN-GENERATION-004', 'Runtime Context digest is invalid.'));
  if (!checkpointSequenceIsValid(checkpoint)) diagnostics.push(diagnostic('RUN-GENERATION-005', 'Checkpoint sequence/parent shape is invalid.'));
  if (sortedCanonicalJson(session?.last_verified_checkpoint) !== sortedCanonicalJson(checkpoint)) diagnostics.push(diagnostic('RUN-GENERATION-006', 'Session does not embed the exact Checkpoint.'));
  if (session?.session_id !== checkpoint?.session_id) diagnostics.push(diagnostic('RUN-GENERATION-007', 'Session and Checkpoint IDs differ.'));
  if (session?.package_digest !== context?.canonical_package_digest || checkpoint?.package_digest !== context?.canonical_package_digest) diagnostics.push(diagnostic('RUN-GENERATION-008', 'Package binding differs from Context.'));
  if (session?.selected_candidate_id !== context?.selected_candidate_id || checkpoint?.selected_candidate_id !== context?.selected_candidate_id) diagnostics.push(diagnostic('RUN-GENERATION-009', 'Candidate binding differs from Context.'));
  if (checkpoint?.batch_id !== context?.action_batch?.batch_id || manifest?.active_batch_id !== context?.action_batch?.batch_id) diagnostics.push(diagnostic('RUN-GENERATION-010', 'Batch binding differs from Context.'));
  if (session?.runtime_state !== checkpoint?.runtime_state || session?.current_state !== checkpoint?.runtime_state || manifest?.current_runtime_state !== checkpoint?.runtime_state) diagnostics.push(diagnostic('RUN-GENERATION-011', 'Generation State carriers disagree.'));
  if (manifest?.runtime_context_digest !== context?.context_digest || manifest?.current_checkpoint_id !== checkpoint?.checkpoint_id || manifest?.current_checkpoint_sequence !== checkpoint?.checkpoint_sequence) diagnostics.push(diagnostic('RUN-GENERATION-012', 'Manifest active State binding is stale.'));
  if (manifest?.canonical_package_digest !== context?.canonical_package_digest || manifest?.selected_candidate_id !== context?.selected_candidate_id) diagnostics.push(diagnostic('RUN-GENERATION-013', 'Manifest Package/Candidate binding is stale.'));
  diagnostics.push(...validateStateFiles(generationDirectory, 'RUN-GENERATION'));
  return { passed: diagnostics.length === 0, diagnostics, manifest, context, session, checkpoint, generationDirectory, runDirectory };
}

export function validateSnapshots(run, manifest) {
  const diagnostics = [];
  const sourceFile = safeRunRef(run, manifest?.source_snapshot_ref);
  if (!sourceFile || !fs.existsSync(sourceFile)) diagnostics.push(diagnostic('RUN-SNAPSHOT-001', 'Internal source snapshot is missing or unsafe.'));
  else if (sha256Bytes(readBytes(sourceFile)) !== manifest.source_snapshot_sha256) diagnostics.push(diagnostic('RUN-SNAPSHOT-002', 'Internal source snapshot hash differs from Run manifest.'));
  if (manifest?.receipt_snapshot_ref) {
    const receiptFile = safeRunRef(run, manifest.receipt_snapshot_ref);
    if (!receiptFile || !fs.existsSync(receiptFile)) diagnostics.push(diagnostic('RUN-SNAPSHOT-003', 'Internal Receipt snapshot is missing or unsafe.'));
    else if (sha256Bytes(readBytes(receiptFile)) !== manifest.receipt_snapshot_sha256) diagnostics.push(diagnostic('RUN-SNAPSHOT-004', 'Internal Receipt snapshot hash differs from Run manifest.'));
  }
  return diagnostics;
}

export function loadRunUnlocked(runDirectory) {
  const run = resolveRoot(runDirectory);
  const diagnostics = [];
  if (!fs.existsSync(run) || !fs.statSync(run).isDirectory()) return { passed: false, diagnostics: [diagnostic('RUN-LOAD-001', 'Run directory does not exist.')], runDirectory: run };
  for (const filename of FORBIDDEN_TOP_LEVEL_AUTHORITY) if (fs.existsSync(path.join(run, filename))) diagnostics.push(diagnostic('RUN-LOAD-002', `Mutable top-level Authority file is forbidden: ${filename}.`));
  let current;
  try {
    current = readJson(path.join(run, 'CURRENT.json'));
  } catch (error) {
    return { passed: false, diagnostics: [...diagnostics, diagnostic('RUN-LOAD-003', 'CURRENT.json is missing or malformed.', error.message)], runDirectory: run };
  }
  diagnostics.push(...validateCurrentPointer(current));
  const currentSchema = runAjv('schemas/current-generation.schema.json', path.join(run, 'CURRENT.json'));
  if (!currentSchema.passed) diagnostics.push(diagnostic('RUN-LOAD-004', 'CURRENT.json Schema validation failed.', currentSchema.detail));
  const generationDirectory = safeRunRef(run, current.generation_ref);
  if (!generationDirectory || !fs.existsSync(generationDirectory) || !fs.statSync(generationDirectory).isDirectory()) return { passed: false, diagnostics: [...diagnostics, diagnostic('RUN-LOAD-005', 'CURRENT points to a missing or unsafe generation.')], runDirectory: run, current };
  const generation = validateGeneration(run, generationDirectory, current.generation);
  diagnostics.push(...generation.diagnostics);
  if (generation.manifest) {
    if (current.run_id !== generation.manifest.run_id || current.manifest_digest !== generation.manifest.manifest_digest || current.context_digest !== generation.context?.context_digest) diagnostics.push(diagnostic('RUN-LOAD-006', 'CURRENT digest bindings differ from selected generation.'));
    if (current.checkpoint_id !== generation.checkpoint?.checkpoint_id || current.checkpoint_sequence !== generation.checkpoint?.checkpoint_sequence || current.runtime_state !== generation.checkpoint?.runtime_state) diagnostics.push(diagnostic('RUN-LOAD-007', 'CURRENT State binding differs from selected generation.'));
    diagnostics.push(...validateSnapshots(run, generation.manifest));
  }
  return { ...generation, passed: diagnostics.length === 0, diagnostics, runDirectory: run, current };
}

export function fullDeriveAndCompare(loaded) {
  const derivation = deriveFromInternalSnapshot({
    actualRunDirectory: loaded.runDirectory,
    logicalRunDirectory: loaded.runDirectory,
    sourceMode: loaded.manifest.source_mode
  });
  const diagnostics = [...(derivation.diagnostics || [])];
  if (derivation.context && sortedCanonicalJson(derivation.context) !== sortedCanonicalJson(loaded.context)) diagnostics.push(diagnostic('RUN-DERIVE-001', 'Stored Runtime Context differs from full derivation from the internal source snapshot.'));
  if (derivation.context?.selected_candidate_id !== loaded.manifest.selected_candidate_id) diagnostics.push(diagnostic('RUN-DERIVE-002', 'Candidate drift detected.'));
  if (derivation.context?.canonical_package_digest !== loaded.manifest.canonical_package_digest) diagnostics.push(diagnostic('RUN-DERIVE-003', 'Package digest drift detected.'));
  if (derivation.context?.action_batch?.batch_id !== loaded.manifest.active_batch_id) diagnostics.push(diagnostic('RUN-DERIVE-004', 'Batch drift detected.'));
  if (!sameSet(derivation.context?.action_batch?.action_ids, loaded.context?.action_batch?.action_ids)) diagnostics.push(diagnostic('RUN-DERIVE-005', 'Action ID drift detected.'));
  if (sortedCanonicalJson(derivation.context?.action_batch?.action_digests) !== sortedCanonicalJson(loaded.context?.action_batch?.action_digests)) diagnostics.push(diagnostic('RUN-DERIVE-006', 'Action body digest drift detected.'));
  if (derivation.context?.confirmation?.confirmation_id !== loaded.context?.confirmation?.confirmation_id || derivation.context?.confirmation?.expected_user_token !== loaded.context?.confirmation?.expected_user_token) diagnostics.push(diagnostic('RUN-DERIVE-007', 'Confirmation binding drift detected.'));
  return { ...derivation, passed: derivation.passed && diagnostics.length === 0, diagnostics };
}
