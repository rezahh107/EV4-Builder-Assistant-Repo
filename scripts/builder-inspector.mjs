#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  buildIntakeCapsule,
  publishDirectoryAtomically,
  resolveFile,
  validateCompletionTransition,
  validateGeneratedResumeCarriers,
  verifyIntakeCapsule
} from './lib/builder-runtime-transition.mjs';
import { fixtureValidateBuilderInput } from './lib/builder-explicit-source-runtime.mjs';
import { validateCanonicalResume } from './lib/builder-functional-correctness.mjs';
import {
  attachRunEvidence,
  completeRun,
  confirmRunBatch,
  emitRunBatch,
  initializeAtomicRun,
  inspectRunGenerations,
  recoverRunLock
} from './lib/runtime/canonical-run-runtime.mjs';

const ROOT = process.cwd();
const ARTIFACT_VALIDATOR = path.join(ROOT, 'scripts', 'validate-canonical-run-artifacts.mjs');

function usage() {
  console.error(`Usage:
  node scripts/builder-inspector.mjs real-intake <project-gate|direct-ce|manual-builder-input> <source-artifact.json|-> <builder-input.json|-> <run-directory>
  node scripts/builder-inspector.mjs emit-batch <run-directory>
  node scripts/builder-inspector.mjs confirm-batch <run-directory> <operator-token>
  node scripts/builder-inspector.mjs attach-evidence <run-directory> <evidence-source.json>
  node scripts/builder-inspector.mjs real-completion <run-directory>

Local maintenance:
  node scripts/builder-inspector.mjs inspect-run-generations <run-directory>
  node scripts/builder-inspector.mjs recover-run-lock <run-directory>

Fixture and compatibility commands:
  node scripts/builder-inspector.mjs fixture-validation <builder-input.json> [fixture-result.json]
  node scripts/builder-inspector.mjs intake <builder-input.json> [fixture-result.json]
  node scripts/builder-inspector.mjs fixture-completion <builder-input.json> <session-state.json> <checkpoint.json> <completion-status.json> <completion-gate.json>
  node scripts/builder-inspector.mjs completion <builder-input.json> <session-state.json> <checkpoint.json> <completion-status.json> <completion-gate.json>
  node scripts/builder-inspector.mjs verify-capsule <builder-input.json> <legacy-intake-result.json>
  node scripts/builder-inspector.mjs resume <builder-input.json> <legacy-intake-result.json> <session-state.json> <checkpoint.json> <resume-output-directory>

Only stable-Run-directory commands are real Runtime authority. Maintenance and compatibility commands cannot create real Completion.`);
  process.exit(2);
}

function atomicWriteJson(outputFile, value) {
  const output = resolveFile(outputFile);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, output);
  } catch (error) {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function blocked(transitionId, outcome) {
  const diagnostics = Array.isArray(outcome) ? outcome : outcome?.diagnostics || [];
  const result = {
    schema: 'ev4-builder-runtime-blocked-result@1.0.0',
    transition_id: transitionId,
    status: 'blocked',
    failure_stage: Array.isArray(outcome) ? null : outcome?.failure_stage ?? null,
    expected_diagnostic_code: Array.isArray(outcome) ? null : outcome?.expected_diagnostic_code ?? diagnostics[0]?.code ?? null,
    active_generation_after_failure: Array.isArray(outcome) ? null : outcome?.active_generation_after_failure ?? null,
    builder_build_complete: false,
    responsive_complete: false,
    production_ready: false,
    blocking_diagnostics: diagnostics
  };
  print(result);
  process.exitCode = 1;
  return result;
}

function publishResult(transitionId, operation) {
  const outcome = operation();
  if (!outcome.passed) return blocked(transitionId, outcome);
  print(outcome.result);
  return outcome;
}

function fixtureValidation(sourceFile, outputFile = null) {
  const result = fixtureValidateBuilderInput(sourceFile);
  if (outputFile) atomicWriteJson(outputFile, result);
  print(result);
  process.exitCode = result.status === 'accepted' ? 0 : 1;
}

function fixtureCompletion(sourceFile, sessionFile, checkpointFile, statusFile, gateFile) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-builder-fixture-completion-'));
  try {
    const capsuleFile = path.join(temp, 'legacy-intake-result.json');
    const capsule = buildIntakeCapsule(sourceFile).result;
    capsule.publication.output_path = path.relative(ROOT, capsuleFile);
    fs.writeFileSync(capsuleFile, `${JSON.stringify(capsule, null, 2)}\n`);
    const transition = validateCompletionTransition({ sourceFile, capsuleFile, sessionFile, checkpointFile, statusFile, gateFile });
    const result = {
      schema: 'ev4-builder-fixture-completion-result@1.0.0',
      status: transition.passed ? 'accepted' : 'blocked',
      runtime_mode: 'fixture-validation',
      synthetic_validation_passed: transition.passed,
      would_complete: transition.passed,
      builder_build_complete: false,
      runtime_state: 'NOT_A_REAL_RUN',
      responsive_complete: false,
      production_ready: false,
      blocking_diagnostics: transition.diagnostics
    };
    print(result);
    process.exitCode = transition.passed ? 0 : 1;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function verifyCapsule(sourceFile, capsuleFile) {
  const verification = verifyIntakeCapsule(sourceFile, capsuleFile);
  const result = {
    schema: 'ev4-builder-capsule-verification@1.0.0',
    status: verification.passed ? 'accepted' : 'blocked',
    authority_scope: 'legacy_fixture_and_diagnostics_only',
    builder_build_complete: false,
    blocking_diagnostics: verification.diagnostics
  };
  print(result);
  process.exitCode = verification.passed ? 0 : 1;
}

function resume(sourceFile, capsuleFile, sessionFile, checkpointFile, outputDirectory) {
  const transition = validateCanonicalResume({ sourceFile, capsuleFile, sessionFile, checkpointFile });
  if (!transition.passed) return blocked('resume', transition);
  const result = {
    schema: 'ev4-builder-runtime-transition-result@1.0.0',
    transition_id: 'resume',
    status: 'accepted',
    authority_scope: 'legacy_compatibility_only',
    real_run_authority: false,
    source: { workflow_mode: transition.session.workflow_mode, runtime_state: transition.session.runtime_state },
    target: { workflow_mode: transition.nextSession.workflow_mode, runtime_state: transition.nextSession.runtime_state },
    identity: {
      session_id: transition.session.session_id,
      package_digest: transition.identity.canonical_package_digest,
      selected_candidate_id: transition.identity.selected_candidate_id,
      checkpoint_id: transition.checkpoint.checkpoint_id,
      checkpoint_sequence: transition.checkpoint.checkpoint_sequence
    },
    unresolved_blockers_preserved: true,
    builder_build_complete: false,
    responsive_complete: false,
    production_ready: false,
    publication: { atomic: true, output_directory: path.relative(ROOT, resolveFile(outputDirectory)), files: ['checkpoint.json', 'resume-result.json', 'session-state.json'] },
    blocking_diagnostics: []
  };
  publishDirectoryAtomically(outputDirectory, {
    'session-state.json': transition.nextSession,
    'checkpoint.json': transition.nextCheckpoint,
    'resume-result.json': result
  }, validateGeneratedResumeCarriers);
  print(result);
}

function runMaintenanceArtifactValidation(script, runDirectory) {
  if (path.resolve(script) !== ARTIFACT_VALIDATOR) throw new Error('Unsupported maintenance validation script.');
  const result = spawnSync(process.execPath, [ARTIFACT_VALIDATOR, runDirectory], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: false
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) process.exitCode = result.status ?? 1;
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'real-intake' && args.length === 4) {
    const [sourceMode, sourceArg, builderArg, runDirectory] = args;
    publishResult('real-intake', () => initializeAtomicRun({
      sourceMode,
      sourceArtifactFile: sourceArg === '-' ? null : sourceArg,
      builderInputFile: builderArg === '-' ? null : builderArg,
      runDirectory
    }));
  } else if (command === 'emit-batch' && args.length === 1) publishResult('emit-batch', () => emitRunBatch({ runDirectory: args[0] }));
  else if (command === 'confirm-batch' && args.length === 2) publishResult('confirm-batch', () => confirmRunBatch({ runDirectory: args[0], userToken: args[1] }));
  else if (command === 'attach-evidence' && args.length === 2) publishResult('attach-evidence', () => attachRunEvidence({ runDirectory: args[0], evidenceSourceFile: args[1] }));
  else if (command === 'real-completion' && args.length === 1) publishResult('real-completion', () => completeRun({ runDirectory: args[0] }));
  else if (command === 'inspect-run-generations' && args.length === 1) publishResult('inspect-run-generations', () => inspectRunGenerations({ runDirectory: args[0] }));
  else if (command === 'recover-run-lock' && args.length === 1) publishResult('recover-run-lock', () => recoverRunLock({ runDirectory: args[0] }));
  else if (command && path.resolve(command) === ARTIFACT_VALIDATOR && args.length === 1) runMaintenanceArtifactValidation(command, args[0]);
  else if (['fixture-validation', 'intake'].includes(command) && args.length >= 1 && args.length <= 2) fixtureValidation(args[0], args[1]);
  else if (['fixture-completion', 'completion'].includes(command) && args.length === 5) fixtureCompletion(...args);
  else if (command === 'verify-capsule' && args.length === 2) verifyCapsule(...args);
  else if (command === 'resume' && args.length === 5) resume(...args);
  else usage();
} catch (error) {
  blocked(process.argv[2] || 'unknown', { diagnostics: [{ code: 'BUILDER-CLI-001', message: error.message }] });
}
