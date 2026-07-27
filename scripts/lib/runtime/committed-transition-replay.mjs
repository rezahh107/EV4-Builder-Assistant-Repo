import fs from 'node:fs';
import path from 'node:path';

import { sha256Bytes } from '../canonical-builder-package.mjs';
import {
  diagnostic,
  resolveRoot,
  stableJson,
  readBytes,
  readJson,
  safeRunRef,
  generationRef,
  buildCurrentPointer,
  injectedPoint
} from './run-primitives.mjs';
import {
  validateGeneration,
  validateSnapshots,
  loadRunUnlocked
} from './run-state-validation.mjs';
import {
  mutationFailure,
  deriveExpectedSuccessorSnapshot,
  publishSuccessor
} from './run-state-store.mjs';
import { acquireRunLock, releaseRunLock } from './run-lock-ownership.mjs';
import { preparePlanningPredecessor } from './transition-planner-common.mjs';
import { planEmitTransition, planConfirmationTransition } from './transition-planner-emit-confirm.mjs';
import { planEvidenceTransition } from './transition-planner-evidence.mjs';
import { planCompletionTransition } from './transition-planner-completion.mjs';

const PLANNERS = Object.freeze({
  'emit-batch': planEmitTransition,
  'confirm-batch': planConfirmationTransition,
  'attach-evidence': planEvidenceTransition,
  'real-completion': planCompletionTransition
});

const GENERATION_STATE_VALUES = Object.freeze([
  ['runtime-context.json', 'context'],
  ['session-state.json', 'session'],
  ['checkpoint.json', 'checkpoint'],
  ['run-manifest.json', 'manifest']
]);

function replayConflict(active, mismatch, detail = '') {
  return {
    ...(active && typeof active === 'object' ? active : {}),
    passed: false,
    operation: active?.operation || null,
    state_modified: false,
    current_pointer_advanced: false,
    generation_created: false,
    generation_reused: false,
    diagnostics: [diagnostic(
      'RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT',
      'Committed transition bytes differ from the exact canonical transaction derived from the recorded predecessor.',
      `mismatch=${mismatch}${detail ? `;${detail}` : ''}`
    )]
  };
}

function rawCurrent(runDirectory) {
  try { return readJson(path.join(runDirectory, 'CURRENT.json')); }
  catch { return null; }
}

function rawManifest(runDirectory, current) {
  if (!current?.generation_ref) return null;
  const file = safeRunRef(runDirectory, `${current.generation_ref}/run-manifest.json`);
  if (!file || !fs.existsSync(file)) return null;
  try { return readJson(file); }
  catch { return null; }
}

function activeView(active) {
  const runDirectory = resolveRoot(active?.runDirectory || active);
  const current = active?.current || rawCurrent(runDirectory);
  const manifest = active?.manifest || rawManifest(runDirectory, current);
  return { ...active, runDirectory, current, manifest };
}

function canonicalGenerationByteDiagnostics(validation, generationDirectory, number) {
  const diagnostics = [];
  for (const [filename, valueKey] of GENERATION_STATE_VALUES) {
    const file = path.join(generationDirectory, filename);
    const expectedBytes = Buffer.from(stableJson(validation[valueKey]), 'utf8');
    if (!fs.existsSync(file) || !readBytes(file).equals(expectedBytes)) {
      diagnostics.push(diagnostic(
        'RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT',
        'Committed generation bytes are not the exact canonical encoding.',
        `mismatch=generation:${filename};generation=${number}`
      ));
    }
  }
  return diagnostics;
}

function readCommittedGenerationView(run, number) {
  const generationDirectory = safeRunRef(run, generationRef(number));
  if (!generationDirectory || !fs.existsSync(generationDirectory) || !fs.statSync(generationDirectory).isDirectory()) {
    return { passed: false, outcome: replayConflict({ runDirectory: run }, 'generation:run-manifest.json', `generation=${number};generation_missing`) };
  }
  try {
    const context = readJson(path.join(generationDirectory, 'runtime-context.json'));
    const session = readJson(path.join(generationDirectory, 'session-state.json'));
    const checkpoint = readJson(path.join(generationDirectory, 'checkpoint.json'));
    const manifest = readJson(path.join(generationDirectory, 'run-manifest.json'));
    return {
      passed: true,
      active: {
        passed: true,
        diagnostics: [],
        runDirectory: run,
        generationDirectory,
        context,
        session,
        checkpoint,
        manifest,
        current: buildCurrentPointer(manifest, context, checkpoint)
      }
    };
  } catch (error) {
    return { passed: false, outcome: replayConflict({ runDirectory: run }, 'generation:run-manifest.json', `generation=${number};${error.message}`) };
  }
}

function loadExactPredecessor(active) {
  const currentNumber = active.current?.generation;
  if (!Number.isInteger(currentNumber) || currentNumber <= 1) return { passed: false, replayable: false, diagnostics: [] };
  if (!active.manifest) return { passed: false, replayable: true, conflict: replayConflict(active, 'generation:run-manifest.json') };
  const generation = active.manifest.generation;
  if (generation?.number !== currentNumber || generation?.predecessor_generation !== currentNumber - 1 || typeof generation?.predecessor_checkpoint_id !== 'string' || !Number.isInteger(generation?.predecessor_checkpoint_sequence)) {
    return { passed: false, replayable: true, conflict: replayConflict(active, 'generation:run-manifest.json', 'predecessor_binding_invalid') };
  }
  const predecessorDirectory = safeRunRef(active.runDirectory, generationRef(currentNumber - 1));
  if (!predecessorDirectory || !fs.existsSync(predecessorDirectory) || !fs.statSync(predecessorDirectory).isDirectory()) {
    return { passed: false, replayable: true, conflict: replayConflict(active, 'generation:run-manifest.json', 'predecessor_generation_missing') };
  }
  const validation = validateGeneration(active.runDirectory, predecessorDirectory, currentNumber - 1);
  const snapshotDiagnostics = validation.manifest ? validateSnapshots(active.runDirectory, validation.manifest) : [];
  const byteDiagnostics = validation.passed ? canonicalGenerationByteDiagnostics(validation, predecessorDirectory, currentNumber - 1) : [];
  if (!validation.passed || snapshotDiagnostics.length || byteDiagnostics.length) {
    const mismatch = byteDiagnostics[0]?.detail?.match(/mismatch=([^;]+)/)?.[1] || 'generation:run-manifest.json';
    return { passed: false, replayable: true, conflict: replayConflict(active, mismatch, 'predecessor_generation_invalid') };
  }
  if (validation.checkpoint.checkpoint_id !== generation.predecessor_checkpoint_id || validation.checkpoint.checkpoint_sequence !== generation.predecessor_checkpoint_sequence) {
    return { passed: false, replayable: true, conflict: replayConflict(active, 'generation:run-manifest.json', 'predecessor_checkpoint_binding_mismatch') };
  }
  return {
    passed: true,
    replayable: true,
    predecessor: {
      ...validation,
      passed: true,
      diagnostics: [],
      runDirectory: active.runDirectory,
      current: buildCurrentPointer(validation.manifest, validation.context, validation.checkpoint)
    }
  };
}

function operationCommitted(activeManifest, predecessorManifest, operation, commandInput) {
  if (!activeManifest || !predecessorManifest) return false;
  if (operation === 'emit-batch') return Boolean(activeManifest.active_emit_result_ref) && activeManifest.active_emit_result_ref !== predecessorManifest.active_emit_result_ref;
  if (operation === 'confirm-batch') return Boolean(activeManifest.active_confirmation_result_ref && activeManifest.active_confirmation_receipt_ref) && (activeManifest.active_confirmation_result_ref !== predecessorManifest.active_confirmation_result_ref || activeManifest.active_confirmation_receipt_ref !== predecessorManifest.active_confirmation_receipt_ref);
  if (operation === 'attach-evidence') {
    const activeResults = activeManifest.evidence_attachment_result_refs || [];
    const predecessorResults = predecessorManifest.evidence_attachment_result_refs || [];
    const activeSnapshots = activeManifest.evidence_snapshot_refs || [];
    const predecessorSnapshots = predecessorManifest.evidence_snapshot_refs || [];
    if (activeResults.length !== predecessorResults.length + 1 || activeSnapshots.length !== predecessorSnapshots.length + 1) return false;
    if (commandInput?.evidenceRef && activeSnapshots.at(-1) !== commandInput.evidenceRef) return false;
    return true;
  }
  if (operation === 'real-completion') return Boolean(activeManifest.completion_result_ref) && activeManifest.completion_result_ref !== predecessorManifest.completion_result_ref;
  return false;
}

function plannerArguments(operation, predecessor, commandInput) {
  if (operation === 'confirm-batch') return { predecessor, userToken: commandInput?.userToken };
  if (operation === 'attach-evidence') return { predecessor, evidenceBytes: commandInput?.evidenceBytes };
  return { predecessor };
}

function compareCommittedBytes({ active, expected, compareCurrent = true }) {
  const activeDirectory = safeRunRef(active.runDirectory, active.current?.generation_ref);
  if (!activeDirectory || !fs.existsSync(activeDirectory) || !fs.statSync(activeDirectory).isDirectory()) return { passed: false, mismatch: 'generation:run-manifest.json' };
  if (expected.nextNumber !== active.current.generation || expected.nextRef !== active.current.generation_ref) return { passed: false, mismatch: 'generation:run-manifest.json' };
  for (const [filename, expectedBytes] of expected.generationFiles) {
    const file = path.join(activeDirectory, filename);
    if (!fs.existsSync(file) || !readBytes(file).equals(expectedBytes)) return { passed: false, mismatch: `generation:${filename}` };
  }
  for (const [ref, expectedBytes] of expected.auxiliary) {
    const file = safeRunRef(active.runDirectory, ref);
    if (!file || !fs.existsSync(file) || !readBytes(file).equals(expectedBytes)) return { passed: false, mismatch: `auxiliary:${ref}` };
  }
  if (compareCurrent) {
    const currentFile = path.join(active.runDirectory, 'CURRENT.json');
    const expectedBytes = Buffer.from(stableJson(expected.pointer), 'utf8');
    if (!fs.existsSync(currentFile) || !readBytes(currentFile).equals(expectedBytes)) return { passed: false, mismatch: 'CURRENT.json' };
  }
  return { passed: true, mismatch: null };
}

function canonicalReplayOutcome(active, expected, operation) {
  return {
    ...active,
    passed: true,
    diagnostics: [],
    operation,
    result: { ...expected.result, replayed_existing_transition: true, publication_recovery: 'post_commit_replay', state_modified: false, generation_created: false, generation_reused: true, current_pointer_advanced: false },
    replayed_existing_transition: true,
    publication_recovery: 'post_commit_replay',
    state_modified: false,
    generation_created: false,
    generation_reused: true,
    current_pointer_advanced: false,
    generation: active.current.generation
  };
}

export function verifyCommittedTransitionReplay({ active: suppliedActive, operation, commandInput = {}, compareCurrent = true }) {
  const active = activeView(suppliedActive);
  active.operation = operation;
  if (!fs.existsSync(active.runDirectory)) return { matched: false };
  if (!active.current) return { matched: true, outcome: replayConflict(active, 'CURRENT.json') };
  if (!Number.isInteger(active.current.generation) || active.current.generation <= 1) return { matched: false };
  const predecessorLoad = loadExactPredecessor(active);
  if (!predecessorLoad.replayable) return { matched: false };
  if (!predecessorLoad.passed) return { matched: true, outcome: predecessorLoad.conflict };
  const predecessor = predecessorLoad.predecessor;
  if (!operationCommitted(active.manifest, predecessor.manifest, operation, commandInput)) return { matched: false };
  const prepared = preparePlanningPredecessor(predecessor, operation);
  const plan = PLANNERS[operation](plannerArguments(operation, prepared, commandInput));
  if (!plan.passed) {
    const resultRef = active.manifest?.active_confirmation_result_ref || active.manifest?.completion_result_ref || active.manifest?.active_emit_result_ref || active.manifest?.evidence_attachment_result_refs?.at(-1) || 'unknown';
    return { matched: true, outcome: replayConflict(active, `auxiliary:${resultRef}`, 'planner_rederivation_failed') };
  }
  const expected = deriveExpectedSuccessorSnapshot({ loaded: predecessor, context: plan.context, session: plan.session, checkpoint: plan.checkpoint, manifestUpdates: plan.manifestUpdates, result: plan.result, auxiliaryFiles: plan.auxiliaryFiles });
  const comparison = compareCommittedBytes({ active, expected, compareCurrent });
  if (!comparison.passed) return { matched: true, outcome: replayConflict(active, comparison.mismatch) };
  return { matched: true, outcome: canonicalReplayOutcome(active, expected, operation), expected, predecessor, plan };
}

function historyFailureOutcome(loaded, operation, history) {
  const diagnostics = (history?.diagnostics || []).filter((entry) => entry?.code === 'RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT');
  return {
    ...loaded,
    passed: false,
    operation,
    state_modified: false,
    current_pointer_advanced: false,
    generation_created: false,
    generation_reused: false,
    committed_transition_history_validated: false,
    diagnostics: diagnostics.length ? diagnostics : [diagnostic(
      'RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT',
      'Complete committed transition history validation failed before mutation.',
      'mismatch=committed_history'
    )]
  };
}

export function executePlannedMutation({ runDirectory, operation, commandInput = {}, failureInjection = null }) {
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
      const history = validateCommittedTransitionHistory(runDirectory);
      if (!history.passed) outcome = historyFailureOutcome(loaded, operation, history);
      else {
        const replay = verifyCommittedTransitionReplay({ active: loaded, operation, commandInput });
        if (replay.matched) outcome = replay.outcome;
        else {
          const prepared = preparePlanningPredecessor(loaded, operation);
          const plan = PLANNERS[operation](plannerArguments(operation, prepared, commandInput));
          if (!plan.passed) outcome = plan;
          else outcome = publishSuccessor({ loaded, operation, context: plan.context, session: plan.session, checkpoint: plan.checkpoint, manifestUpdates: plan.manifestUpdates, result: plan.result, auxiliaryFiles: plan.auxiliaryFiles, failureInjection });
        }
      }
    }
  } catch (error) {
    outcome = mutationFailure(loaded, operation, error);
  }
  try { injectedPoint(failureInjection, 'before_lock_release'); }
  catch (error) { outcome = mutationFailure(loaded, operation, error); }
  finally { releaseRunLock(lock); }
  return outcome;
}

function inferCommittedOperation(activeManifest, predecessorManifest) {
  if (!activeManifest || !predecessorManifest) return null;
  if (activeManifest.completion_result_ref !== predecessorManifest.completion_result_ref && activeManifest.completion_result_ref) return 'real-completion';
  if ((activeManifest.evidence_attachment_result_refs || []).length === (predecessorManifest.evidence_attachment_result_refs || []).length + 1) return 'attach-evidence';
  if (activeManifest.active_confirmation_result_ref !== predecessorManifest.active_confirmation_result_ref && activeManifest.active_confirmation_result_ref) return 'confirm-batch';
  if (activeManifest.active_emit_result_ref !== predecessorManifest.active_emit_result_ref && activeManifest.active_emit_result_ref) return 'emit-batch';
  return null;
}

function recoverCommandInput(active, operation) {
  if (operation === 'confirm-batch') {
    const ref = active.manifest.active_confirmation_receipt_ref;
    const file = safeRunRef(active.runDirectory, ref);
    if (!file || !fs.existsSync(file)) return { passed: false, mismatch: `auxiliary:${ref || 'confirmation-receipt.json'}` };
    try {
      const receipt = readJson(file);
      if (receipt?.schema !== 'ev4-builder-confirmation-receipt@2.0.0' || typeof receipt.operator_token !== 'string') return { passed: false, mismatch: `auxiliary:${ref}` };
      return { passed: true, commandInput: { userToken: receipt.operator_token } };
    } catch { return { passed: false, mismatch: `auxiliary:${ref}` }; }
  }
  if (operation === 'attach-evidence') {
    const ref = active.manifest.evidence_snapshot_refs?.at(-1);
    const file = safeRunRef(active.runDirectory, ref);
    if (!file || !fs.existsSync(file)) return { passed: false, mismatch: `auxiliary:${ref || 'evidence-snapshot'}` };
    const evidenceBytes = readBytes(file);
    return { passed: true, commandInput: { evidenceBytes, evidenceRef: ref, evidenceSha: sha256Bytes(evidenceBytes) } };
  }
  return { passed: true, commandInput: {} };
}

export function validateCommittedTransitionHistory(runDirectory) {
  const run = resolveRoot(runDirectory);
  const activeRun = loadRunUnlocked(run);
  if (!activeRun.passed) return activeRun;
  const diagnostics = [];
  const currentNumber = activeRun.current.generation;

  if (currentNumber === 1) {
    diagnostics.push(...canonicalGenerationByteDiagnostics(activeRun, activeRun.generationDirectory, 1));
  }

  for (let number = 2; number <= currentNumber; number += 1) {
    const activeRead = readCommittedGenerationView(run, number);
    if (!activeRead.passed) {
      diagnostics.push(...activeRead.outcome.diagnostics);
      continue;
    }
    const active = activeRead.active;
    const predecessorRead = readCommittedGenerationView(run, number - 1);
    if (!predecessorRead.passed) {
      diagnostics.push(...predecessorRead.outcome.diagnostics);
      continue;
    }
    const operation = inferCommittedOperation(active.manifest, predecessorRead.active.manifest);
    if (!operation) {
      diagnostics.push(diagnostic('RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT', 'Committed generation operation cannot be identified.', `mismatch=generation:run-manifest.json;generation=${number}`));
      continue;
    }
    const recovered = recoverCommandInput(active, operation);
    if (!recovered.passed) {
      diagnostics.push(diagnostic('RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT', 'Committed command input cannot be recovered.', `mismatch=${recovered.mismatch};generation=${number}`));
      continue;
    }
    const replay = verifyCommittedTransitionReplay({ active, operation, commandInput: recovered.commandInput, compareCurrent: number === currentNumber });
    if (!replay.matched || !replay.outcome?.passed) diagnostics.push(...(replay.outcome?.diagnostics || [diagnostic('RUN_COMMITTED_TRANSITION_REPLAY_CONFLICT', 'Committed transition exactness validation failed.', `mismatch=generation:run-manifest.json;generation=${number}`)]));
  }
  return { ...activeRun, passed: diagnostics.length === 0, diagnostics: [...activeRun.diagnostics, ...diagnostics], committed_transition_history_validated: diagnostics.length === 0 };
}
