import fs from 'node:fs';
import path from 'node:path';
import { RuntimeTransactionError, diagnostic, resolvePath, stableJson } from './common.mjs';

export function baseTransitionResult(transitionId, transactionId, source, target, verification, guardResults) {
  return {
    schema: 'ev4-builder-runtime-transition-result@1.0.0',
    status: 'accepted',
    transaction_id: transactionId,
    transition_id: transitionId,
    source,
    target,
    builder_input_identity: {
      source_file_sha256: verification.source_file_sha256,
      canonical_package_digest: verification.canonical_package_digest,
      builder_context_schema: verification.builder_context_schema,
      selected_candidate_id: verification.selected_candidate_id
    },
    guard_results: guardResults,
    generated_by: 'scripts/lib/runtime-transaction-engine.mjs'
  };
}

export function blockedResult(error, command) {
  const diagnostics = error instanceof RuntimeTransactionError
    ? error.diagnostics
    : [diagnostic('RUNTIME-TRANSACTION-UNEXPECTED', 'Unexpected Runtime Transaction failure.', error.message)];
  return { schema: 'ev4-builder-runtime-command-result@1.0.0', command, status: 'blocked', blocking_diagnostics: diagnostics };
}

export function atomicWriteJsonFile(outputFile, value) {
  const output = resolvePath(outputFile);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, stableJson(value), { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, output);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}
