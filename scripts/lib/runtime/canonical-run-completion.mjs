import fs from 'node:fs';
import path from 'node:path';

import { GENERATION_NAME, resolveRoot } from './run-primitives.mjs';
import { validateGeneration, loadRunUnlocked, fullDeriveAndCompare } from './run-state-validation.mjs';
import { executePlannedMutation } from './committed-transition-replay.mjs';
import { validateIndependentCommittedTransitions } from './canonical-run-independent-validation.mjs';
import { recoverRunLock as recoverOwnedRunLock } from './run-lock-ownership.mjs';

export function completeRun({ runDirectory, failureInjection = null }) {
  return executePlannedMutation({ runDirectory, operation: 'real-completion', failureInjection });
}

export function validateCanonicalRun(runDirectory, { fullDerivation = false } = {}) {
  const loaded = loadRunUnlocked(runDirectory);
  if (!loaded.passed || !fullDerivation) return loaded;
  const derivation = fullDeriveAndCompare(loaded);
  if (!derivation.passed) return { ...loaded, passed: false, diagnostics: [...loaded.diagnostics, ...derivation.diagnostics], derivation };
  const history = validateIndependentCommittedTransitions(runDirectory, loaded);
  return { ...loaded, passed: history.passed, diagnostics: [...loaded.diagnostics, ...history.diagnostics], derivation, committed_transition_history_validated: history.passed };
}

export function inspectRunGenerations({ runDirectory }) {
  const run = resolveRoot(runDirectory);
  const active = loadRunUnlocked(run);
  if (!active.passed) return active;
  const generationsDirectory = path.join(run, 'generations');
  const validGenerations = [];
  const historicalGenerations = [];
  const invalidGenerations = [];
  const orphanGenerations = [];
  const temporaryPaths = [];
  for (const name of fs.readdirSync(generationsDirectory).sort()) {
    if (name.startsWith('.tmp-')) { temporaryPaths.push(`generations/${name}`); continue; }
    if (!GENERATION_NAME.test(name)) continue;
    const number = Number.parseInt(name, 10);
    const validation = validateGeneration(run, path.join(generationsDirectory, name), number);
    if (validation.passed) {
      validGenerations.push(number);
      if (number < active.current.generation) historicalGenerations.push(number);
      else if (number > active.current.generation) orphanGenerations.push(number);
    } else invalidGenerations.push({ generation: number, diagnostics: validation.diagnostics });
  }
  for (const name of fs.readdirSync(run).filter((entry) => entry.startsWith('CURRENT.tmp-'))) temporaryPaths.push(name);
  return {
    passed: true,
    diagnostics: [],
    result: {
      schema: 'ev4-builder-generation-inspection@1.0.0',
      status: 'accepted',
      run_id: active.manifest.run_id,
      active_generation: active.current.generation,
      valid_generations: validGenerations,
      historical_generations: historicalGenerations,
      orphan_generations: orphanGenerations,
      invalid_generations: invalidGenerations,
      temporary_paths: temporaryPaths,
      builder_build_complete: active.checkpoint.runtime_state === 'COMPLETED',
      responsive_complete: false,
      production_ready: false
    }
  };
}

export function recoverRunLock({ runDirectory }) {
  return recoverOwnedRunLock({ runDirectory });
}

export const CANONICAL_REAL_OPERATIONS = Object.freeze(['real-intake', 'emit-batch', 'confirm-batch', 'attach-evidence', 'real-completion']);
