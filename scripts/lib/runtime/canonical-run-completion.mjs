import fs from 'node:fs';
import path from 'node:path';

import { GENERATION_NAME, diagnostic, resolveRoot, safeRunRef } from './run-primitives.mjs';
import { validateGeneration, loadRunUnlocked, fullDeriveAndCompare } from './run-state-validation.mjs';
import { executePlannedMutation, validateCommittedTransitionHistory } from './committed-transition-replay.mjs';

export function completeRun({ runDirectory, failureInjection = null }) {
  return executePlannedMutation({ runDirectory, operation: 'real-completion', failureInjection });
}

export function validateCanonicalRun(runDirectory, { fullDerivation = false } = {}) {
  const loaded = loadRunUnlocked(runDirectory);
  if (!loaded.passed || !fullDerivation) return loaded;
  const derivation = fullDeriveAndCompare(loaded);
  if (!derivation.passed) return { ...loaded, passed: false, diagnostics: [...loaded.diagnostics, ...derivation.diagnostics], derivation };
  const history = validateCommittedTransitionHistory(runDirectory);
  return { ...loaded, passed: history.passed, diagnostics: [...loaded.diagnostics, ...history.diagnostics], derivation, committed_transition_history_validated: history.passed };
}

export function inspectRunGenerations({ runDirectory }) {
  const run = resolveRoot(runDirectory);
  const active = loadRunUnlocked(run);
  if (!active.passed) return active;
  const generationsDirectory = path.join(run, 'generations');
  const validGenerations = [];
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
      if (number !== active.current.generation) orphanGenerations.push(number);
    } else invalidGenerations.push({ generation: number, diagnostics: validation.diagnostics });
  }
  for (const name of fs.readdirSync(run).filter((entry) => entry.startsWith('CURRENT.tmp-'))) temporaryPaths.push(name);
  return { passed: true, diagnostics: [], result: { schema: 'ev4-builder-generation-inspection@1.0.0', status: 'accepted', run_id: active.manifest.run_id, active_generation: active.current.generation, valid_generations: validGenerations, orphan_generations: orphanGenerations, invalid_generations: invalidGenerations, temporary_paths: temporaryPaths, builder_build_complete: active.checkpoint.runtime_state === 'COMPLETED', responsive_complete: false, production_ready: false } };
}

function collectRecoveryDebris(run) {
  const paths = [];
  for (const name of fs.readdirSync(run)) if (name.startsWith('CURRENT.tmp-')) paths.push(name);
  const generations = path.join(run, 'generations');
  if (fs.existsSync(generations)) for (const name of fs.readdirSync(generations)) if (name.startsWith('.tmp-')) paths.push(`generations/${name}`);
  return paths.sort();
}

export function recoverRunLock({ runDirectory }) {
  const run = resolveRoot(runDirectory);
  const lockDirectory = path.join(run, '.mutation-lock');
  if (!fs.existsSync(lockDirectory)) return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-001', 'No Run mutation lock exists.')] };
  const loaded = loadRunUnlocked(run);
  if (!loaded.passed) return { ...loaded, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-003', 'Active Run validation failed; lock recovery is blocked.'), ...loaded.diagnostics] };
  const debris = collectRecoveryDebris(run);
  const authoritativeText = JSON.stringify({ current: loaded.current, manifest: loaded.manifest });
  for (const ref of debris) if (authoritativeText.includes(ref)) return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-004', `Recovery debris is referenced by active authority: ${ref}.`)] };
  for (const ref of debris) {
    const target = safeRunRef(run, ref);
    if (!target || !fs.existsSync(target)) continue;
    const stat = fs.statSync(target);
    if (stat.isDirectory()) fs.rmSync(target, { recursive: true, force: true });
    else fs.rmSync(target, { force: true });
  }
  fs.rmSync(lockDirectory, { recursive: true, force: true });
  return { passed: true, diagnostics: [], result: { schema: 'ev4-builder-run-lock-recovery-result@1.0.0', status: 'accepted', run_id: loaded.manifest.run_id, active_generation: loaded.current.generation, state_modified: false, current_pointer_advanced: false, lock_removed: true, temporary_paths_removed: debris, orphan_generations_preserved: true, builder_build_complete: loaded.checkpoint.runtime_state === 'COMPLETED', responsive_complete: false, production_ready: false } };
}

export const CANONICAL_REAL_OPERATIONS = Object.freeze(['real-intake', 'emit-batch', 'confirm-batch', 'attach-evidence', 'real-completion']);
