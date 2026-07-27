import fs from 'node:fs';
import path from 'node:path';

import { sortedCanonicalJson } from '../canonical-builder-package.mjs';
import {
  diagnostic,
  resolveRoot,
  safeRunRef,
  generationRef,
  injectedPoint,
  fsyncDirectory,
  validateCanonicalSourceModeArguments,
  deriveFromInternalSnapshot,
  readJson
} from './run-primitives.mjs';
import { loadRunUnlocked } from './run-state-validation.mjs';
import { validatePublication, initializeStage } from './run-state-store.mjs';
import { executePlannedMutation } from './committed-transition-replay.mjs';

export function initializeAtomicRun({ sourceMode, sourceArtifactFile = null, builderInputFile = null, runDirectory, failureInjection = null }) {
  const args = validateCanonicalSourceModeArguments({ sourceMode, sourceArtifactFile, builderInputFile });
  if (!args.passed) return { passed: false, diagnostics: args.diagnostics };
  const target = resolveRoot(runDirectory);
  if (fs.existsSync(target)) return { passed: false, diagnostics: [diagnostic('RUN_ALREADY_EXISTS', 'Target Run directory already exists.')] };
  const parent = path.dirname(target);
  fs.mkdirSync(parent, { recursive: true });
  const stage = path.join(parent, `.${path.basename(target)}.init-${process.pid}-${Date.now()}`);
  try {
    fs.mkdirSync(stage, { recursive: false });
    const output = initializeStage({ stage, logicalRunDirectory: target, sourceMode, sourceArtifactFile, builderInputFile });
    injectedPoint(failureInjection, 'after_successor_temp_write');
    const loaded = loadRunUnlocked(stage);
    const diagnostics = [...loaded.diagnostics];
    const derived = loaded.passed ? deriveFromInternalSnapshot({ actualRunDirectory: stage, logicalRunDirectory: target, sourceMode }) : { passed: false, diagnostics: [] };
    diagnostics.push(...(derived.diagnostics || []));
    if (derived.context && sortedCanonicalJson(derived.context) !== sortedCanonicalJson(output.context)) diagnostics.push(diagnostic('RUN-INTAKE-001', 'Generated Context does not match internal snapshot derivation.'));
    diagnostics.push(...validatePublication(output.result, 'real-intake', { generation_ref: generationRef(1), result_ref: output.refs.result_ref, receipt_ref: output.refs.receipt_ref }, 'ev4-builder-real-intake-result@2.0.0', output.manifest.run_id));
    if (diagnostics.length) throw new Error(JSON.stringify(diagnostics));
    injectedPoint(failureInjection, 'after_successor_validation');
    injectedPoint(failureInjection, 'before_successor_generation_rename');
    if (fs.existsSync(target)) throw Object.assign(new Error('Target Run directory already exists.'), { code: 'RUN_ALREADY_EXISTS' });
    fs.renameSync(stage, target);
    fsyncDirectory(parent);
    injectedPoint(failureInjection, 'after_successor_generation_rename');
    return { passed: true, diagnostics: [], ...output, runDirectory: target, generation: 1 };
  } catch (error) {
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
    return { passed: false, failure_stage: error?.failureStage || null, diagnostics: [diagnostic(error?.code === 'RUN_ALREADY_EXISTS' ? 'RUN_ALREADY_EXISTS' : error?.code === 'RUN-INJECTED-FAILURE' ? 'RUN-INJECTED-FAILURE' : 'RUN-INTAKE-FAILURE', 'Atomic Run initialization failed; this process did not modify an existing target Run.', error.message)] };
  }
}

export function loadTransitionResult(run, ref, expectedSchema) {
  const file = safeRunRef(run, ref);
  if (!file || !fs.existsSync(file)) throw new Error(`Transition result is missing or unsafe: ${ref}`);
  const value = readJson(file);
  if (value.schema !== expectedSchema) throw new Error(`Unexpected transition result schema: ${value.schema}`);
  return value;
}

export function emitRunBatch({ runDirectory, failureInjection = null }) {
  return executePlannedMutation({ runDirectory, operation: 'emit-batch', failureInjection });
}

export function confirmRunBatch({ runDirectory, userToken, failureInjection = null }) {
  return executePlannedMutation({ runDirectory, operation: 'confirm-batch', commandInput: { userToken }, failureInjection });
}
