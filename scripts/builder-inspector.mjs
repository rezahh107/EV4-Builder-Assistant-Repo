#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs';
import {
  atomicWriteJsonFile,
  blockedResult,
  createIntakeResult,
  executeCompletionTransaction,
  executeResumeTransaction,
  verifyBuilderInput,
  verifyCapsuleAgainstInput
} from './lib/runtime-transaction-engine.mjs';

function usage() {
  console.error(`Usage:
  node scripts/builder-inspector.mjs intake <builder-input.json> [builder-intake-result.json]
  node scripts/builder-inspector.mjs verify-capsule <builder-input.json> <builder-intake-result.json>
  node scripts/builder-inspector.mjs resume <builder-input.json> <builder-intake-result.json> <session-state.json> <checkpoint.json> <output-directory>
  node scripts/builder-inspector.mjs completion <builder-input.json> <builder-intake-result.json> <session-state.json> <checkpoint.json> <action-ledger.json> <completion-status.json> <completion-gate.json> <output-directory>`);
  process.exit(2);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

const [command, ...args] = process.argv.slice(2);

try {
  if (command === 'intake' && args.length >= 1 && args.length <= 2) {
    const verification = verifyBuilderInput(args[0]);
    const output = args[1] || `${args[0]}.intake-result.json`;
    const result = createIntakeResult(verification, path.relative(process.cwd(), path.resolve(output)));
    atomicWriteJsonFile(output, result);
    print(result);
    process.exitCode = verification.passed ? 0 : 1;
  } else if (command === 'verify-capsule' && args.length === 2) {
    const verification = verifyBuilderInput(args[0]);
    const capsule = readJson(args[1]);
    const checked = verifyCapsuleAgainstInput(capsule, verification);
    const result = {
      schema: 'ev4-builder-capsule-verification@1.0.0',
      status: checked.passed ? 'accepted' : 'blocked',
      builder_input_reverified: verification.passed,
      source_file_sha256_matches: capsule.source_file_sha256 === verification.source_file_sha256,
      canonical_package_digest_matches: capsule.canonical_package_digest === verification.canonical_package_digest,
      selected_candidate_matches: capsule.selected_candidate_id === verification.selected_candidate_id,
      builder_context_schema_matches: capsule.builder_context_schema === verification.builder_context_schema,
      blocking_diagnostics: checked.diagnostics
    };
    print(result);
    process.exitCode = checked.passed ? 0 : 1;
  } else if (command === 'resume' && args.length === 5) {
    print(executeResumeTransaction({
      builderInputFile: args[0],
      capsuleFile: args[1],
      sessionFile: args[2],
      checkpointFile: args[3],
      outputDirectory: args[4]
    }));
  } else if (command === 'completion' && args.length === 8) {
    print(executeCompletionTransaction({
      builderInputFile: args[0],
      capsuleFile: args[1],
      sessionFile: args[2],
      checkpointFile: args[3],
      actionLedgerFile: args[4],
      completionStatusFile: args[5],
      completionGateFile: args[6],
      outputDirectory: args[7]
    }));
  } else {
    usage();
  }
} catch (error) {
  print(blockedResult(error, command || 'unknown'));
  process.exitCode = 1;
}
