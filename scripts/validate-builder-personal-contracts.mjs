#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const cases = [
  ['schemas/builder-intake-authorization.schema.json', 'tests/valid/builder_intake_authorization.valid.json', 'tests/invalid/builder_intake_authorization.invalid.json', []],
  ['schemas/builder-personal-state-capsule.schema.json', 'tests/valid/builder_personal_state_capsule.valid.json', 'tests/invalid/builder_personal_state_capsule.invalid.json', []],
  ['schemas/builder-resume-authorization.schema.json', 'tests/valid/builder_resume_authorization.valid.json', 'tests/invalid/builder_resume_authorization.invalid.json', ['schemas/builder-intake-authorization.schema.json']],
  ['schemas/builder-completion-authorization.schema.json', 'tests/valid/builder_completion_authorization.valid.json', 'tests/invalid/builder_completion_authorization.invalid.json', ['schemas/builder-intake-authorization.schema.json']]
];
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function validate(schema, data, refs, quiet = false) {
  const args = ['--yes', 'ajv-cli@5', 'validate', '--spec=draft2020', '--strict=false', '-s', schema];
  for (const ref of refs) args.push('-r', ref);
  args.push('-d', data);
  return spawnSync(command, args, { stdio: quiet ? 'pipe' : 'inherit', shell: process.platform === 'win32' });
}

let failed = false;
for (const [schema, valid, invalid, refs] of cases) {
  if (validate(schema, valid, refs).status !== 0) {
    console.error(`Valid personal Builder fixture failed: ${valid}`);
    failed = true;
  }
  if (validate(schema, invalid, refs, true).status === 0) {
    console.error(`Invalid personal Builder fixture unexpectedly passed: ${invalid}`);
    failed = true;
  } else {
    console.log(`Invalid personal Builder fixture correctly failed: ${invalid}`);
  }
}
if (failed) process.exit(1);
console.log('Builder personal Inspector contract fixtures passed.');
