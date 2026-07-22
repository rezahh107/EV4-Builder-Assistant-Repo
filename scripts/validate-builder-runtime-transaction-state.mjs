#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBuilderRuntimeTransactionFile } from './validate-builder-runtime-transaction.mjs';

const DEFAULT_ENVELOPE = 'tests/valid/runtime-transaction/complete-transaction.json';

async function main() {
  const envelopePath = process.argv[2] || DEFAULT_ENVELOPE;
  const { bundle, errors } = await validateBuilderRuntimeTransactionFile(envelopePath, { canonicalTools: false });
  const stateErrors = errors.filter((error) => ['BUILDER-TRX-008', 'BUILDER-TRX-011'].includes(error.code));
  const { envelope } = bundle;
  const initial = bundle.si.json;
  const final = bundle.sf.json;

  if (envelope.bindings.initial_session.session_id !== envelope.bindings.final_session.session_id) {
    stateErrors.push({ code: 'BUILDER-TRX-011', message: 'Initial and final Session State snapshots must share one bound session ID.' });
  }
  if (envelope.bindings.initial_session.package_digest !== envelope.bindings.final_session.package_digest) {
    stateErrors.push({ code: 'BUILDER-TRX-011', message: 'Initial and final Session State snapshots must share one full package digest.' });
  }
  if (initial.runtime_state !== 'WAITING_FOR_CONFIRMATION' || initial.current_state !== 'WAITING_FOR_CONFIRMATION') {
    stateErrors.push({ code: 'BUILDER-TRX-011', message: 'Initial canonical Session State must be WAITING_FOR_CONFIRMATION.' });
  }
  if (envelope.bindings.completion.session_complete === true && (final.runtime_state !== 'COMPLETED' || final.current_state !== 'COMPLETED')) {
    stateErrors.push({ code: 'BUILDER-TRX-011', message: 'session_complete requires the actual final canonical Session State to be COMPLETED.' });
  }

  if (stateErrors.length > 0) {
    console.error(`Builder runtime transaction state validation failed: ${envelopePath}`);
    for (const error of stateErrors) console.error(`- ${error.code}: ${error.message}`);
    process.exit(1);
  }
  console.log(`Builder runtime transaction state validation passed: ${envelopePath}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
