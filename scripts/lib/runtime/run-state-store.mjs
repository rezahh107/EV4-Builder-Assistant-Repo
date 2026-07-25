import fs from 'node:fs';
import path from 'node:path';

import { computeCanonicalDigest, sha256Bytes } from '../canonical-builder-package.mjs';
import { SOURCE_MODES } from '../builder-explicit-source-runtime.mjs';
import * as primitives from './run-primitives.mjs';
import {
  validateGeneration,
  loadRunUnlocked
} from './run-state-validation.mjs';
import {
  acquireRunLock as acquireOwnedRunLock,
  releaseRunLock as releaseOwnedRunLock
} from './run-lock-ownership.mjs';

const {
  ROOT, ACTIVE_STATE_FILENAMES, GENERATION_NAME, diagnostic, resolveRoot, relativeRoot, stableJson, readBytes, readJson, writeJson, writeBytes,
  sameSet, safeRunRef, generationName, generationRef, injectedPoint,
  fsyncFile, fsyncDirectory, validateCanonicalSourceModeArguments, deriveFromInternalSnapshot,
  collectInitialBlockers, buildCheckpoint, buildSession, buildManifest, buildCurrentPointer
} = primitives;

function runtimeError(code, message, detail = '') {
  const error = new Error(message);
  error.code = code;
  if (detail) error.detail = detail;
  return error;
}

function entryBytes(entry) {
  return entry.kind === 'bytes'
    ? Buffer.from(entry.value)
    : Buffer.from(stableJson(entry.value), 'utf8');
}

function blockedSuccessor(loaded, operation, code, message, detail = '') {
  return {
    ...loaded,
    passed: false,
    operation,
    state_modified: false,
    diagnostics: [diagnostic(code, message, detail)]
  };
}

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
  return acquireOwnedRunLock(runDirectory, operation);
}

export function releaseRunLock(handle) {
  return releaseOwnedRunLock(handle);
}

export function mutationFailure(loaded, operation, error) {
  let activeGeneration = null;
  try {
    const current = readJson(path.join(loaded?.runDirectory || resolveRoot(loaded), 'CURRENT.json'));
    activeGeneration = current.generation;
  } catch {
    // Keep null when CURRENT cannot be read.
  }
  const explicitCode = typeof error?.code === 'string' && error.code.startsWith('RUN-')
    ? error.code
    : `RUN-${operation.toUpperCase().replaceAll('-', '_')}-FAILURE`;
  return {
    ...(loaded && typeof loaded === 'object' ? loaded : {}),
    passed: false,
    operation,
    state_modified: false,
    failure_stage: error?.failureStage || null,
    expected_diagnostic_code: error?.code || null,
    active_generation_after_failure: activeGeneration,
    diagnostics: [diagnostic(
      explicitCode,
      `${operation} failed; CURRENT remains the sole authority.`,
      error?.detail || error?.message || String(error)
    )]
  };
}

export function writeAuxiliaryFiles(run, files) {
  const reused = [];
  const created = [];
  for (const entry of files) {
    const target = safeRunRef(run, entry.ref);
    if (!target) throw runtimeError('RUN_UNCOMMITTED_SUCCESSOR_CONFLICT', `Unsafe auxiliary publication ref: ${entry.ref}`);
    const expected = entryBytes(entry);
    if (fs.existsSync(target)) {
      const actual = readBytes(target);
      if (!actual.equals(expected)) {
        throw runtimeError(
          'RUN_UNCOMMITTED_SUCCESSOR_CONFLICT',
          `Existing auxiliary artifact differs from the expected same-transition bytes: ${entry.ref}`,
          `mismatch=auxiliary:${entry.ref}`
        );
      }
      reused.push(entry.ref);
      continue;
    }
    writeBytes(target, expected, 'wx');
    fsyncFile(target);
    created.push(entry.ref);
  }
  return { reused, created };
}

export function deriveExpectedSuccessorSnapshot({ loaded, context, session, checkpoint, manifestUpdates, result, auxiliaryFiles }) {
  const predecessorNumber = loaded.current.generation;
  const nextNumber = predecessorNumber + 1;
  const nextRef = generationRef(nextNumber);
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
  const pointer = buildCurrentPointer(manifest, context, checkpoint);
  const generationFiles = new Map([
    ['runtime-context.json', Buffer.from(stableJson(context), 'utf8')],
    ['session-state.json', Buffer.from(stableJson(session), 'utf8')],
    ['checkpoint.json', Buffer.from(stableJson(checkpoint), 'utf8')],
    ['run-manifest.json', Buffer.from(stableJson(manifest), 'utf8')]
  ]);
  const auxiliary = new Map(auxiliaryFiles.map((entry) => [entry.ref, entryBytes(entry)]));
  return {
    predecessorNumber,
    nextNumber,
    nextRef,
    manifest,
    pointer,
    context,
    session,
    checkpoint,
    result,
    auxiliaryFiles,
    generationFiles,
    auxiliary
  };
}

export function listFutureGenerations(runDirectory, activeGeneration) {
  const run = resolveRoot(runDirectory);
  const root = path.join(run, 'generations');
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root)
    .filter((name) => GENERATION_NAME.test(name))
    .map((name) => Number.parseInt(name, 10))
    .filter((number) => number > activeGeneration)
    .sort((left, right) => left - right);
}

export function loadExactSuccessorCandidate(runDirectory, generationNumber) {
  const run = resolveRoot(runDirectory);
  const directory = path.join(run, generationRef(generationNumber));
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    return {
      passed: false,
      code: 'RUN_UNCOMMITTED_SUCCESSOR_INCOMPLETE',
      diagnostics: [diagnostic('RUN_UNCOMMITTED_SUCCESSOR_INCOMPLETE', `Expected successor generation ${generationName(generationNumber)} is missing.`)]
    };
  }
  const validation = validateGeneration(run, directory, generationNumber);
  if (!validation.passed) {
    return {
      ...validation,
      code: 'RUN_UNCOMMITTED_SUCCESSOR_INCOMPLETE',
      diagnostics: [
        diagnostic('RUN_UNCOMMITTED_SUCCESSOR_INCOMPLETE', `Future generation ${generationName(generationNumber)} is incomplete or invalid.`),
        ...validation.diagnostics
      ]
    };
  }
  return { ...validation, passed: true, code: null, directory };
}

export function compareSuccessorToExpected({ loaded, candidate, expected }) {
  const mismatches = [];
  if (candidate.manifest?.generation?.number !== expected.nextNumber) mismatches.push('generation_number');
  if (candidate.manifest?.generation?.predecessor_generation !== expected.predecessorNumber) mismatches.push('predecessor_generation');
  if (candidate.manifest?.generation?.predecessor_checkpoint_id !== loaded.checkpoint.checkpoint_id) mismatches.push('predecessor_checkpoint_id');
  if (candidate.manifest?.generation?.predecessor_checkpoint_sequence !== loaded.checkpoint.checkpoint_sequence) mismatches.push('predecessor_checkpoint_sequence');

  for (const [filename, expectedBytes] of expected.generationFiles) {
    const file = path.join(candidate.directory, filename);
    if (!fs.existsSync(file)) {
      return {
        passed: false,
        code: 'RUN_UNCOMMITTED_SUCCESSOR_INCOMPLETE',
        diagnostics: [diagnostic('RUN_UNCOMMITTED_SUCCESSOR_INCOMPLETE', `Future generation is missing ${filename}.`, `mismatch=generation:${filename}`)]
      };
    }
    if (!readBytes(file).equals(expectedBytes)) mismatches.push(`generation:${filename}`);
  }

  for (const [ref, expectedBytes] of expected.auxiliary) {
    const file = safeRunRef(loaded.runDirectory, ref);
    if (!file || !fs.existsSync(file)) {
      return {
        passed: false,
        code: 'RUN_UNCOMMITTED_SUCCESSOR_INCOMPLETE',
        diagnostics: [diagnostic('RUN_UNCOMMITTED_SUCCESSOR_INCOMPLETE', `Future generation references a missing auxiliary artifact: ${ref}.`, `mismatch=auxiliary:${ref}`)]
      };
    }
    if (!readBytes(file).equals(expectedBytes)) mismatches.push(`auxiliary:${ref}`);
  }

  if (mismatches.length) {
    return {
      passed: false,
      code: 'RUN_UNCOMMITTED_SUCCESSOR_CONFLICT',
      diagnostics: [diagnostic(
        'RUN_UNCOMMITTED_SUCCESSOR_CONFLICT',
        'Existing N+1 is not the exact successor derived for this transition and input.',
        `mismatch=${mismatches[0]}`
      )],
      mismatches
    };
  }
  return { passed: true, diagnostics: [], mismatches: [] };
}

function advanceCurrentPointer({ run, expected, failureInjection }) {
  const currentTemporary = path.join(run, `CURRENT.tmp-${process.pid}-${Date.now()}`);
  try {
    injectedPoint(failureInjection, 'before_CURRENT_temp_write');
    writeJson(currentTemporary, expected.pointer, 'wx');
    fsyncFile(currentTemporary);
    injectedPoint(failureInjection, 'after_CURRENT_temp_write');
    injectedPoint(failureInjection, 'before_CURRENT_rename');
    fs.renameSync(currentTemporary, path.join(run, 'CURRENT.json'));
    fsyncDirectory(run);
    injectedPoint(failureInjection, 'after_CURRENT_rename');
  } finally {
    if (fs.existsSync(currentTemporary)) fs.rmSync(currentTemporary, { force: true });
  }
}

export function finalizeExistingExactSuccessor({ loaded, operation, expected, failureInjection }) {
  advanceCurrentPointer({ run: loaded.runDirectory, expected, failureInjection });
  const active = loadRunUnlocked(loaded.runDirectory);
  if (!active.passed || active.current.generation !== expected.nextNumber) {
    throw runtimeError(
      'RUN_UNCOMMITTED_SUCCESSOR_FINALIZATION_FAILED',
      'Exact successor pointer finalization did not produce a valid active Run.',
      JSON.stringify(active.diagnostics || [])
    );
  }
  return {
    ...active,
    passed: true,
    diagnostics: [],
    result: {
      ...expected.result,
      publication_recovery: 'finalized_existing_exact_successor',
      generation_created: false,
      generation_reused: true,
      current_pointer_advanced: true,
      state_modified: true
    },
    manifest: expected.manifest,
    current: expected.pointer,
    nextSession: expected.session,
    nextCheckpoint: expected.checkpoint,
    generation: expected.nextNumber,
    publication_recovery: 'finalized_existing_exact_successor',
    generation_created: false,
    generation_reused: true,
    current_pointer_advanced: true,
    state_modified: true
  };
}

export function publishSuccessor({ loaded, operation, context, session, checkpoint, manifestUpdates, result, auxiliaryFiles, failureInjection }) {
  const run = loaded.runDirectory;
  const expected = deriveExpectedSuccessorSnapshot({ loaded, context, session, checkpoint, manifestUpdates, result, auxiliaryFiles });
  const future = listFutureGenerations(run, loaded.current.generation);

  if (future.length > 1 || (future.length === 1 && future[0] !== expected.nextNumber)) {
    return blockedSuccessor(
      loaded,
      operation,
      'RUN_AMBIGUOUS_FUTURE_GENERATIONS',
      'Future generations are ambiguous; no generation was selected or promoted.',
      `future_generations=${future.join(',')}`
    );
  }

  if (future.length === 1) {
    const candidate = loadExactSuccessorCandidate(run, expected.nextNumber);
    if (!candidate.passed) return { ...loaded, passed: false, operation, state_modified: false, diagnostics: candidate.diagnostics };
    const comparison = compareSuccessorToExpected({ loaded, candidate, expected });
    if (!comparison.passed) return { ...loaded, passed: false, operation, state_modified: false, diagnostics: comparison.diagnostics };
    return finalizeExistingExactSuccessor({ loaded, operation, expected, failureInjection });
  }

  const finalGeneration = path.join(run, expected.nextRef);
  const temporaryGeneration = path.join(run, 'generations', `.tmp-${generationName(expected.nextNumber)}-${process.pid}-${Date.now()}`);
  try {
    writeAuxiliaryFiles(run, auxiliaryFiles);
    fs.mkdirSync(temporaryGeneration, { recursive: false });
    for (const [filename, bytes] of expected.generationFiles) writeBytes(path.join(temporaryGeneration, filename), bytes, 'wx');
    injectedPoint(failureInjection, 'after_successor_temp_write');
    const validation = validateGeneration(run, temporaryGeneration, expected.nextNumber);
    if (!validation.passed) throw runtimeError('RUN_UNCOMMITTED_SUCCESSOR_INCOMPLETE', 'Successor generation validation failed.', JSON.stringify(validation.diagnostics));
    injectedPoint(failureInjection, 'after_successor_validation');
    injectedPoint(failureInjection, 'before_successor_generation_rename');
    if (fs.existsSync(finalGeneration)) {
      throw runtimeError('RUN_UNCOMMITTED_SUCCESSOR_CONFLICT', `Successor generation already exists: ${expected.nextRef}`, `mismatch=generation:${expected.nextRef}`);
    }
    fs.renameSync(temporaryGeneration, finalGeneration);
    fsyncDirectory(path.dirname(finalGeneration));
    injectedPoint(failureInjection, 'after_successor_generation_rename');
    advanceCurrentPointer({ run, expected, failureInjection });
    const active = loadRunUnlocked(run);
    if (!active.passed || active.current.generation !== expected.nextNumber) throw runtimeError('RUN_UNCOMMITTED_SUCCESSOR_FINALIZATION_FAILED', 'Published successor did not become valid authority.', JSON.stringify(active.diagnostics));
    return {
      ...active,
      passed: true,
      diagnostics: [],
      result: {
        ...result,
        publication_recovery: 'new_successor_published',
        generation_created: true,
        generation_reused: false,
        current_pointer_advanced: true,
        state_modified: true
      },
      manifest: expected.manifest,
      current: expected.pointer,
      nextSession: session,
      nextCheckpoint: checkpoint,
      generation: expected.nextNumber,
      publication_recovery: 'new_successor_published',
      generation_created: true,
      generation_reused: false,
      current_pointer_advanced: true,
      state_modified: true
    };
  } finally {
    if (fs.existsSync(temporaryGeneration)) fs.rmSync(temporaryGeneration, { recursive: true, force: true });
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
    releaseRunLock(lock);
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
