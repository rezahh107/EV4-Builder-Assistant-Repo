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

const args = ['--yes', 'ajv-cli@5', 'compile', '--spec=draft2020', '--strict=false'];
for (const schemaFile of schemaFiles) args.push('-s', schemaFile);

console.log(`Schema registry compile: compiling ${schemaFiles.length} schemas.`);
const result = spawnSync('npx', args, {
  stdio: 'inherit',
  shell: true
});

if (result.status !== 0) {
  console.error('Schema registry compile failed.');
  process.exit(result.status ?? 1);
}

console.log(`Schema registry compile passed for ${schemaFiles.length} schemas.`);
