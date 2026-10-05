#!/usr/bin/env node
import { bindComparativeRequirement, admitComparativeResolution } from './lib/runtime/comparative-admission.mjs';

function usage() {
  console.error(`Usage:\n  node scripts/comparative-admission.mjs bind-requirement <run-directory> <requirement-source.json>\n  node scripts/comparative-admission.mjs admit-resolution <run-directory> <resolution-source.json>`);
  process.exit(2);
}
function print(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }
function publish(outcome) {
  if (!outcome?.passed) {
    print(outcome || { passed:false, diagnostics:[{ code:'RUN-COMPARATIVE-CLI-001', message:'Unknown comparative admission failure.' }] });
    process.exitCode = 1;
    return;
  }
  print(outcome.result || outcome);
}
try {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'bind-requirement' && args.length === 2) publish(bindComparativeRequirement({ runDirectory: args[0], requirementSourceFile: args[1] }));
  else if (command === 'admit-resolution' && args.length === 2) publish(admitComparativeResolution({ runDirectory: args[0], resolutionSourceFile: args[1] }));
  else usage();
} catch (error) {
  print({ passed:false, diagnostics:[{ code:'RUN-COMPARATIVE-CLI-001', message:error.message }] });
  process.exitCode = 1;
}
