#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const schemaDir = path.resolve('schemas');
const schemaFiles = fs
  .readdirSync(schemaDir)
  .filter((name) => name.endsWith('.schema.json'))
  .sort()
  .map((name) => path.join('schemas', name));

if (schemaFiles.length === 0) {
  console.error('No schema files found in schemas/*.schema.json');
  process.exit(1);
}

let failed = false;

for (const schemaFile of schemaFiles) {
  const refs = schemaFiles.filter((candidate) => candidate !== schemaFile);
  const args = ['--yes', 'ajv-cli@5', 'compile', '--spec=draft2020', '--strict=false', '-s', schemaFile];
  for (const ref of refs) args.push('-r', ref);

  console.log(`Schema registry compile: ${schemaFile}`);
  const result = spawnSync('npx', args, {
    stdio: 'inherit',
    shell: true
  });

  if (result.status !== 0) {
    console.error(`Schema registry compile failed: ${schemaFile}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`Schema registry compile passed for ${schemaFiles.length} schemas.`);
