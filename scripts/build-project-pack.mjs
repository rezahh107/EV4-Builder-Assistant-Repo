#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const mapPath = path.join(root, 'runtime', 'project-pack-source-map.v1.json');
const mode = process.argv.includes('--write') ? 'write' : 'verify';

function fail(message) {
  console.error(`Project pack ${mode} failed: ${message}`);
  process.exit(1);
}

function normalizeText(value) {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function readText(file) {
  return normalizeText(fs.readFileSync(file, 'utf8'));
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function listFiles(directory, prefix = '') {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const absolute = path.join(directory, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    if (fs.statSync(absolute).isDirectory()) result.push(...listFiles(absolute, relative));
    else result.push(relative);
  }
  return result;
}

function compareDirectories(expected, actual) {
  const expectedFiles = listFiles(expected);
  const actualFiles = listFiles(actual);
  if (JSON.stringify(expectedFiles) !== JSON.stringify(actualFiles)) {
    fail(`generated file list differs. expected=${JSON.stringify(expectedFiles)} actual=${JSON.stringify(actualFiles)}`);
  }
  for (const relative of expectedFiles) {
    const left = fs.readFileSync(path.join(expected, relative));
    const right = fs.readFileSync(path.join(actual, relative));
    if (!left.equals(right)) fail(`hand-edited or stale generated file: ${relative}`);
  }
}

if (!fs.existsSync(mapPath)) fail('missing runtime/project-pack-source-map.v1.json');
const mapBytes = Buffer.from(readText(mapPath), 'utf8');
const sourceMap = JSON.parse(mapBytes.toString('utf8'));
if (sourceMap.schema !== 'ev4-builder-project-pack-source-map@1.0.0') fail('unsupported source map schema');

const packDir = path.join(root, sourceMap.pack_root);
const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-builder-project-pack-'));
const stagePack = path.join(stageRoot, 'chatgpt-project');
fs.mkdirSync(stagePack, { recursive: true });

try {
  const entries = [];
  let projectInstructionsChars = 0;
  let knowledgeFileCount = 0;

  for (const mapping of sourceMap.files || []) {
    const source = path.join(root, mapping.source);
    if (!fs.existsSync(source)) fail(`missing canonical source: ${mapping.source}`);
    if (path.isAbsolute(mapping.output) || mapping.output.includes('..') || mapping.output.includes('\\')) {
      fail(`unsafe output path: ${mapping.output}`);
    }

    const text = readText(source);
    const bytes = Buffer.from(text, 'utf8');
    const output = path.join(stagePack, mapping.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, bytes);

    for (const pattern of sourceMap.forbidden_generated_runtime_patterns || []) {
      if (text.toLowerCase().includes(String(pattern).toLowerCase())) {
        fail(`removed governance pattern reappeared in ${mapping.output}: ${pattern}`);
      }
    }

    if (mapping.role === 'project_instructions') projectInstructionsChars = text.length;
    if (mapping.role === 'knowledge') knowledgeFileCount += 1;
    entries.push({
      source_path: mapping.source,
      source_sha256: sha256Bytes(bytes),
      output_path: `${sourceMap.pack_root}/${mapping.output}`,
      output_sha256: sha256Bytes(bytes),
      bytes: bytes.length,
      chars: text.length,
      role: mapping.role
    });
  }

  const instructionLimit = sourceMap.limits?.project_instructions_max_chars ?? 8000;
  const warningLimit = sourceMap.limits?.project_instructions_warning_chars ?? 7600;
  const knowledgeLimit = sourceMap.limits?.knowledge_file_max_count ?? 10;
  if (projectInstructionsChars === 0) fail('project instructions source missing');
  if (projectInstructionsChars > instructionLimit) fail(`Project Instructions exceed ${instructionLimit} characters`);
  if (projectInstructionsChars > warningLimit) console.warn(`Project Instructions warning: ${projectInstructionsChars}/${instructionLimit}`);
  if (knowledgeFileCount > knowledgeLimit) fail(`knowledge file count ${knowledgeFileCount} exceeds ${knowledgeLimit}`);

  entries.sort((left, right) => left.output_path.localeCompare(right.output_path));
  const manifest = {
    schema: 'ev4-chatgpt-project-source-pack-manifest@2.0.0',
    source_map_path: 'runtime/project-pack-source-map.v1.json',
    source_map_sha256: sha256Bytes(mapBytes),
    pack_root: sourceMap.pack_root,
    limits: sourceMap.limits,
    deterministic: true,
    files: entries
  };
  fs.writeFileSync(path.join(stagePack, 'SOURCE_PACK_MANIFEST.json'), stableJson(manifest));

  const report = {
    schema: 'ev4-chatgpt-project-build-report@2.0.0',
    source_map_sha256: manifest.source_map_sha256,
    project_instructions_chars: projectInstructionsChars,
    knowledge_file_count: knowledgeFileCount,
    manifest_file_count: entries.length,
    generated_file_count: entries.length + 2,
    deterministic: true,
    validated_before_publish: true,
    atomic_publication: true
  };
  fs.writeFileSync(path.join(stagePack, 'BUILD_REPORT.json'), stableJson(report));

  const stagedFiles = listFiles(stagePack);
  if (stagedFiles.length !== report.generated_file_count) {
    fail(`generated file count mismatch: ${stagedFiles.length} != ${report.generated_file_count}`);
  }

  if (mode === 'verify') {
    if (!fs.existsSync(packDir)) fail('generated dist/chatgpt-project is missing; run with --write');
    compareDirectories(stagePack, packDir);
    console.log(`Deterministic Project Pack verified: ${entries.length} mapped files, ${knowledgeFileCount} knowledge files.`);
  } else {
    const parent = path.dirname(packDir);
    fs.mkdirSync(parent, { recursive: true });
    const backup = `${packDir}.backup-${process.pid}`;
    if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
    if (fs.existsSync(packDir)) fs.renameSync(packDir, backup);
    try {
      fs.renameSync(stagePack, packDir);
      if (fs.existsSync(backup)) fs.rmSync(backup, { recursive: true, force: true });
    } catch (error) {
      if (fs.existsSync(packDir)) fs.rmSync(packDir, { recursive: true, force: true });
      if (fs.existsSync(backup)) fs.renameSync(backup, packDir);
      throw error;
    }
    console.log(`Deterministic Project Pack published atomically: ${entries.length} mapped files.`);
  }
} finally {
  if (fs.existsSync(stageRoot)) fs.rmSync(stageRoot, { recursive: true, force: true });
}
