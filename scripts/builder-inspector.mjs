#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildIntakeCapsule,
  publishDirectoryAtomically,
  resolveFile,
  validateCompletionTransition,
  validateGeneratedResumeCarriers,
  verifyIntakeCapsule
} from './lib/builder-runtime-transition.mjs';
import {
  fixtureValidateBuilderInput
} from './lib/builder-explicit-source-runtime.mjs';
import {
  publishConfirmationTransaction,
  publishEmitBatchTransaction,
  publishStrictRealCompletion,
  validateCanonicalResume,
  writeStrictRealIntake
} from './lib/builder-functional-correctness.mjs';

const ROOT = process.cwd();

function usage() {
  console.error(`Usage:
  node scripts/builder-inspector.mjs fixture-validation <builder-input.json> [fixture-result.json]
  node scripts/builder-inspector.mjs intake <builder-input.json> [fixture-result.json]
  node scripts/builder-inspector.mjs real-intake project-gate <project-gate-receipt.json> <builder-input.json> <runtime-context.json> [real-intake-result.json]
  node scripts/builder-inspector.mjs real-intake direct-ce <ce-source-package.json> - <runtime-context.json> [real-intake-result.json]
  node scripts/builder-inspector.mjs real-intake manual-builder-input - <builder-input.json> <runtime-context.json> [real-intake-result.json]
  node scripts/builder-inspector.mjs emit-batch <runtime-context.json> <session-state.json> <checkpoint.json> <atomic-output-directory>
  node scripts/builder-inspector.mjs confirm-batch <runtime-context.json> <session-state.json> <checkpoint.json> <operator-token> <atomic-output-directory>
  node scripts/builder-inspector.mjs fixture-completion <builder-input.json> <session-state.json> <checkpoint.json> <completion-status.json> <completion-gate.json>
  node scripts/builder-inspector.mjs completion <builder-input.json> <session-state.json> <checkpoint.json> <completion-status.json> <completion-gate.json>
  node scripts/builder-inspector.mjs real-completion project-gate <project-gate-receipt.json> <builder-input.json> <runtime-context.json> <session-state.json> <checkpoint.json> <confirmation-receipt.json> <completion-output-directory>
  node scripts/builder-inspector.mjs real-completion direct-ce <ce-source-package.json> - <runtime-context.json> <session-state.json> <checkpoint.json> <confirmation-receipt.json> <completion-output-directory>
  node scripts/builder-inspector.mjs real-completion manual-builder-input - <builder-input.json> <runtime-context.json> <session-state.json> <checkpoint.json> <confirmation-receipt.json> <completion-output-directory>
  node scripts/builder-inspector.mjs verify-capsule <builder-input.json> <legacy-intake-result.json>
  node scripts/builder-inspector.mjs resume <builder-input.json> <legacy-intake-result.json> <session-state.json> <checkpoint.json> <resume-output-directory>

Aliases intake and completion are fixture/compatibility-only and can never create real Builder Completion.`);
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

function blocked(transitionId, diagnostics) {
  const result = {
    schema: 'ev4-builder-runtime-blocked-result@1.0.0',
    transition_id: transitionId,
    status: 'blocked',
    builder_build_complete: false,
    responsive_complete: false,
    production_ready: false,
    blocking_diagnostics: diagnostics
  };
  print(result);
  process.exitCode = 1;
  return result;
}

function fixtureValidation(sourceFile, outputFile = null) {
  const result = fixtureValidateBuilderInput(sourceFile);
  if (outputFile) atomicWriteJson(outputFile, result);
  print(result);
  process.exitCode = result.status === 'accepted' ? 0 : 1;
}

function realIntake(sourceMode, sourceArtifactArgument, builderInputArgument, contextOutputFile, resultOutputFile = null) {
  const result = writeStrictRealIntake({
    sourceMode,
    sourceArtifactFile: sourceArtifactArgument === '-' ? null : sourceArtifactArgument,
    builderInputFile: builderInputArgument === '-' ? null : builderInputArgument,
    contextOutputFile,
    resultOutputFile
  });
  print(result.result);
  process.exitCode = result.passed ? 0 : 1;
}

function emitBatch(contextFile, sessionFile, checkpointFile, outputDirectory) {
  const result = publishEmitBatchTransaction({ contextFile, sessionFile, checkpointFile, outputDirectory });
  if (!result.passed) return blocked('emit-batch', result.diagnostics);
  print(result.result);
}

function confirmBatch(contextFile, sessionFile, checkpointFile, userToken, outputDirectory) {
  const result = publishConfirmationTransaction({ contextFile, sessionFile, checkpointFile, userToken, outputDirectory });
  if (!result.passed) return blocked('confirm-batch', result.diagnostics);
  print(result.result);
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

function realCompletion(sourceMode, sourceArtifactArgument, builderInputArgument, contextFile, sessionFile, checkpointFile, confirmationReceiptFile, outputDirectory) {
  const result = publishStrictRealCompletion({
    sourceMode,
    sourceArtifactFile: sourceArtifactArgument === '-' ? null : sourceArtifactArgument,
    builderInputFile: builderInputArgument === '-' ? null : builderInputArgument,
    contextFile,
    sessionFile,
    checkpointFile,
    confirmationReceiptFile,
    outputDirectory
  });
  if (!result.passed) return blocked('complete-builder', result.diagnostics);
  print(result.result);
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
  if (!transition.passed) return blocked('resume', transition.diagnostics);
  const result = {
    schema: 'ev4-builder-runtime-transition-result@1.0.0',
    transition_id: 'resume',
    status: 'accepted',
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
    publication: {
      atomic: true,
      output_directory: path.relative(ROOT, resolveFile(outputDirectory)),
      files: ['checkpoint.json', 'resume-result.json', 'session-state.json']
    },
    blocking_diagnostics: []
  };
  publishDirectoryAtomically(outputDirectory, {
    'session-state.json': transition.nextSession,
    'checkpoint.json': transition.nextCheckpoint,
    'resume-result.json': result
  }, validateGeneratedResumeCarriers);
  print(result);
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (['fixture-validation', 'intake'].includes(command) && args.length >= 1 && args.length <= 2) fixtureValidation(args[0], args[1]);
  else if (command === 'real-intake' && args.length >= 4 && args.length <= 5) realIntake(...args);
  else if (command === 'emit-batch' && args.length === 4) emitBatch(...args);
  else if (command === 'confirm-batch' && args.length === 5) confirmBatch(...args);
  else if (['fixture-completion', 'completion'].includes(command) && args.length === 5) fixtureCompletion(...args);
  else if (command === 'real-completion' && args.length === 8) realCompletion(...args);
  else if (command === 'verify-capsule' && args.length === 2) verifyCapsule(...args);
  else if (command === 'resume' && args.length === 5) resume(...args);
  else usage();
} catch (error) {
  blocked(process.argv[2] || 'unknown', [{ code: 'BUILDER-CLI-001', message: error.message }]);
}
