#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function normalizeText(value) { return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n'); }
function readText(filePath) { return normalizeText(fs.readFileSync(filePath, 'utf8')); }
function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function canonicalJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) walk(abs);
      else files.push(path.relative(root, abs).split(path.sep).join('/'));
    }
  };
  walk(root);
  return files;
}
function assertSafeRelative(rel) { if (!rel || path.isAbsolute(rel) || rel.includes('..') || rel.includes('\\')) throw new Error(`Unsafe source-map path: ${rel}`); }

export function renderProjectPack(root, outputDir) {
  const mapPath = path.join(root, 'project-pack', 'source-map.v2.json');
  const sourceMapText = readText(mapPath);
  const sourceMap = JSON.parse(sourceMapText);
  if (sourceMap.schema !== 'ev4-chatgpt-project-source-map@2.0.0') throw new Error('Unsupported Project Pack source map.');
  if (!Array.isArray(sourceMap.outputs) || sourceMap.outputs.length === 0) throw new Error('Project Pack source map has no outputs.');

  fs.mkdirSync(outputDir, { recursive: true });
  const seenOutputs = new Set();
  const entries = [];
  let instructionText = null;
  let knowledgeCount = 0;
  for (const item of sourceMap.outputs) {
    assertSafeRelative(item.output);
    if (seenOutputs.has(item.output)) throw new Error(`Duplicate Project Pack output: ${item.output}`);
    seenOutputs.add(item.output);
    const outputAbs = path.join(outputDir, item.output);
    if (typeof item.content !== 'string') throw new Error(`Project Pack source content missing for ${item.output}`);
    const content = normalizeText(item.content);
    const sourcePath = `project-pack/source-map.v2.json#${item.source_section || item.output}`;
    fs.mkdirSync(path.dirname(outputAbs), { recursive: true });
    fs.writeFileSync(outputAbs, content, 'utf8');
    if (item.role === 'project_instructions') instructionText = content;
    if (item.role === 'knowledge') knowledgeCount += 1;
    entries.push({ role: item.role, source_path: sourcePath, source_sha256: sha256(content), output_path: `dist/chatgpt-project/${item.output}`, output_sha256: sha256(content), bytes: Buffer.byteLength(content, 'utf8'), chars: content.length });
  }
  if (instructionText === null) throw new Error('Project Instructions source is missing.');
  const limits = sourceMap.limits || {};
  if (instructionText.length > (limits.project_instructions_max_chars ?? 8000)) throw new Error(`PROJECT_INSTRUCTIONS.txt exceeds character limit: ${instructionText.length}.`);
  if (knowledgeCount > (limits.knowledge_file_max_count ?? 25)) throw new Error(`Knowledge file count exceeds limit: ${knowledgeCount}.`);
  for (const entry of entries.filter((item) => item.role === 'knowledge')) if (/project[_-]?instructions/i.test(path.basename(entry.output_path))) throw new Error(`Project Instructions duplicated in knowledge: ${entry.output_path}`);

  const sourceFingerprint = sha256(canonicalJson({ source_map_sha256: sha256(sourceMapText), sources: entries.map(({ source_path, source_sha256 }) => ({ source_path, source_sha256 })) }));
  const report = {
    schema: 'ev4-chatgpt-project-build-report@2.0.0', source_map: 'project-pack/source-map.v2.json', source_map_sha256: sha256(sourceMapText),
    source_fingerprint_sha256: sourceFingerprint, project_instructions_chars: instructionText.length,
    project_instructions_limit: limits.project_instructions_max_chars ?? 8000,
    project_instructions_warning_threshold: limits.project_instructions_warning_chars ?? 7800,
    knowledge_file_count: knowledgeCount, knowledge_file_limit: limits.knowledge_file_max_count ?? 25,
    duplicate_project_instructions_in_knowledge: false, status: 'generated_non_authoritative'
  };
  const reportText = canonicalJson(report);
  fs.writeFileSync(path.join(outputDir, 'BUILD_REPORT.json'), reportText, 'utf8');
  const manifestEntries = [...entries, { role: 'build_report', source_path: 'generated:BUILD_REPORT', source_sha256: sourceFingerprint, output_path: 'dist/chatgpt-project/BUILD_REPORT.json', output_sha256: sha256(reportText), bytes: Buffer.byteLength(reportText, 'utf8'), chars: reportText.length }].sort((a, b) => a.output_path.localeCompare(b.output_path));
  const manifest = { schema: 'ev4-chatgpt-project-source-pack-manifest@2.0.0', pack_root: 'dist/chatgpt-project', generated_outputs_authoritative: false, source_map_path: 'project-pack/source-map.v2.json', source_map_sha256: sha256(sourceMapText), source_fingerprint_sha256: sourceFingerprint, limits, files: manifestEntries };
  fs.writeFileSync(path.join(outputDir, 'SOURCE_PACK_MANIFEST.json'), canonicalJson(manifest), 'utf8');
  const actualFiles = listFiles(outputDir);
  const expectedFiles = [...sourceMap.outputs.map((item) => item.output), 'BUILD_REPORT.json', 'SOURCE_PACK_MANIFEST.json'].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) throw new Error(`Generated file set mismatch: ${JSON.stringify(actualFiles)}.`);
  return { manifest, report, files: actualFiles };
}

function compareDirectories(expected, actual) {
  const expectedFiles = listFiles(expected);
  const actualFiles = listFiles(actual);
  if (JSON.stringify(expectedFiles) !== JSON.stringify(actualFiles)) throw new Error(`Project Pack file set drift. expected=${JSON.stringify(expectedFiles)} actual=${JSON.stringify(actualFiles)}`);
  for (const rel of expectedFiles) if (!fs.readFileSync(path.join(expected, rel)).equals(fs.readFileSync(path.join(actual, rel)))) throw new Error(`Project Pack byte drift: ${rel}`);
}

export function verifyProjectPack(root) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-builder-pack-verify-'));
  try { const expected = path.join(tempRoot, 'expected'); renderProjectPack(root, expected); compareDirectories(expected, path.join(root, 'dist', 'chatgpt-project')); }
  finally { fs.rmSync(tempRoot, { recursive: true, force: true }); }
}

export function publishProjectPack(root) {
  const distParent = path.join(root, 'dist');
  const target = path.join(distParent, 'chatgpt-project');
  fs.mkdirSync(distParent, { recursive: true });
  const temp = fs.mkdtempSync(path.join(distParent, '.chatgpt-project-build-'));
  const generated = path.join(temp, 'chatgpt-project');
  const backup = path.join(distParent, `.chatgpt-project-backup-${process.pid}`);
  try {
    renderProjectPack(root, generated);
    renderProjectPack(root, path.join(temp, 'second-pass'));
    compareDirectories(generated, path.join(temp, 'second-pass'));
    if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
    if (fs.existsSync(target)) fs.renameSync(target, backup);
    fs.renameSync(generated, target);
    if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
  } catch (error) {
    if (!fs.existsSync(target) && fs.existsSync(backup)) fs.renameSync(backup, target);
    throw error;
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

async function main() {
  const root = process.cwd();
  const mode = process.argv.includes('--write') ? 'write' : 'verify';
  if (mode === 'write') { publishProjectPack(root); verifyProjectPack(root); console.log('Project Pack generated deterministically and verified.'); }
  else { verifyProjectPack(root); console.log('Project Pack verified against canonical Project Pack sources.'); }
}
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) main().catch((error) => { console.error(`Project Pack failed: ${error.message}`); process.exit(1); });
