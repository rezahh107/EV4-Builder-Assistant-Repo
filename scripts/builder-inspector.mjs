#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  buildIntakeCapsule,
  publishDirectoryAtomically,
  resolveFile,
  runAjv,
  validateCompletionTransition,
  validateGeneratedCompletionCarriers,
  validateGeneratedResumeCarriers,
  validateResumeTransition,
  verifyIntakeCapsule
} from './lib/builder-runtime-transition.mjs';

const ROOT = process.cwd();

function usage() {
  console.error(`Usage:
  node scripts/builder-inspector.mjs intake <builder-input.json> [intake-result.json]
  node scripts/builder-inspector.mjs verify-capsule <builder-input.json> <intake-result.json>
  node scripts/builder-inspector.mjs resume <builder-input.json> <intake-result.json> <session-state.json> <checkpoint.json> <resume-output-directory>
  node scripts/builder-inspector.mjs completion <builder-input.json> <intake-result.json> <session-state.json> <checkpoint.json> <completion-status.json> <completion-gate.json> <completion-output-directory>`);
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

function blocked(schema, transitionId, diagnostics) {
  const result = { schema, transition_id: transitionId, status: 'blocked', blocking_diagnostics: diagnostics };
  print(result);
  process.exitCode = 1;
}

function intake(sourceFile, outputFile = `${sourceFile}.intake-result.json`) {
  const { result } = buildIntakeCapsule(sourceFile);
  result.publication.output_path = path.relative(ROOT, resolveFile(outputFile));
  atomicWriteJson(outputFile, result);
  const schema = runAjv('schemas/builder-intake-result.v1.schema.json', outputFile);
  if (!schema.passed) {
    fs.rmSync(resolveFile(outputFile), { force: true });
    throw new Error(`Generated Intake Capsule failed Schema validation: ${schema.detail}`);
  }
  print(result);
  process.exitCode = result.status === 'accepted' ? 0 : 1;
}

function verifyCapsule(sourceFile, capsuleFile) {
  const verification = verifyIntakeCapsule(sourceFile, capsuleFile);
  const result = {
    schema: 'ev4-builder-capsule-verification@1.0.0',
    status: verification.passed ? 'accepted' : 'blocked',
    source_file_sha256_matches: verification.capsule?.source_file_sha256 === verification.builderInput.identity?.source_file_sha256,
    canonical_package_digest_matches: verification.capsule?.canonical_package_digest === verification.builderInput.identity?.canonical_package_digest,
    selected_candidate_matches: verification.capsule?.selected_candidate_id === verification.builderInput.identity?.selected_candidate_id,
    builder_context_schema_matches: verification.capsule?.builder_context_schema === verification.builderInput.identity?.builder_context_schema,
    blocking_diagnostics: verification.diagnostics
  };
  print(result);
  process.exitCode = verification.passed ? 0 : 1;
}

function resume(sourceFile, capsuleFile, sessionFile, checkpointFile, outputDirectory) {
  const transition = validateResumeTransition({ sourceFile, capsuleFile, sessionFile, checkpointFile });
  if (!transition.passed) return blocked('ev4-builder-runtime-transition-result@1.0.0', 'resume', transition.diagnostics);

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

function completion(sourceFile, capsuleFile, sessionFile, checkpointFile, statusFile, gateFile, outputDirectory) {
  const transition = validateCompletionTransition({ sourceFile, capsuleFile, sessionFile, checkpointFile, statusFile, gateFile });
  if (!transition.passed) return blocked('ev4-builder-runtime-transition-result@1.0.0', 'complete-builder', transition.diagnostics);

  const result = {
    schema: 'ev4-builder-runtime-transition-result@1.0.0',
    transition_id: 'complete-builder',
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
    resulting_checkpoint: {
      checkpoint_id: transition.nextCheckpoint.checkpoint_id,
      checkpoint_sequence: transition.nextCheckpoint.checkpoint_sequence,
      parent_checkpoint_id: transition.nextCheckpoint.parent_checkpoint_id
    },
    action_reconciliation: {
      expected_action_ids: transition.actionReconciliation.expected_action_ids,
      confirmed_action_ids: transition.actionReconciliation.confirmed_action_ids,
      batch_id: transition.actionReconciliation.batch_id
    },
    completion_scope: transition.completionStatus.claim_scope,
    builder_build_complete: true,
    responsive_complete: false,
    production_ready: false,
    publication: {
      atomic: true,
      output_directory: path.relative(ROOT, resolveFile(outputDirectory)),
      files: ['checkpoint.json', 'completion-result.json', 'session-state.json']
    },
    blocking_diagnostics: []
  };

  publishDirectoryAtomically(outputDirectory, {
    'session-state.json': transition.nextSession,
    'checkpoint.json': transition.nextCheckpoint,
    'completion-result.json': result
  }, validateGeneratedCompletionCarriers);
  print(result);
}

try {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'intake' && args.length >= 1) intake(args[0], args[1]);
  else if (command === 'verify-capsule' && args.length === 2) verifyCapsule(args[0], args[1]);
  else if (command === 'resume' && args.length === 5) resume(...args);
  else if (command === 'completion' && args.length === 7) completion(...args);
  else usage();
} catch (error) {
  const result = {
    schema: 'ev4-builder-runtime-transition-result@1.0.0',
    transition_id: process.argv[2] || 'unknown',
    status: 'blocked',
    blocking_diagnostics: [{ code: 'BUILDER-CLI-001', message: error.message }]
  };
  print(result);
  process.exitCode = 1;
}
