#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  computeCanonicalDigest,
  computePackageDigest,
  sha256Bytes
} from './lib/canonical-builder-package.mjs';
import {
  SOURCE_MODES,
  resolveExplicitBuilderSource,
  verifyDerivedContext
} from './lib/builder-explicit-source-runtime.mjs';

const ROOT = process.cwd();
const BASE_PACKAGE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'builder_context_package.json');
const CE_FIXTURE = path.join(ROOT, 'tests', 'valid', 'ce_builder_package_adapter_valid.json');
const TEMP = fs.mkdtempSync(path.join(ROOT, '.tmp-builder-explicit-source-'));
const passed = [];
const failures = [];

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const rel = (file) => path.relative(ROOT, file);
const clone = (value) => structuredClone(value);
const write = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return rel(file);
};
const hasCode = (result, code) => (result.diagnostics || []).some((entry) => entry.code === code);

function test(id, title, fn) {
  try {
    fn();
    passed.push({ id, title });
  } catch (error) {
    failures.push(`${id} ${title}: ${error.message}`);
  }
}

function cleanBuilderPackage() {
  const pkg = read(BASE_PACKAGE);
  for (const entry of pkg.source_payload_ledger || []) entry.source_ref = `operator-selected:${entry.payload_name}`;
  pkg.input_authorization.package_digest.value = computePackageDigest(pkg);
  return pkg;
}

function manualCase(name) {
  const dir = path.join(TEMP, name);
  const builderFile = path.join(dir, 'builder-input.json');
  write(builderFile, cleanBuilderPackage());
  const result = resolveExplicitBuilderSource({
    sourceMode: SOURCE_MODES.MANUAL_BUILDER_INPUT,
    builderInputFile: rel(builderFile)
  });
  assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
  const contextFile = path.join(dir, 'runtime-context.json');
  write(contextFile, result.context);
  return { dir, builderFile, contextFile, result, context: result.context };
}

function projectGateCase(name) {
  const dir = path.join(TEMP, name);
  const pkg = cleanBuilderPackage();
  const builderFile = path.join(dir, 'builder-input.json');
  write(builderFile, pkg);
  const receipt = {
    schema: 'ev4-project-gate-c2b-receipt@1.0.0',
    receipt_id: `PG-${name}`,
    producer_repository: 'untrusted-metadata/example',
    producer_commit_sha: '0'.repeat(40),
    source_file_sha256: sha256Bytes(fs.readFileSync(builderFile)),
    canonical_package_digest: computePackageDigest(pkg)
  };
  const receiptFile = path.join(dir, 'project-gate-receipt.json');
  write(receiptFile, receipt);
  const result = resolveExplicitBuilderSource({
    sourceMode: SOURCE_MODES.PROJECT_GATE,
    sourceArtifactFile: rel(receiptFile),
    builderInputFile: rel(builderFile)
  });
  assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
  const contextFile = path.join(dir, 'runtime-context.json');
  write(contextFile, result.context);
  return { dir, pkg, builderFile, receipt, receiptFile, result, contextFile, context: result.context };
}

function directCeCase(name) {
  const dir = path.join(TEMP, name);
  const wrapper = read(CE_FIXTURE);
  wrapper.content_sha256 = computeCanonicalDigest(wrapper.ce_builder_executable_package);
  wrapper.source_mode = 'project-gate';
  wrapper.producer_repository = 'metadata-is-not-authority/example';
  const sourceFile = path.join(dir, 'direct-ce-source.json');
  write(sourceFile, wrapper);
  const result = resolveExplicitBuilderSource({
    sourceMode: SOURCE_MODES.DIRECT_CE,
    sourceArtifactFile: rel(sourceFile)
  });
  assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
  const contextFile = path.join(dir, 'runtime-context.json');
  write(contextFile, result.context);
  return { dir, wrapper, sourceFile, result, contextFile, context: result.context };
}

try {
  test('F001-01', 'source mode is selected by Runtime invocation only', () => {
    const c = manualCase('invocation-only');
    assert.equal(c.context.source_mode, SOURCE_MODES.MANUAL_BUILDER_INPUT);
    assert.equal(c.context.source_selection, 'operator_explicit');
  });

  test('F001-02', 'caller source JSON cannot promote itself into another mode', () => {
    const c = projectGateCase('caller-mode-ignored');
    c.receipt.source_mode = SOURCE_MODES.DIRECT_CE;
    write(c.receiptFile, c.receipt);
    const result = resolveExplicitBuilderSource({
      sourceMode: SOURCE_MODES.PROJECT_GATE,
      sourceArtifactFile: rel(c.receiptFile),
      builderInputFile: rel(c.builderFile)
    });
    assert.equal(result.passed, true, JSON.stringify(result.diagnostics));
    assert.equal(result.context.source_mode, SOURCE_MODES.PROJECT_GATE);
  });

  test('F001-03', 'Project Gate Receipt paired with different Builder Input bytes is rejected', () => {
    const c = projectGateCase('receipt-wrong-bytes');
    fs.appendFileSync(c.builderFile, ' ');
    const result = resolveExplicitBuilderSource({
      sourceMode: SOURCE_MODES.PROJECT_GATE,
      sourceArtifactFile: rel(c.receiptFile),
      builderInputFile: rel(c.builderFile)
    });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'BUILDER-SOURCE-105'), true);
  });

  test('F001-04', 'Project Gate Receipt with mismatched package digest is rejected', () => {
    const c = projectGateCase('receipt-wrong-digest');
    c.receipt.canonical_package_digest = 'f'.repeat(64);
    write(c.receiptFile, c.receipt);
    const result = resolveExplicitBuilderSource({
      sourceMode: SOURCE_MODES.PROJECT_GATE,
      sourceArtifactFile: rel(c.receiptFile),
      builderInputFile: rel(c.builderFile)
    });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'BUILDER-SOURCE-106'), true);
  });

  test('F001-05', 'manual Builder Input is accepted only through explicit manual mode', () => {
    const c = manualCase('manual-explicit');
    assert.equal(c.context.content_binding_status, 'verified');
    const wrongMode = resolveExplicitBuilderSource({
      sourceMode: SOURCE_MODES.PROJECT_GATE,
      builderInputFile: rel(c.builderFile)
    });
    assert.equal(wrongMode.passed, false);
  });

  test('F001-06', 'manual input cannot claim Project Gate or CE origin', () => {
    const c = manualCase('manual-origin');
    assert.equal(c.context.origin_assurance, 'manual_operator_supplied');
    assert.equal(c.context.receipt_binding_status, 'not_applicable');
    assert.equal(Object.hasOwn(c.context, 'producer_repository'), false);
    assert.equal(Object.hasOwn(c.context, 'producer_commit_sha'), false);
    assert.equal(Object.hasOwn(c.context, 'verification_status'), false);
  });

  test('F001-07', 'source bytes modified after intake are rejected by fresh derivation', () => {
    const c = manualCase('manual-byte-drift');
    fs.appendFileSync(c.builderFile, ' ');
    const result = verifyDerivedContext({
      sourceMode: SOURCE_MODES.MANUAL_BUILDER_INPUT,
      builderInputFile: rel(c.builderFile),
      contextFile: rel(c.contextFile)
    });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'BUILDER-CONTEXT-113'), true);
  });

  test('F001-08', 'Context modified after intake is rejected even with recomputed Context digest', () => {
    const c = projectGateCase('context-drift');
    const altered = clone(c.context);
    altered.origin_assurance = 'independently_verified';
    delete altered.context_digest;
    altered.context_digest = computeCanonicalDigest(altered);
    write(c.contextFile, altered);
    const result = verifyDerivedContext({
      sourceMode: SOURCE_MODES.PROJECT_GATE,
      sourceArtifactFile: rel(c.receiptFile),
      builderInputFile: rel(c.builderFile),
      contextFile: rel(c.contextFile)
    });
    assert.equal(result.passed, false);
    assert.equal(hasCode(result, 'BUILDER-CONTEXT-106') || hasCode(result, 'BUILDER-CONTEXT-113'), true);
  });

  test('F001-09', 'valid Project Gate content-binding case is preserved without origin claims', () => {
    const c = projectGateCase('valid-project-gate');
    assert.equal(c.context.source_mode, SOURCE_MODES.PROJECT_GATE);
    assert.equal(c.context.receipt_binding_status, 'matched');
    assert.equal(c.context.origin_assurance, 'not_independently_verified');
    assert.equal(c.context.selected_source_sha256, sha256Bytes(fs.readFileSync(c.builderFile)));
  });

  test('F001-10', 'valid direct CE case is preserved without producer authentication', () => {
    const c = directCeCase('valid-direct-ce');
    assert.equal(c.context.source_mode, SOURCE_MODES.DIRECT_CE);
    assert.equal(c.context.content_binding_status, 'verified');
    assert.equal(c.context.origin_assurance, 'not_independently_verified');
    assert.equal(c.context.receipt_binding_status, 'not_applicable');
    assert.equal(Object.hasOwn(c.context, 'producer_repository'), false);
  });

  test('F001-11', 'valid manual mode preserves deterministic package Candidate Batch and Action derivation', () => {
    const c = manualCase('valid-manual');
    assert.equal(c.context.source_mode, SOURCE_MODES.MANUAL_BUILDER_INPUT);
    assert.equal(c.context.canonical_package_digest, computePackageDigest(cleanBuilderPackage()));
    assert.equal(typeof c.context.selected_candidate_id, 'string');
    assert.equal(c.context.action_batch.action_ids.length > 0, true);
    assert.equal(Object.keys(c.context.action_batch.action_digests).length, c.context.action_batch.action_ids.length);
  });
} finally {
  fs.rmSync(TEMP, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Explicit source mode tests failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Passed ${passed.length}/11 tests.`);
  process.exit(1);
}

console.log(`Explicit source mode tests passed: ${passed.length}/11.`);
