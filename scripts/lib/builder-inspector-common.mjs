import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha256Bytes } from './builder-package-identity.mjs';

export const ROOT = process.cwd();

export function resolved(filePath) { return path.resolve(ROOT, filePath); }
export function readBuffer(filePath) { return fs.readFileSync(resolved(filePath)); }
export function readJson(filePath) { return JSON.parse(readBuffer(filePath).toString('utf8')); }
export function canonicalJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }
export function exactFileSha(filePath) { return sha256Bytes(readBuffer(filePath)); }

export function gitHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 && /^[a-f0-9]{40}$/.test(result.stdout.trim()) ? result.stdout.trim() : null;
}

export function diagnostic(code, message, fieldOrPath = null, nextAction = null) {
  return { code, message, field_or_path: fieldOrPath, next_action: nextAction };
}

function childDiagnostics(label, result, fallbackCode) {
  const lines = `${result.stderr || ''}\n${result.stdout || ''}`.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    const match = line.match(/^-\s+([A-Z0-9-]+)(?:\s+[A-Z0-9_]+)?:\s*(.+)$/);
    if (match) parsed.push(diagnostic(match[1], match[2], label, 'Correct the reported Builder carrier and retry.'));
  }
  if (parsed.length > 0) return parsed;
  const detail = lines.find((line) => /failed|invalid|missing|mismatch|unexpected/i.test(line)) || lines.at(-1) || `${label} failed.`;
  return [diagnostic(fallbackCode, detail, label, 'Correct this carrier and retry.')];
}

export function run(command, args, label, fallbackCode) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, shell: process.platform === 'win32' });
  if (result.error) return { ok: false, diagnostics: [diagnostic(fallbackCode, `${label} could not execute: ${result.error.message}`, label, 'Install the required local tool and retry.')] };
  return result.status === 0
    ? { ok: true, diagnostics: [], stdout: result.stdout, stderr: result.stderr }
    : { ok: false, diagnostics: childDiagnostics(label, result, fallbackCode), stdout: result.stdout, stderr: result.stderr };
}

export function schemaValidation(schemaPath, dataPath, refs = []) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['--yes', 'ajv-cli@5', 'validate', '--spec=draft2020', '--strict=false', '-s', schemaPath];
  for (const ref of refs) args.push('-r', ref);
  args.push('-d', dataPath);
  return run(command, args, `schema:${schemaPath}`, 'BINS-SCHEMA-001');
}

export function writeAtomic(outputPath, value, { replace = false, forbiddenSources = [] } = {}) {
  const output = resolved(outputPath);
  for (const source of forbiddenSources) if (source && resolved(source) === output) throw new Error('Output path must differ from every source path.');
  if (fs.existsSync(output) && !replace) throw new Error(`Output already exists: ${outputPath}. Use --replace only after review.`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temp = path.join(path.dirname(output), `.${path.basename(output)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temp, canonicalJson(value), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    JSON.parse(fs.readFileSync(temp, 'utf8'));
    if (replace && fs.existsSync(output)) fs.rmSync(output, { force: true });
    fs.renameSync(temp, output);
  } finally {
    fs.rmSync(temp, { force: true });
  }
}
