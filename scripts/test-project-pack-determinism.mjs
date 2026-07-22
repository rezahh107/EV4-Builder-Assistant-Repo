#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderProjectPack, verifyProjectPack } from './build-project-pack.mjs';

const ROOT = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-pack-tests-'));
const first = path.join(temp, 'first');
const second = path.join(temp, 'second');

function list(root) {
  const result = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) walk(abs);
      else result.push(path.relative(root, abs).split(path.sep).join('/'));
    }
  };
  walk(root);
  return result;
}

function sameTree(left, right) {
  const files = list(left);
  if (JSON.stringify(files) !== JSON.stringify(list(right))) return false;
  return files.every((rel) => fs.readFileSync(path.join(left, rel)).equals(fs.readFileSync(path.join(right, rel))));
}

try {
  renderProjectPack(ROOT, first);
  renderProjectPack(ROOT, second);
  if (!sameTree(first, second)) throw new Error('Two clean Project Pack renders are not byte-identical.');

  const manifest = JSON.parse(fs.readFileSync(path.join(first, 'SOURCE_PACK_MANIFEST.json'), 'utf8'));
  const report = JSON.parse(fs.readFileSync(path.join(first, 'BUILD_REPORT.json'), 'utf8'));
  if (manifest.schema !== 'ev4-chatgpt-project-source-pack-manifest@2.0.0') throw new Error('Unexpected Project Pack manifest schema.');
  if (manifest.generated_outputs_authoritative !== false) throw new Error('Generated dist must remain non-authoritative.');
  if (report.knowledge_file_count !== 11) throw new Error(`Expected 11 knowledge files, got ${report.knowledge_file_count}.`);

  const instructions = fs.readFileSync(path.join(first, 'PROJECT_INSTRUCTIONS.txt'), 'utf8');
  for (const token of ['builder-intake-authorization.json', 'builder-inspector.mjs intake', 'builder-resume-authorization.json', 'builder-completion-authorization.json', 'production_ready: false']) {
    if (!instructions.includes(token)) throw new Error(`Generated Project Instructions missing ${token}.`);
  }

  verifyProjectPack(ROOT);
  const trackedInstruction = path.join(ROOT, 'dist', 'chatgpt-project', 'PROJECT_INSTRUCTIONS.txt');
  const original = fs.readFileSync(trackedInstruction);
  fs.appendFileSync(trackedInstruction, '\nHAND_EDIT\n');
  let handEditFailed = false;
  try { verifyProjectPack(ROOT); } catch { handEditFailed = true; }
  fs.writeFileSync(trackedInstruction, original);
  if (!handEditFailed) throw new Error('Hand-edited dist unexpectedly passed verification.');

  const source = path.join(ROOT, 'project-pack', 'source-map.v2.json');
  const sourceOriginal = fs.readFileSync(source);
  const sourceMap = JSON.parse(sourceOriginal.toString('utf8'));
  const target = sourceMap.outputs.find((item) => item.output === 'knowledge/10_USER_FACING_UX_RECOVERY.md');
  target.content += '\nsource mutation\n';
  fs.writeFileSync(source, `${JSON.stringify(sourceMap, null, 2)}\n`);
  const changed = path.join(temp, 'changed');
  renderProjectPack(ROOT, changed);
  fs.writeFileSync(source, sourceOriginal);
  if (fs.readFileSync(path.join(first, 'knowledge', '10_USER_FACING_UX_RECOVERY.md')).equals(fs.readFileSync(path.join(changed, 'knowledge', '10_USER_FACING_UX_RECOVERY.md'))) {
    throw new Error('Source mutation did not change generated output.');
  }

  verifyProjectPack(ROOT);
  console.log('Deterministic Project Pack tests passed.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
