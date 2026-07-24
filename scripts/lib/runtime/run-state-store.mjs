import fs from 'node:fs';
import path from 'node:path';

import { computeCanonicalDigest, sha256Bytes } from '../canonical-builder-package.mjs';
import { SOURCE_MODES } from '../builder-explicit-source-runtime.mjs';
import * as primitives from './run-primitives.mjs';
import {
  validateGeneration,
  loadRunUnlocked
} from './run-state-validation.mjs';

const {
  ROOT, ACTIVE_STATE_FILENAMES, diagnostic, resolveRoot, relativeRoot, stableJson, readBytes, readJson, writeJson, writeBytes,
  sameSet, safeRunRef, generationName, generationRef, sleepSync, injectedPoint,
  fsyncFile, fsyncDirectory, validateCanonicalSourceModeArguments, deriveFromInternalSnapshot,
  collectInitialBlockers, buildCheckpoint, buildSession, buildManifest, buildCurrentPointer
} = primitives;

export function expectedPublicationFiles(operation, refs) {
  const generationFiles = ACTIVE_STATE_FILENAMES.map((name) => `${refs.generation_ref}/${name}`);
  if (operation === 'real-intake') return ['CURRENT.json', ...generationFiles, refs.result_ref, 'source/selected-source.json', ...(refs.receipt_ref ? [refs.receipt_ref] : [])].sort();
  if (operation === 'emit-batch') return ['CURRENT.json', ...generationFiles, refs.result_ref].sort();
  if (operation === 'confirm-batch') return ['CURRENT.json', ...generationFiles, refs.receipt_ref, refs.result_ref].sort();
  if (operation === 'attach-evidence') return ['CURRENT.json', ...generationFiles, refs.evidence_ref, refs.result_ref].sort();
  if (operation === 'real-completion') return ['CURRENT.json', ...generationFiles, refs.result_ref, refs.status_ref, refs.gate_ref].sort();
  throw new Error(`Unsupported publication operation: ${operation}`);
}

export function validatePublication(result, operation, refs, expectedSchema, expectedRunId) {
  const diagnostics = [];
  const expectedFiles = expectedPublicationFiles(operation, refs);
  if (result?.schema !== expectedSchema) diagnostics.push(diagnostic('RUN-ARTIFACT-001', `Expected ${expectedSchema}.`));
  if (result?.run_id !== expectedRunId) diagnostics.push(diagnostic('RUN-ARTIFACT-002', 'Generated artifact Run ID is incorrect.'));
  if (result?.status !== 'accepted' || (result?.blocking_diagnostics || []).length !== 0) diagnostics.push(diagnostic('RUN-ARTIFACT-003', 'Generated accepted artifact is not truthfully accepted.'));
  if (!sameSet(result?.publication?.files, expectedFiles)) diagnostics.push(diagnostic('RUN-ARTIFACT-004', 'Generated artifact publication file set is incorrect.'));
  if (result?.responsive_complete !== false || result?.production_ready !== false) diagnostics.push(diagnostic('RUN-ARTIFACT-005', 'Generated artifact overclaims Responsive or production readiness.'));
  return diagnostics;
}

export function lockResult(operation, code = 'RUN_BUSY_OR_STALE_LOCK') {
  return {
    passed: false,
    status: 'blocked',
    operation,
    state_modified: false,
    diagnostics: [diagnostic(code, 'Run mutation lock is already held. No State was loaded or modified.')]
  };
}

export function acquireRunLock(runDirectory, operation) {
  const run = resolveRoot(runDirectory);
  const lockDirectory = path.join(run, '.mutation-lock');
  try {
    fs.mkdirSync(lockDirectory, { recursive: false });
  } catch (error) {
    if (error?.code === 'EEXIST') return { passed: false, result: lockResult(operation) };
    throw error;
  }
  const metadata = {
    schema: 'ev4-builder-local-run-lock@1.0.0',
    run_id: null,
    operation,
    process_id: process.pid,
    created_at: new Date().toISOString()
  };
  try {
    const current = readJson(path.join(run, 'CURRENT.json'));
    metadata.run_id = current.run_id;
  } catch {
    // The subsequent authoritative load reports malformed State.
  }
  writeJson(path.join(lockDirectory, 'lock.json'), metadata, 'wx');
  const hold = Number.parseInt(process.env.EV4_BUILDER_TEST_HOLD_LOCK_MS || '0', 10);
  if (hold > 0) sleepSync(hold);
  return { passed: true, lockDirectory };
}

export function releaseRunLock(lockDirectory) {
  if (lockDirectory && fs.existsSync(lockDirectory)) fs.rmSync(lockDirectory, { recursive: true, force: true });
}

export function mutationFailure(loaded, operation, error) {
  let activeGeneration = null;
  try {
    const current = readJson(path.join(loaded?.runDirectory || resolveRoot(loaded), 'CURRENT.json'));
    activeGeneration = current.generation;
  } catch {
    // Keep null when CURRENT cannot be read.
  }
  return {
    ...(loaded && typeof loaded === 'object' ? loaded : {}),
    passed: false,
    operation,
    failure_stage: error?.failureStage || null,
    expected_diagnostic_code: error?.code || null,
    active_generation_after_failure: activeGeneration,
    diagnostics: [diagnostic(
      error?.code === 'RUN-INJECTED-FAILURE' ? 'RUN-INJECTED-FAILURE' : `RUN-${operation.toUpperCase().replaceAll('-', '_')}-FAILURE`,
      `${operation} failed; CURRENT remains the sole authority.`,
      error?.message || String(error)
    )]
  };
}

export function writeAuxiliaryFiles(run, files) {
  for (const entry of files) {
    const target = safeRunRef(run, entry.ref);
    if (!target) throw new Error(`Unsafe auxiliary publication ref: ${entry.ref}`);
    const expected = entry.kind === 'bytes' ? Buffer.from(entry.value) : Buffer.from(stableJson(entry.value), 'utf8');
    if (fs.existsSync(target)) {
      const actual = readBytes(target);
      if (!actual.equals(expected)) throw new Error(`Existing orphan auxiliary artifact differs from retry content: ${entry.ref}`);
      continue;
    }
    writeBytes(target, expected, 'wx');
    fsyncFile(target);
  }
}

export function publishSuccessor({ loaded, operation, context, session, checkpoint, manifestUpdates, result, auxiliaryFiles, failureInjection }) {
  const run = loaded.runDirectory;
  const predecessorNumber = loaded.current.generation;
  const nextNumber = predecessorNumber + 1;
  const nextRef = generationRef(nextNumber);
  const finalGeneration = path.join(run, nextRef);
  const temporaryGeneration = path.join(run, 'generations', `.tmp-${generationName(nextNumber)}-${process.pid}-${Date.now()}`);
  const currentTemporary = path.join(run, `CURRENT.tmp-${process.pid}-${Date.now()}`);
  const manifest = buildManifest({
    previousManifest: loaded.manifest,
    runId: loaded.manifest.run_id,
    sourceMode: loaded.manifest.source_mode,
    sourceSha: loaded.manifest.source_snapshot_sha256,
    receiptSha: loaded.manifest.receipt_snapshot_sha256,
    context,
    checkpoint,
    generationNumber: nextNumber,
    predecessorGeneration: predecessorNumber,
    predecessorCheckpointId: loaded.checkpoint.checkpoint_id,
    predecessorCheckpointSequence: loaded.checkpoint.checkpoint_sequence,
    updates: manifestUpdates
  });
  try {
    writeAuxiliaryFiles(run, auxiliaryFiles);
    fs.mkdirSync(temporaryGeneration, { recursive: false });
    writeJson(path.join(temporaryGeneration, 'runtime-context.json'), context, 'wx');
    writeJson(path.join(temporaryGeneration, 'session-state.json'), session, 'wx');
    writeJson(path.join(temporaryGeneration, 'checkpoint.json'), checkpoint, 'wx');
    writeJson(path.join(temporaryGeneration, 'run-manifest.json'), manifest, 'wx');
    injectedPoint(failureInjection, 'after_successor_temp_write');
    const validation = validateGeneration(run, temporaryGeneration, nextNumber);
    if (!validation.passed) throw new Error(`Successor generation validation failed: ${JSON.stringify(validation.diagnostics)}`);
    injectedPoint(failureInjection, 'after_successor_validation');
    injectedPoint(failureInjection, 'before_successor_generation_rename');
    if (fs.existsSync(finalGeneration)) throw new Error(`Successor generation already exists: ${nextRef}`);
    fs.renameSync(temporaryGeneration, finalGeneration);
    fsyncDirectory(path.dirname(finalGeneration));
    injectedPoint(failureInjection, 'after_successor_generation_rename');
    const pointer = buildCurrentPointer(manifest, context, checkpoint);
    injectedPoint(failureInjection, 'before_CURRENT_temp_write');
    writeJson(currentTemporary, pointer, 'wx');
    fsyncFile(currentTemporary);
    injectedPoint(failureInjection, 'after_CURRENT_temp_write');
    injectedPoint(failureInjection, 'before_CURRENT_rename');
    fs.renameSync(currentTemporary, path.join(run, 'CURRENT.json'));
    fsyncDirectory(run);
    injectedPoint(failureInjection, 'after_CURRENT_rename');
    const active = loadRunUnlocked(run);
    if (!active.passed || active.current.generation !== nextNumber) throw new Error(`Published successor did not become valid authority: ${JSON.stringify(active.diagnostics)}`);
    return { passed: true, diagnostics: [], result, manifest, current: pointer, nextSession: session, nextCheckpoint: checkpoint, generation: nextNumber };
  } finally {
    if (fs.existsSync(temporaryGeneration)) fs.rmSync(temporaryGeneration, { recursive: true, force: true });
    if (fs.existsSync(currentTemporary)) fs.rmSync(currentTemporary, { force: true });
  }
}

export function withRunMutation({ runDirectory, operation, failureInjection }, fn) {
  const lock = acquireRunLock(runDirectory, operation);
  if (!lock.passed) return lock.result;
  let loaded = { runDirectory: resolveRoot(runDirectory) };
  let outcome;
  try {
    injectedPoint(failureInjection, 'after_lock_acquisition');
    loaded = loadRunUnlocked(runDirectory);
    if (!loaded.passed) outcome = loaded;
    else {
      injectedPoint(failureInjection, 'after_active_generation_load');
      outcome = fn(loaded);
    }
  } catch (error) {
    outcome = mutationFailure(loaded, operation, error);
  }
  try {
    injectedPoint(failureInjection, 'before_lock_release');
  } catch (error) {
    outcome = mutationFailure(loaded, operation, error);
  } finally {
    releaseRunLock(lock.lockDirectory);
  }
  return outcome;
}

export function intakeResultRefs(runId, sourceMode) {
  const transitionId = `INTAKE-${runId.slice(4, 20)}`;
  return {
    result_ref: `transitions/intake/${transitionId}/real-intake-result.json`,
    receipt_ref: sourceMode === SOURCE_MODES.PROJECT_GATE ? 'source/project-gate-receipt.json' : null
  };
}

export function initializeStage({ stage, logicalRunDirectory, sourceMode, sourceArtifactFile, builderInputFile }) {
  for (const directory of ['source', 'generations', 'transitions/intake', 'transitions/emit-batch', 'transitions/confirmation', 'transitions/evidence', 'transitions/completion', 'evidence', 'outputs']) fs.mkdirSync(path.join(stage, directory), { recursive: true });
  const selectedExternal = sourceMode === SOURCE_MODES.DIRECT_CE ? sourceArtifactFile : builderInputFile;
  const selectedBytes = readBytes(resolveRoot(selectedExternal));
  writeBytes(path.join(stage, 'source', 'selected-source.json'), selectedBytes, 'wx');
  let receiptSha = null;
  if (sourceMode === SOURCE_MODES.PROJECT_GATE) {
    const receiptBytes = readBytes(resolveRoot(sourceArtifactFile));
    writeBytes(path.join(stage, 'source', 'project-gate-receipt.json'), receiptBytes, 'wx');
    receiptSha = sha256Bytes(receiptBytes);
  }
  const sourceSha = sha256Bytes(selectedBytes);
  const derivation = deriveFromInternalSnapshot({ actualRunDirectory: stage, logicalRunDirectory, sourceMode });
  if (!derivation.passed) throw new Error(JSON.stringify(derivation.diagnostics));
  const context = derivation.context;
  const runId = `RUN-${computeCanonicalDigest({
    source_mode: sourceMode,
    source_snapshot_sha256: sourceSha,
    receipt_snapshot_sha256: receiptSha,
    canonical_package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id,
    run_directory: relativeRoot(logicalRunDirectory)
  }).slice(0, 20)}`;
  const sessionId = `SESSION-${runId.slice(4)}`;
  const initialBlockers = collectInitialBlockers(derivation.builderPackage);
  const checkpoint = buildCheckpoint({
    runId,
    sessionId,
    context,
    sequence: 1,
    parentId: null,
    state: 'BUILD_ACTIVE',
    confirmedActionIds: [],
    unconfirmedActionIds: context.action_batch.action_ids,
    unresolvedBlockers: initialBlockers,
    assertions: [{ assertion_id: 'ASSERT-RUN-CONTEXT-INITIALIZED', subject_ref: runId, claim: 'runtime_context_initialized', status: 'not_applicable', evidence_refs: [] }],
    evidenceLedger: [],
    createdFrom: 'initial'
  });
  const session = buildSession({ sessionId, context, checkpoint, unresolvedEvidence: initialBlockers });
  const manifest = buildManifest({
    runId,
    sourceMode,
    sourceSha,
    receiptSha,
    context,
    checkpoint,
    generationNumber: 1,
    predecessorGeneration: null,
    predecessorCheckpointId: null,
    predecessorCheckpointSequence: null
  });
  const refs = intakeResultRefs(runId, sourceMode);
  const publicationRefs = { generation_ref: generationRef(1), result_ref: refs.result_ref, receipt_ref: refs.receipt_ref };
  const result = {
    schema: 'ev4-builder-real-intake-result@2.0.0',
    run_id: runId,
    transition_id: 'real-intake',
    status: 'accepted',
    source_mode: sourceMode,
    source_snapshot_sha256: sourceSha,
    receipt_snapshot_sha256: receiptSha,
    context_digest: context.context_digest,
    package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id,
    batch_id: context.action_batch.batch_id,
    action_ids: [...context.action_batch.action_ids],
    action_digests: { ...context.action_batch.action_digests },
    resulting_checkpoint: { checkpoint_id: checkpoint.checkpoint_id, checkpoint_sequence: 1, parent_checkpoint_id: null },
    runtime_state: 'BUILD_ACTIVE',
    builder_build_complete: false,
    responsive_complete: false,
    production_ready: false,
    publication: { atomic: true, files: expectedPublicationFiles('real-intake', publicationRefs) },
    blocking_diagnostics: []
  };
  const generationDirectory = path.join(stage, generationRef(1));
  fs.mkdirSync(generationDirectory, { recursive: false });
  writeJson(path.join(generationDirectory, 'runtime-context.json'), context, 'wx');
  writeJson(path.join(generationDirectory, 'session-state.json'), session, 'wx');
  writeJson(path.join(generationDirectory, 'checkpoint.json'), checkpoint, 'wx');
  writeJson(path.join(generationDirectory, 'run-manifest.json'), manifest, 'wx');
  writeJson(path.join(stage, refs.result_ref), result, 'wx');
  const current = buildCurrentPointer(manifest, context, checkpoint);
  writeJson(path.join(stage, 'CURRENT.json'), current, 'wx');
  return { manifest, context, session, checkpoint, result, current, refs };
}
