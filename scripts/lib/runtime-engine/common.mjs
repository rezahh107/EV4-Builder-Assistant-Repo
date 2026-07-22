import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sortedCanonicalJson } from '../canonical-builder-package.mjs';

export const ROOT = process.cwd();
export const HASH = /^[a-f0-9]{64}$/;
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

export class RuntimeTransactionError extends Error {
  constructor(code, message, diagnostics = []) {
    super(message);
    this.name = 'RuntimeTransactionError';
    this.code = code;
    this.diagnostics = diagnostics.length ? diagnostics : [{ code, message }];
  }
}

export function diagnostic(code, message, detail) {
  return { code, message, ...(detail ? { detail } : {}) };
}
export function resolvePath(value) { return path.isAbsolute(value) ? value : path.resolve(ROOT, value); }
export function readBytes(file) { return fs.readFileSync(resolvePath(file)); }
export function readJson(file) { return JSON.parse(readBytes(file).toString('utf8')); }
export function stableJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }
export function clone(value) { return structuredClone(value); }
export function sameCanonical(left, right) { return sortedCanonicalJson(left) === sortedCanonicalJson(right); }
export function setEquals(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}
export function duplicates(values = []) {
  const seen = new Set(); const repeated = new Set();
  for (const value of values) { if (seen.has(value)) repeated.add(value); seen.add(value); }
  return [...repeated];
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, shell: false });
  const detail = `${result.stderr || ''}\n${result.stdout || ''}`.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-12).join(' | ').slice(0, 2000);
  return { passed: !result.error && result.status === 0, exit_code: result.status ?? 1, detail: result.error?.message || detail };
}
export function runAjv(schema, data, refs = []) {
  const args = ['--yes', 'ajv-cli@5', 'validate', '--spec=draft2020', '--strict=false', '-s', schema];
  for (const ref of refs) args.push('-r', ref);
  args.push('-d', data);
  return run(NPX, args);
}
export function runNode(script, ...args) { return run(process.execPath, [script, ...args]); }
export function validateJsonFile(file, schema, refs = [], semanticScript = null) {
  const diagnostics = [];
  const schemaResult = runAjv(schema, file, refs);
  if (!schemaResult.passed) diagnostics.push(diagnostic('CARRIER-SCHEMA-INVALID', `${path.basename(file)} failed Schema validation.`, schemaResult.detail));
  if (semanticScript) {
    const semanticResult = runNode(semanticScript, file);
    if (!semanticResult.passed) diagnostics.push(diagnostic('CARRIER-SEMANTIC-INVALID', `${path.basename(file)} failed semantic validation.`, semanticResult.detail));
  }
  return { passed: diagnostics.length === 0, diagnostics };
}
