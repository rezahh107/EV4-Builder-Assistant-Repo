#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const VALID_DIR = path.join(ROOT, 'tests', 'valid');
const INVALID_DIR = path.join(ROOT, 'tests', 'invalid');

function sessionFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith('session_state') && name.endsWith('.json'))
    .sort()
    .map((name) => path.relative(ROOT, path.join(dir, name)));
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    stdio: options.quiet ? 'pipe' : 'inherit',
    shell: process.platform === 'win32'
  });
}

function ajvArgs(file) {
  return [
    '--yes',
    'ajv-cli@5',
    'validate',
    '--spec=draft2020',
    '--strict=false',
    '-s',
    'schemas/session-state.schema.json',
    '-r',
    'schemas/checkpoint.schema.json',
    '-r',
    'schemas/evidence-record.schema.json',
    '-r',
    'schemas/repair-packet.schema.json',
    '-d',
    file
  ];
}

function validatorArgs(file) {
  return ['scripts/validate-session-state.mjs', file];
}

let failed = false;

for (const file of sessionFiles(VALID_DIR)) {
  console.log(`Valid session-state fixture: ${file}`);
  const ajv = run('npx', ajvArgs(file));
  const crossField = run('node', validatorArgs(file));
  if (ajv.status !== 0 || crossField.status !== 0) {
    console.error(`Valid session-state fixture failed: ${file}`);
    failed = true;
  }
}

for (const file of sessionFiles(INVALID_DIR)) {
  const ajv = run('npx', ajvArgs(file), { quiet: true });
  const crossField = run('node', validatorArgs(file), { quiet: true });

  if (ajv.status === 0 && crossField.status === 0) {
    console.error(`Invalid session-state fixture unexpectedly passed all validators: ${file}`);
    failed = true;
  } else {
    const failedBy = [ajv.status !== 0 ? 'schema' : null, crossField.status !== 0 ? 'cross-field' : null]
      .filter(Boolean)
      .join('+');
    console.log(`Invalid session-state fixture correctly failed (${failedBy}): ${file}`);
  }
}

if (failed) process.exit(1);
console.log('Unified session-state validation passed.');
