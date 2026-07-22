#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createIntake, validateIntakeCapsule } from './lib/builder-inspector-intake.mjs';
import { authorizeCompletion, authorizeResume, createStateSnapshot } from './lib/builder-inspector-state.mjs';

function usage() {
  console.error(`Usage:
  node scripts/builder-inspector.mjs intake --input builder-input.json --output builder-intake-authorization.json [--session-id ID] [--replace]
  node scripts/builder-inspector.mjs verify-capsule --input builder-input.json --capsule builder-intake-authorization.json
  node scripts/builder-inspector.mjs snapshot --input FILE --capsule FILE --session-state FILE --checkpoint FILE --event EVENT --output FILE [--previous-state-capsule FILE] [--previous-resumable-state STATE] [--completion-authorized] [--replace]
  node scripts/builder-inspector.mjs resume --input FILE --capsule FILE --state-capsule FILE --session-state FILE --checkpoint FILE --output FILE [--replace]
  node scripts/builder-inspector.mjs completion --input FILE --capsule FILE --previous-state-capsule FILE --state-capsule FILE --session-state FILE --checkpoint FILE --completion-status FILE --completion-gate FILE --output FILE [--replace]`);
}

function args(argv) {
  const command = argv[0];
  const options = {};
  for (let i = 1; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (['replace', 'completion-authorized'].includes(key)) options[key] = true;
    else {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
      options[key] = value; i += 1;
    }
  }
  return { command, options };
}

function requireOptions(options, names) {
  for (const name of names) if (!options[name]) throw new Error(`Missing --${name}.`);
}

function printBlocked(label, diagnostics) {
  console.error(`${label} blocked:`);
  for (const item of diagnostics) console.error(`- ${item.code}: ${item.message}`);
}

async function main() {
  let parsed;
  try { parsed = args(process.argv.slice(2)); }
  catch (error) { console.error(error.message); usage(); process.exit(2); }
  const o = parsed.options;
  let result;
  if (parsed.command === 'intake') {
    requireOptions(o, ['input', 'output']);
    result = createIntake(o.input, o.output, { sessionId: o['session-id'], replace: o.replace });
  } else if (parsed.command === 'verify-capsule') {
    requireOptions(o, ['input', 'capsule']);
    result = validateIntakeCapsule(o.input, o.capsule);
  } else if (parsed.command === 'snapshot') {
    requireOptions(o, ['input', 'capsule', 'session-state', 'checkpoint', 'event', 'output']);
    result = createStateSnapshot({ input: o.input, capsule: o.capsule, sessionState: o['session-state'], checkpoint: o.checkpoint, event: o.event, output: o.output, previousStateCapsule: o['previous-state-capsule'], previousResumableState: o['previous-resumable-state'], completionAuthorized: o['completion-authorized'], replace: o.replace });
  } else if (parsed.command === 'resume') {
    requireOptions(o, ['input', 'capsule', 'state-capsule', 'session-state', 'checkpoint', 'output']);
    result = authorizeResume({ input: o.input, capsule: o.capsule, stateCapsule: o['state-capsule'], sessionState: o['session-state'], checkpoint: o.checkpoint, output: o.output, replace: o.replace });
  } else if (parsed.command === 'completion') {
    requireOptions(o, ['input', 'capsule', 'previous-state-capsule', 'state-capsule', 'session-state', 'checkpoint', 'completion-status', 'completion-gate', 'output']);
    result = authorizeCompletion({ input: o.input, capsule: o.capsule, previousStateCapsule: o['previous-state-capsule'], stateCapsule: o['state-capsule'], sessionState: o['session-state'], checkpoint: o.checkpoint, completionStatus: o['completion-status'], completionGate: o['completion-gate'], output: o.output, replace: o.replace });
  } else { usage(); process.exit(2); }

  if (!result.ok) { printBlocked(`Builder Inspector ${parsed.command}`, result.diagnostics); process.exitCode = 1; }
  else console.log(`Builder Inspector ${parsed.command} passed.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) main().catch((error) => { console.error(`Builder Inspector failed: ${error.message}`); process.exit(1); });
