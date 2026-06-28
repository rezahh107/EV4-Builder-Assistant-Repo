#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const packDir = path.join(root, 'dist', 'chatgpt-project');
const manifestPath = path.join(packDir, 'SOURCE_PACK_MANIFEST.json');
const reportPath = path.join(packDir, 'BUILD_REPORT.json');

function fail(message) {
  console.error(`Project pack validation failed: ${message}`);
  process.exit(1);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

if (!fs.existsSync(manifestPath)) fail('missing SOURCE_PACK_MANIFEST.json');
if (!fs.existsSync(reportPath)) fail('missing BUILD_REPORT.json');

const manifest = JSON.parse(readText(manifestPath));
const report = JSON.parse(readText(reportPath));

const instructionRel = 'dist/chatgpt-project/PROJECT_INSTRUCTIONS.txt';
const instructionPath = path.join(root, instructionRel);
if (!fs.existsSync(instructionPath)) fail('missing PROJECT_INSTRUCTIONS.txt');

const projectInstructions = readText(instructionPath);
const instructionLimit = manifest.limits?.project_instructions_max_chars ?? 8000;
const warningLimit = manifest.limits?.project_instructions_warning_chars ?? 7800;

if (projectInstructions.length > instructionLimit) {
  fail(`PROJECT_INSTRUCTIONS.txt has ${projectInstructions.length} chars, limit is ${instructionLimit}`);
}
if (projectInstructions.length > warningLimit) {
  console.warn(`PROJECT_INSTRUCTIONS.txt is above warning threshold: ${projectInstructions.length}/${warningLimit}`);
}

const knowledgeDir = path.join(packDir, 'knowledge');
if (!fs.existsSync(knowledgeDir)) fail('missing knowledge directory');

const knowledgeFiles = fs.readdirSync(knowledgeDir)
  .filter((name) => fs.statSync(path.join(knowledgeDir, name)).isFile())
  .sort();

const maxKnowledgeFiles = manifest.limits?.knowledge_file_max_count ?? 25;
if (knowledgeFiles.length > maxKnowledgeFiles) {
  fail(`knowledge file count ${knowledgeFiles.length} exceeds ${maxKnowledgeFiles}`);
}

for (const name of knowledgeFiles) {
  if (/project[_-]?instructions/i.test(name)) {
    fail(`Project Instructions duplicated inside knowledge: ${name}`);
  }
}

for (const entry of manifest.files || []) {
  const abs = path.join(root, entry.path);
  if (!fs.existsSync(abs)) fail(`manifest path missing: ${entry.path}`);
  const content = readText(abs);
  const actual = sha256(content);
  if (actual !== entry.sha256) {
    fail(`hash mismatch for ${entry.path}: expected ${entry.sha256}, got ${actual}`);
  }
}

if (report.project_instructions_chars !== projectInstructions.length) {
  fail(`BUILD_REPORT project_instructions_chars mismatch: expected ${projectInstructions.length}, got ${report.project_instructions_chars}`);
}
if (report.knowledge_file_count !== knowledgeFiles.length) {
  fail(`BUILD_REPORT knowledge_file_count mismatch: expected ${knowledgeFiles.length}, got ${report.knowledge_file_count}`);
}

console.log(`Project pack verified: ${projectInstructions.length} instruction chars, ${knowledgeFiles.length} knowledge files.`);
