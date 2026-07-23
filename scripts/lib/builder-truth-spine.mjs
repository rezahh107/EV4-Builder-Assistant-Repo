import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { normalizeCeBuilderExecutablePackage } from '../normalize-ce-builder-executable-package.mjs';
import {
  computeCanonicalDigest,
  computePackageDigest,
  sha256Bytes,
  sortedCanonicalJson
} from './canonical-builder-package.mjs';
import {
  publishDirectoryAtomically,
  requireCanonicalTransition,
  runAjv,
  validateGeneratedCompletionCarriers,
  verifyBuilderInput,
  verifyRuntimeIdentity
} from './builder-runtime-transition.mjs';

const ROOT = process.cwd();
const HASH = /^[a-f0-9]{64}$/;

export const RUNTIME_MODES = Object.freeze({
  FIXTURE: 'fixture-validation',
  REAL: 'real-builder-run'
});

export const CLAIM_COMPATIBILITY = Object.freeze({
  required_action_execution: ['diagnostic'],
  scaffold_built: ['diagnostic'],
  structure_built: ['structure_panel_screenshot'],
  content_filled: ['editor_screenshot'],
  desktop_layout_established: ['frontend_screenshot'],
  layout_verified: ['frontend_screenshot'],
  export_checked: ['export_json'],
  export_verified: ['export_json']
});

const REQUIRED_COMPLETION_CLAIMS = Object.freeze([
  'scaffold_built',
  'structure_built',
  'content_filled',
  'desktop_layout_established',
  'layout_verified',
  'export_checked',
  'export_verified'
]);

const ALLOWED_MULTI_CLAIM_SETS = new Set([
  ['desktop_layout_established', 'layout_verified'].sort().join('|'),
  ['export_checked', 'export_verified'].sort().join('|')
]);

function diagnostic(code, message, detail = '') {
  return { code, message, ...(detail ? { detail } : {}) };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readBytes(file) {
  return fs.readFileSync(path.resolve(ROOT, file));
}

function readJson(file) {
  return JSON.parse(readBytes(file).toString('utf8'));
}

function writeJsonAtomic(file, value) {
  const target = path.resolve(ROOT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, target);
  } catch (error) {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function runNode(script, ...args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: false
  });
  const detail = result.error?.message || `${result.stderr || ''}\n${result.stdout || ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-10)
    .join(' | ')
    .slice(0, 1600);
  return { passed: !result.error && result.status === 0, detail };
}

function scanSynthetic(value, location = '$', findings = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanSynthetic(entry, `${location}[${index}]`, findings));
    return findings;
  }
  if (!isObject(value)) return findings;
  for (const [key, entry] of Object.entries(value)) {
    const next = `${location}.${key}`;
    if (key === 'fixture_classification' && typeof entry === 'string' && /synthetic|fixture|test/i.test(entry)) {
      findings.push(next);
    }
    if (key === 'synthetic' && entry === true) findings.push(next);
    if (typeof entry === 'string' && /^(synthetic_validation_only|test-fixture(?::|$))/i.test(entry)) findings.push(next);
    scanSynthetic(entry, next, findings);
  }
  return findings;
}

function batchIdentity(builderPackage) {
  const actions = builderPackage?.first_builder_batch?.actions;
  if (!Array.isArray(actions) || actions.length === 0) throw new Error('Builder package has no active Action Batch.');
  const ids = actions.map((action) => action?.action_id);
  if (ids.some((value) => typeof value !== 'string' || !value)) throw new Error('Every Action requires action_id.');
  if (new Set(ids).size !== ids.length) throw new Error('Action Batch contains duplicate action_id values.');
  const prefixes = ids.map((value) => value.match(/^(.+)-A\d+$/)?.[1] ?? null);
  if (prefixes.some((value) => !value) || new Set(prefixes).size !== 1) throw new Error('Action IDs do not identify one bounded batch.');
  return {
    batch_id: prefixes[0],
    action_ids: ids,
    action_digests: Object.fromEntries(actions.map((action) => [action.action_id, computeCanonicalDigest(action)]))
  };
}

function deriveDecisionLineage(builderPackage, packageDigest) {
  return (Array.isArray(builderPackage?.decision_lineage) ? builderPackage.decision_lineage : []).map((entry) => {
    const manual = entry?.verification_status === 'manual_attributed' || entry?.evidence_state === 'manual';
    return {
      decision_family: entry?.decision_family ?? null,
      decision_card_ref: entry?.decision_card_ref ?? null,
      selected_option: entry?.selected_option ?? null,
      source_package_digest: packageDigest,
      producer_stage: builderPackage?.source_stage ?? null,
      verification_status: manual ? 'manual_attributed' : 'source_bound',
      may_authorize_new_design_decision: false
    };
  });
}

function contextWithoutDigest(context) {
  const clone = structuredClone(context);
  delete clone.context_digest;
  return clone;
}

function receiptWithoutDigest(receipt) {
  const clone = structuredClone(receipt);
  delete clone.receipt_digest;
  return clone;
}

function buildContext({ sourceKind, sourceArtifactFile, sourceArtifact, builderInputFile, builderInputBytes, builderPackage }) {
  const actionBatch = batchIdentity(builderPackage);
  const packageDigest = computePackageDigest(builderPackage);
  const context = {
    schema: 'ev4-builder-verified-context@1.0.0',
    runtime_mode: RUNTIME_MODES.REAL,
    source_kind: sourceKind,
    source_artifact_ref: path.relative(ROOT, path.resolve(ROOT, sourceArtifactFile)),
    source_file_sha256: sha256Bytes(readBytes(sourceArtifactFile)),
    builder_input_ref: builderInputFile ? path.relative(ROOT, path.resolve(ROOT, builderInputFile)) : null,
    builder_input_sha256: sha256Bytes(builderInputBytes),
    canonical_package_digest: packageDigest,
    selected_candidate_id: builderPackage.selected_candidate_id,
    builder_context_schema: builderPackage.schema,
    producer_repository: sourceArtifact?.producer_repository ?? null,
    producer_commit_sha: sourceArtifact?.producer_commit_sha ?? null,
    producer_artifact_id: sourceArtifact?.producer_artifact_id
      ?? sourceArtifact?.receipt_id
      ?? sourceArtifact?.package_id
      ?? sourceArtifact?.schema
      ?? null,
    producer_artifact_sha256: sha256Bytes(readBytes(sourceArtifactFile)),
    verification_status: 'verified_source_bound',
    synthetic_derived: false,
    action_batch: actionBatch,
    confirmation: {
      confirmation_id: builderPackage?.confirmation_request?.confirmation_id ?? `CONFIRM-${actionBatch.batch_id}`,
      expected_user_token: builderPackage?.confirmation_request?.expected_user_token ?? `تایید ${actionBatch.batch_id}`
    },
    decision_lineage: deriveDecisionLineage(builderPackage, packageDigest)
  };
  context.context_digest = computeCanonicalDigest(contextWithoutDigest(context));
  return context;
}

function verifyContextShape(context) {
  const diagnostics = [];
  if (context?.schema !== 'ev4-builder-verified-context@1.0.0') diagnostics.push(diagnostic('BUILDER-CONTEXT-001', 'Unsupported verified Builder Context schema.'));
  if (context?.runtime_mode !== RUNTIME_MODES.REAL) diagnostics.push(diagnostic('BUILDER-CONTEXT-002', 'Verified Builder Context is not a real-builder-run carrier.'));
  if (context?.synthetic_derived !== false) diagnostics.push(diagnostic('BUILDER-CONTEXT-003', 'Verified Builder Context is synthetic.'));
  if (!HASH.test(context?.canonical_package_digest || '')) diagnostics.push(diagnostic('BUILDER-CONTEXT-004', 'Verified Builder Context package digest is invalid.'));
  if (!HASH.test(context?.context_digest || '') || context.context_digest !== computeCanonicalDigest(contextWithoutDigest(context))) {
    diagnostics.push(diagnostic('BUILDER-CONTEXT-005', 'Verified Builder Context digest is missing or invalid.'));
  }
  return diagnostics;
}

export function fixtureValidateBuilderInput(sourceFile) {
  const verification = verifyBuilderInput(sourceFile);
  return {
    schema: 'ev4-builder-fixture-validation-result@1.0.0',
    status: verification.passed ? 'accepted' : 'blocked',
    runtime_mode: RUNTIME_MODES.FIXTURE,
    synthetic_validation_passed: verification.passed,
    would_complete: verification.passed,
    builder_build_complete: false,
    runtime_state: 'NOT_A_REAL_RUN',
    source_file_sha256: verification.identity?.source_file_sha256 ?? sha256Bytes(readBytes(sourceFile)),
    canonical_package_digest: verification.identity?.canonical_package_digest ?? null,
    selected_candidate_id: verification.identity?.selected_candidate_id ?? null,
    builder_context_schema: verification.identity?.builder_context_schema ?? null,
    blocking_diagnostics: verification.diagnostics
  };
}

export function resolveRealBuilderSource({ sourceKind, sourceArtifactFile, builderInputFile = null }) {
  const diagnostics = [];
  let sourceArtifact;
  try {
    sourceArtifact = readJson(sourceArtifactFile);
  } catch (error) {
    return { passed: false, diagnostics: [diagnostic('BUILDER-SOURCE-001', 'Source artifact is unreadable or malformed.', error.message)] };
  }

  const sourceSynthetic = scanSynthetic(sourceArtifact);
  if (sourceSynthetic.length) diagnostics.push(diagnostic('BUILDER-SOURCE-002', 'Real mode rejects synthetic source indicators.', sourceSynthetic.join(', ')));

  let builderPackage = null;
  let builderInputBytes = null;

  if (sourceKind === 'project-gate') {
    if (sourceArtifact.schema !== 'ev4-project-gate-c2b-receipt@1.0.0') {
      diagnostics.push(diagnostic('BUILDER-SOURCE-003', 'Project Gate source must be ev4-project-gate-c2b-receipt@1.0.0.'));
    }
    if (!builderInputFile) diagnostics.push(diagnostic('BUILDER-SOURCE-004', 'Project Gate real intake requires exact Builder Input bytes.'));
    if (builderInputFile) {
      const verification = verifyBuilderInput(builderInputFile);
      diagnostics.push(...verification.diagnostics);
      builderPackage = verification.package;
      builderInputBytes = readBytes(builderInputFile);
      const actualSha = sha256Bytes(builderInputBytes);
      if (sourceArtifact.source_file_sha256 !== actualSha) diagnostics.push(diagnostic('BUILDER-SOURCE-005', 'Project Gate receipt does not bind the actual Builder Input bytes.'));
      if (sourceArtifact.canonical_package_digest !== verification.identity?.canonical_package_digest) diagnostics.push(diagnostic('BUILDER-SOURCE-006', 'Project Gate receipt package digest does not match the derived Builder package digest.'));
      const nestedSynthetic = scanSynthetic(builderPackage);
      if (nestedSynthetic.length) diagnostics.push(diagnostic('BUILDER-SOURCE-007', 'Real mode rejects synthetic indicators inside Builder Input.', nestedSynthetic.join(', ')));
    }
  } else if (sourceKind === 'direct-ce') {
    const cePackage = sourceArtifact.ce_builder_executable_package;
    if (!isObject(cePackage)) diagnostics.push(diagnostic('BUILDER-SOURCE-008', 'Direct CE source must contain ce_builder_executable_package.'));
    if (!HASH.test(sourceArtifact.content_sha256 || '') || (isObject(cePackage) && sourceArtifact.content_sha256 !== computeCanonicalDigest(cePackage))) {
      diagnostics.push(diagnostic('BUILDER-SOURCE-009', 'Direct CE source content_sha256 does not match canonical CE package bytes.'));
    }
    if (isObject(cePackage)) {
      try {
        builderPackage = normalizeCeBuilderExecutablePackage(cePackage);
        builderInputBytes = Buffer.from(`${JSON.stringify(builderPackage, null, 2)}\n`, 'utf8');
        const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-builder-source-'));
        try {
          const file = path.join(temp, 'builder-input.json');
          fs.writeFileSync(file, builderInputBytes);
          const verification = verifyBuilderInput(file);
          diagnostics.push(...verification.diagnostics);
        } finally {
          fs.rmSync(temp, { recursive: true, force: true });
        }
      } catch (error) {
        diagnostics.push(diagnostic('BUILDER-SOURCE-010', 'Direct CE source could not be normalized by the repository-owned adapter.', error.message));
      }
    }
  } else {
    diagnostics.push(diagnostic('BUILDER-SOURCE-011', `Unsupported real source kind: ${sourceKind}.`));
  }

  if (!builderPackage || !builderInputBytes) diagnostics.push(diagnostic('BUILDER-SOURCE-012', 'Runtime-derived Builder package is unavailable.'));
  if (builderPackage && scanSynthetic(builderPackage).length) diagnostics.push(diagnostic('BUILDER-SOURCE-013', 'Runtime-derived Builder package contains synthetic indicators.'));

  if (diagnostics.length) return { passed: false, diagnostics, sourceArtifact, builderPackage };
  const context = buildContext({ sourceKind, sourceArtifactFile, sourceArtifact, builderInputFile, builderInputBytes, builderPackage });
  return { passed: true, diagnostics: [], sourceArtifact, builderPackage, builderInputBytes, context };
}

export function verifyDerivedContext({ sourceKind, sourceArtifactFile, builderInputFile = null, contextFile }) {
  const resolution = resolveRealBuilderSource({ sourceKind, sourceArtifactFile, builderInputFile });
  const diagnostics = [...resolution.diagnostics];
  let supplied = null;
  try {
    supplied = readJson(contextFile);
    diagnostics.push(...verifyContextShape(supplied));
  } catch (error) {
    diagnostics.push(diagnostic('BUILDER-CONTEXT-006', 'Verified Builder Context is unreadable or malformed.', error.message));
  }
  if (resolution.context && supplied && sortedCanonicalJson(resolution.context) !== sortedCanonicalJson(supplied)) {
    diagnostics.push(diagnostic('BUILDER-CONTEXT-007', 'Supplied Builder Context does not match the freshly derived source-bound Context.'));
  }
  return { ...resolution, suppliedContext: supplied, passed: resolution.passed && diagnostics.length === 0, diagnostics };
}

export function writeRealIntake({ sourceKind, sourceArtifactFile, builderInputFile = null, contextOutputFile, resultOutputFile = null }) {
  const resolution = resolveRealBuilderSource({ sourceKind, sourceArtifactFile, builderInputFile });
  const result = {
    schema: 'ev4-builder-real-intake-result@1.0.0',
    status: resolution.passed ? 'accepted' : 'blocked',
    runtime_mode: RUNTIME_MODES.REAL,
    builder_build_complete: false,
    runtime_state: resolution.passed ? 'BUILD_ACTIVE' : 'INTAKE_VALIDATING',
    context_digest: resolution.context?.context_digest ?? null,
    canonical_package_digest: resolution.context?.canonical_package_digest ?? null,
    selected_candidate_id: resolution.context?.selected_candidate_id ?? null,
    blocking_diagnostics: resolution.diagnostics
  };
  if (resolution.passed) writeJsonAtomic(contextOutputFile, resolution.context);
  if (resultOutputFile) writeJsonAtomic(resultOutputFile, result);
  return { ...resolution, result };
}

function validateSessionAndCheckpoint(sessionFile, checkpointFile) {
  const diagnostics = [];
  const sessionSchema = runAjv('schemas/session-state.schema.json', sessionFile, [
    'schemas/checkpoint.schema.json',
    'schemas/evidence-record.schema.json',
    'schemas/repair-packet.schema.json'
  ]);
  const checkpointSchema = runAjv('schemas/checkpoint.schema.json', checkpointFile, ['schemas/evidence-record.schema.json']);
  const sessionSemantic = runNode('scripts/validate-session-state.mjs', sessionFile);
  const checkpointSemantic = runNode('scripts/validate-checkpoint.mjs', checkpointFile);
  if (!sessionSchema.passed || !sessionSemantic.passed) diagnostics.push(diagnostic('BUILDER-RUNTIME-001', 'Session State validation failed.', sessionSchema.detail || sessionSemantic.detail));
  if (!checkpointSchema.passed || !checkpointSemantic.passed) diagnostics.push(diagnostic('BUILDER-RUNTIME-002', 'Checkpoint validation failed.', checkpointSchema.detail || checkpointSemantic.detail));
  return diagnostics;
}

export function createConfirmationReceipt({ contextFile, sessionFile, checkpointFile, userToken }) {
  const diagnostics = [];
  let context;
  let session;
  let checkpoint;
  try {
    context = readJson(contextFile);
    session = readJson(sessionFile);
    checkpoint = readJson(checkpointFile);
  } catch (error) {
    return { passed: false, diagnostics: [diagnostic('BUILDER-CONFIRM-001', 'Confirmation inputs are unreadable or malformed.', error.message)] };
  }
  diagnostics.push(...verifyContextShape(context));
  diagnostics.push(...validateSessionAndCheckpoint(sessionFile, checkpointFile));
  const identity = verifyRuntimeIdentity({ identity: {
    canonical_package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id
  } }, session, checkpoint);
  diagnostics.push(...identity.diagnostics);
  if (!['WAITING_FOR_CONFIRMATION', 'BUILD_ACTIVE'].includes(session.runtime_state) || session.runtime_state !== checkpoint.runtime_state) {
    diagnostics.push(diagnostic('BUILDER-CONFIRM-002', 'Confirmation requires one active Session/Checkpoint state.'));
  }
  if (typeof userToken !== 'string' || !userToken) diagnostics.push(diagnostic('BUILDER-CONFIRM-003', 'Explicit operator token is required.'));
  if (userToken !== context.confirmation?.expected_user_token) diagnostics.push(diagnostic('BUILDER-CONFIRM-004', 'Operator token does not match the active Action Batch.'));
  if (checkpoint.batch_id !== context.action_batch?.batch_id) diagnostics.push(diagnostic('BUILDER-CONFIRM-005', 'Checkpoint Action Batch does not match verified Builder Context.'));

  if (diagnostics.length) return { passed: false, diagnostics, context, session, checkpoint };
  const receipt = {
    schema: 'ev4-builder-confirmation-receipt@1.0.0',
    runtime_mode: RUNTIME_MODES.REAL,
    confirmation_id: context.confirmation.confirmation_id,
    session_id: session.session_id,
    package_digest: context.canonical_package_digest,
    selected_candidate_id: context.selected_candidate_id,
    batch_id: context.action_batch.batch_id,
    confirmed_action_ids: [...context.action_batch.action_ids],
    confirmed_action_digests: { ...context.action_batch.action_digests },
    user_token: userToken,
    captured_at: new Date().toISOString(),
    context_digest: context.context_digest
  };
  receipt.receipt_digest = computeCanonicalDigest(receiptWithoutDigest(receipt));
  return { passed: true, diagnostics: [], receipt, context, session, checkpoint };
}

export function writeConfirmationReceipt(options) {
  const result = createConfirmationReceipt(options);
  if (result.passed) writeJsonAtomic(options.outputFile, result.receipt);
  return result;
}

function sameSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

export function validateConfirmationReceipt({ receiptFile, context, session, checkpoint }) {
  const diagnostics = [];
  let receipt;
  try {
    receipt = readJson(receiptFile);
  } catch (error) {
    return { passed: false, diagnostics: [diagnostic('BUILDER-CONFIRM-006', 'Confirmation Receipt is unreadable or malformed.', error.message)], receipt: null };
  }
  if (receipt.schema !== 'ev4-builder-confirmation-receipt@1.0.0') diagnostics.push(diagnostic('BUILDER-CONFIRM-007', 'Unsupported Confirmation Receipt schema.'));
  if (receipt.runtime_mode !== RUNTIME_MODES.REAL) diagnostics.push(diagnostic('BUILDER-CONFIRM-008', 'Fixture confirmation cannot authorize a real Builder Run.'));
  if (!HASH.test(receipt.receipt_digest || '') || receipt.receipt_digest !== computeCanonicalDigest(receiptWithoutDigest(receipt))) diagnostics.push(diagnostic('BUILDER-CONFIRM-009', 'Confirmation Receipt digest is invalid.'));
  if (receipt.context_digest !== context.context_digest) diagnostics.push(diagnostic('BUILDER-CONFIRM-010', 'Confirmation Receipt is bound to another verified Builder Context.'));
  if (receipt.session_id !== session.session_id) diagnostics.push(diagnostic('BUILDER-CONFIRM-011', 'Confirmation Receipt is bound to another Session.'));
  if (receipt.package_digest !== context.canonical_package_digest) diagnostics.push(diagnostic('BUILDER-CONFIRM-012', 'Confirmation Receipt is bound to another Package.'));
  if (receipt.batch_id !== context.action_batch.batch_id) diagnostics.push(diagnostic('BUILDER-CONFIRM-013', 'Confirmation Receipt is bound to another Action Batch.'));
  if (!sameSet(receipt.confirmed_action_ids, context.action_batch.action_ids)) diagnostics.push(diagnostic('BUILDER-CONFIRM-014', 'Confirmation Receipt Action set is incomplete or foreign.'));
  if (sortedCanonicalJson(receipt.confirmed_action_digests) !== sortedCanonicalJson(context.action_batch.action_digests)) diagnostics.push(diagnostic('BUILDER-CONFIRM-015', 'Confirmation Receipt Action body digests are stale or foreign.'));
  if (receipt.user_token !== context.confirmation.expected_user_token) diagnostics.push(diagnostic('BUILDER-CONFIRM-016', 'Confirmation Receipt operator token is invalid.'));
  if (!sameSet(checkpoint.confirmed_action_ids || [], receipt.confirmed_action_ids || []) || (checkpoint.unconfirmed_action_ids || []).length !== 0) diagnostics.push(diagnostic('BUILDER-CONFIRM-017', 'Checkpoint confirmation mirrors do not match the validated Receipt.'));
  return { passed: diagnostics.length === 0, diagnostics, receipt };
}

function safeEvidencePath(sourceRef) {
  if (typeof sourceRef !== 'string' || !sourceRef || path.isAbsolute(sourceRef)) return null;
  const candidate = path.resolve(ROOT, sourceRef);
  const relative = path.relative(ROOT, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return candidate;
}

function claimSetCompatible(claimClasses) {
  if (claimClasses.length <= 1) return true;
  return ALLOWED_MULTI_CLAIM_SETS.has([...claimClasses].sort().join('|'));
}

export function verifyEvidenceLedger({ checkpoint, checkpointFile, context, session }) {
  const diagnostics = [];
  const records = new Map((checkpoint.evidence_ledger || []).map((entry) => [entry.evidence_id, entry]));
  const verified = [];
  const actionEvidence = new Set();
  const verifiedClaimClasses = new Set();

  for (const assertion of checkpoint.assertions || []) {
    const refs = Array.isArray(assertion.evidence_refs) ? assertion.evidence_refs : [];
    if (refs.length === 0) diagnostics.push(diagnostic('BUILDER-EVIDENCE-001', `Assertion ${assertion.assertion_id} has no Evidence reference.`));
    for (const evidenceId of refs) {
      const record = records.get(evidenceId);
      if (!record) {
        diagnostics.push(diagnostic('BUILDER-EVIDENCE-002', `Assertion ${assertion.assertion_id} references unknown Evidence ${evidenceId}.`));
        continue;
      }
      if (record.status !== 'available') {
        diagnostics.push(diagnostic('BUILDER-EVIDENCE-003', `Evidence ${evidenceId} is not available.`));
        continue;
      }
      if (!(record.supports_claim_ids || []).includes(assertion.assertion_id)) diagnostics.push(diagnostic('BUILDER-EVIDENCE-004', `Evidence ${evidenceId} does not declare support for ${assertion.assertion_id}.`));
      const sourcePath = safeEvidencePath(record.source_ref);
      if (!sourcePath) {
        diagnostics.push(diagnostic('BUILDER-EVIDENCE-005', `Evidence ${evidenceId} has an unsafe or ambiguous source_ref.`));
        continue;
      }
      let bytes;
      try {
        bytes = fs.readFileSync(sourcePath);
      } catch (error) {
        diagnostics.push(diagnostic('BUILDER-EVIDENCE-006', `Evidence source for ${evidenceId} cannot be read.`, error.message));
        continue;
      }
      const actualSha = sha256Bytes(bytes);
      if (actualSha !== String(record.content_sha256 || '').toLowerCase()) {
        diagnostics.push(diagnostic('BUILDER-EVIDENCE-007', `Evidence ${evidenceId} content_sha256 does not match source bytes.`));
        continue;
      }
      let source;
      try {
        source = JSON.parse(bytes.toString('utf8'));
      } catch (error) {
        diagnostics.push(diagnostic('BUILDER-EVIDENCE-008', `Consequential Evidence ${evidenceId} must be machine-readable JSON.`, error.message));
        continue;
      }
      if (source.schema !== 'ev4-builder-evidence-source@1.0.0') diagnostics.push(diagnostic('BUILDER-EVIDENCE-009', `Evidence ${evidenceId} has an unsupported source schema.`));
      if (source.evidence_type !== record.evidence_type) diagnostics.push(diagnostic('BUILDER-EVIDENCE-010', `Evidence ${evidenceId} type does not match its source content.`));
      if (!(source.claim_ids || []).includes(assertion.assertion_id)) diagnostics.push(diagnostic('BUILDER-EVIDENCE-011', `Evidence ${evidenceId} source does not bind claim ${assertion.assertion_id}.`));
      if (source.subject_ref !== assertion.subject_ref) diagnostics.push(diagnostic('BUILDER-EVIDENCE-012', `Evidence ${evidenceId} is bound to another subject.`));
      if (source.session_id !== session.session_id) diagnostics.push(diagnostic('BUILDER-EVIDENCE-013', `Evidence ${evidenceId} is bound to another Session.`));
      if (source.package_digest !== context.canonical_package_digest) diagnostics.push(diagnostic('BUILDER-EVIDENCE-014', `Evidence ${evidenceId} is bound to another Package.`));
      if (scanSynthetic(source).length) diagnostics.push(diagnostic('BUILDER-EVIDENCE-015', `Synthetic Evidence ${evidenceId} is forbidden in real-builder-run.`));
      const claimClasses = Array.isArray(source.claim_classes) ? source.claim_classes : [];
      if (!claimClasses.length) diagnostics.push(diagnostic('BUILDER-EVIDENCE-016', `Evidence ${evidenceId} has no consequential claim_classes.`));
      if (!claimSetCompatible(claimClasses)) diagnostics.push(diagnostic('BUILDER-EVIDENCE-017', `Evidence ${evidenceId} attempts incompatible proof reuse.`));
      for (const claimClass of claimClasses) {
        const allowedTypes = CLAIM_COMPATIBILITY[claimClass];
        if (!allowedTypes || !allowedTypes.includes(record.evidence_type)) diagnostics.push(diagnostic('BUILDER-EVIDENCE-018', `Evidence type ${record.evidence_type} cannot satisfy ${claimClass}.`));
      }
      if (assertion.subject_ref?.match(/^BATCH-.+-A\d+$/)) {
        if (source.action_id !== assertion.subject_ref) diagnostics.push(diagnostic('BUILDER-EVIDENCE-019', `Evidence ${evidenceId} is bound to another Action.`));
        if (!context.action_batch.action_ids.includes(source.action_id)) diagnostics.push(diagnostic('BUILDER-EVIDENCE-020', `Evidence ${evidenceId} references a foreign Action.`));
      }
      const evidenceDiagnostics = diagnostics.filter((entry) => entry.message.includes(evidenceId));
      if (evidenceDiagnostics.length === 0) {
        verified.push({ evidence_id: evidenceId, source_path: path.relative(ROOT, sourcePath), actual_sha256: actualSha, evidence_type: record.evidence_type, claim_classes: claimClasses, subject_ref: source.subject_ref, action_id: source.action_id ?? null, verification_status: 'verified' });
        claimClasses.forEach((claimClass) => verifiedClaimClasses.add(claimClass));
        if (claimClasses.includes('required_action_execution') && source.action_id) actionEvidence.add(source.action_id);
      }
    }
  }

  for (const actionId of context.action_batch.action_ids) {
    if (!actionEvidence.has(actionId)) diagnostics.push(diagnostic('BUILDER-EVIDENCE-021', `Required Action ${actionId} lacks verified execution Evidence.`));
  }
  for (const claimClass of REQUIRED_COMPLETION_CLAIMS) {
    if (!verifiedClaimClasses.has(claimClass)) diagnostics.push(diagnostic('BUILDER-EVIDENCE-022', `Required Completion claim lacks compatible verified Evidence: ${claimClass}.`));
  }
  return { passed: diagnostics.length === 0, diagnostics, verified, verified_claim_classes: [...verifiedClaimClasses].sort(), verified_action_ids: [...actionEvidence].sort() };
}

function blockersFrom(session, checkpoint) {
  const values = [
    ...(Array.isArray(session.unresolved_evidence) ? session.unresolved_evidence : []),
    ...(Array.isArray(checkpoint.unresolved_blockers) ? checkpoint.unresolved_blockers : []),
    ...(checkpoint.assertions || []).filter((entry) => ['not_checked', 'insufficient_evidence'].includes(entry?.status)).map((entry) => entry.assertion_id)
  ];
  return [...new Set(values)];
}

function deriveCompletion(evidence) {
  const claims = new Set(evidence.verified_claim_classes);
  const states = {
    scaffold_built: claims.has('scaffold_built'),
    structure_built: claims.has('structure_built'),
    content_filled: claims.has('content_filled'),
    desktop_layout_established: claims.has('desktop_layout_established'),
    export_checked: claims.has('export_checked')
  };
  const proofs = {
    layout_verified: {
      claim_id: 'layout_verified',
      subject_ref: 'builder-output',
      verification_method: 'source_bound_evidence',
      required_evidence_types: CLAIM_COMPATIBILITY.layout_verified,
      verified_evidence_refs: evidence.verified.filter((entry) => entry.claim_classes.includes('layout_verified')).map((entry) => entry.evidence_id),
      derived_status: claims.has('layout_verified') ? 'confirmed' : 'missing',
      diagnostics: []
    },
    export_verified: {
      claim_id: 'export_verified',
      subject_ref: 'builder-output',
      verification_method: 'source_bound_evidence',
      required_evidence_types: CLAIM_COMPATIBILITY.export_verified,
      verified_evidence_refs: evidence.verified.filter((entry) => entry.claim_classes.includes('export_verified')).map((entry) => entry.evidence_id),
      derived_status: claims.has('export_verified') ? 'confirmed' : 'missing',
      diagnostics: []
    }
  };
  return {
    status: {
      schema: 'ev4-builder-derived-completion-status@1.0.0',
      claim_scope: 'desktop',
      states,
      evidence: { export: states.export_checked },
      derivation: {
        required_actions_verified: true,
        verified_evidence_refs: evidence.verified.map((entry) => entry.evidence_id),
        unresolved_blockers: []
      },
      scope_excludes_responsive: true,
      production_ready: false
    },
    gate: {
      schema: 'ev4-builder-derived-completion-gate@1.0.0',
      proofs,
      responsive_complete: false,
      production_ready: false
    }
  };
}

export function validateRealCompletion({ sourceKind, sourceArtifactFile, builderInputFile = null, contextFile, sessionFile, checkpointFile, confirmationReceiptFile }) {
  const diagnostics = [];
  let canonical;
  try {
    canonical = requireCanonicalTransition('complete-builder');
  } catch (error) {
    diagnostics.push(diagnostic('BUILDER-COMPLETE-ROOT-001', error.message));
  }
  const contextVerification = verifyDerivedContext({ sourceKind, sourceArtifactFile, builderInputFile, contextFile });
  diagnostics.push(...contextVerification.diagnostics);
  let session;
  let checkpoint;
  try {
    session = readJson(sessionFile);
    checkpoint = readJson(checkpointFile);
  } catch (error) {
    diagnostics.push(diagnostic('BUILDER-COMPLETE-ROOT-002', 'Completion carriers are unreadable or malformed.', error.message));
    return { passed: false, diagnostics };
  }
  diagnostics.push(...validateSessionAndCheckpoint(sessionFile, checkpointFile));
  const context = contextVerification.context;
  if (context) {
    const identity = verifyRuntimeIdentity({ identity: { canonical_package_digest: context.canonical_package_digest, selected_candidate_id: context.selected_candidate_id } }, session, checkpoint);
    diagnostics.push(...identity.diagnostics);
  }
  if (session.workflow_mode !== 'APPROVED_HANDOFF_MODE' || session.runtime_state !== 'BUILD_ACTIVE' || session.current_state !== 'BUILD_ACTIVE' || checkpoint.workflow_mode !== 'APPROVED_HANDOFF_MODE' || checkpoint.runtime_state !== 'BUILD_ACTIVE') {
    diagnostics.push(diagnostic('BUILDER-COMPLETE-ROOT-003', 'Real Completion requires APPROVED_HANDOFF_MODE / BUILD_ACTIVE predecessor carriers.'));
  }
  const blockers = blockersFrom(session, checkpoint);
  if (blockers.length) diagnostics.push(diagnostic('BUILDER-COMPLETE-ROOT-004', `Completion has unresolved blockers: ${blockers.join(', ')}.`));
  const confirmation = context ? validateConfirmationReceipt({ receiptFile: confirmationReceiptFile, context, session, checkpoint }) : { passed: false, diagnostics: [diagnostic('BUILDER-CONFIRM-000', 'Verified Context unavailable.')], receipt: null };
  diagnostics.push(...confirmation.diagnostics);
  const evidence = context ? verifyEvidenceLedger({ checkpoint, checkpointFile, context, session }) : { passed: false, diagnostics: [diagnostic('BUILDER-EVIDENCE-000', 'Verified Context unavailable.')], verified: [], verified_claim_classes: [], verified_action_ids: [] };
  diagnostics.push(...evidence.diagnostics);
  const derived = evidence.passed ? deriveCompletion(evidence) : null;
  if (derived && Object.values(derived.status.states).some((value) => value !== true)) diagnostics.push(diagnostic('BUILDER-COMPLETE-ROOT-005', 'Derived Completion Status is incomplete.'));
  if (derived && Object.values(derived.gate.proofs).some((proof) => proof.derived_status !== 'confirmed')) diagnostics.push(diagnostic('BUILDER-COMPLETE-ROOT-006', 'Derived Completion Gate is incomplete.'));
  return { passed: contextVerification.passed && confirmation.passed && evidence.passed && diagnostics.length === 0, diagnostics, canonical, context, builderPackage: contextVerification.builderPackage, session, checkpoint, confirmation: confirmation.receipt, evidence, derived, blockers };
}

export function publishRealCompletion(options) {
  const validation = validateRealCompletion(options);
  if (!validation.passed) return validation;
  const { context, session, checkpoint, evidence, derived } = validation;
  const key = computeCanonicalDigest({
    session_id: session.session_id,
    package_digest: context.canonical_package_digest,
    checkpoint_id: checkpoint.checkpoint_id,
    checkpoint_sequence: checkpoint.checkpoint_sequence,
    action_ids: context.action_batch.action_ids,
    confirmation_receipt: validation.confirmation.receipt_digest,
    evidence_ids: evidence.verified.map((entry) => entry.evidence_id)
  }).slice(0, 12);
  const nextCheckpoint = structuredClone(checkpoint);
  nextCheckpoint.checkpoint_id = `${checkpoint.checkpoint_id}-COMPLETE-${key}`;
  nextCheckpoint.checkpoint_sequence = checkpoint.checkpoint_sequence + 1;
  nextCheckpoint.parent_checkpoint_id = checkpoint.checkpoint_id;
  nextCheckpoint.workflow_mode = 'APPROVED_HANDOFF_MODE';
  nextCheckpoint.runtime_state = 'COMPLETED';
  nextCheckpoint.unresolved_blockers = [];
  const predecessorTime = Date.parse(checkpoint.created_at || '');
  nextCheckpoint.created_at = Number.isFinite(predecessorTime) ? new Date(predecessorTime + 1000).toISOString() : '1970-01-01T00:00:01.000Z';
  nextCheckpoint.created_from = 'export_json';

  const nextSession = structuredClone(session);
  nextSession.workflow_mode = 'APPROVED_HANDOFF_MODE';
  nextSession.runtime_state = 'COMPLETED';
  nextSession.current_state = 'COMPLETED';
  nextSession.last_verified_checkpoint = nextCheckpoint;
  nextSession.unresolved_evidence = [];
  delete nextSession.resume_target;

  const result = {
    schema: 'ev4-builder-runtime-transition-result@1.0.0',
    transition_id: 'complete-builder',
    status: 'accepted',
    source: { workflow_mode: session.workflow_mode, runtime_state: session.runtime_state },
    target: { workflow_mode: nextSession.workflow_mode, runtime_state: nextSession.runtime_state },
    identity: {
      session_id: session.session_id,
      package_digest: context.canonical_package_digest,
      selected_candidate_id: context.selected_candidate_id,
      checkpoint_id: checkpoint.checkpoint_id,
      checkpoint_sequence: checkpoint.checkpoint_sequence
    },
    resulting_checkpoint: {
      checkpoint_id: nextCheckpoint.checkpoint_id,
      checkpoint_sequence: nextCheckpoint.checkpoint_sequence,
      parent_checkpoint_id: nextCheckpoint.parent_checkpoint_id
    },
    action_reconciliation: {
      expected_action_ids: context.action_batch.action_ids,
      confirmed_action_ids: validation.confirmation.confirmed_action_ids,
      batch_id: context.action_batch.batch_id
    },
    completion_scope: 'desktop',
    builder_build_complete: true,
    responsive_complete: false,
    production_ready: false,
    publication: {
      atomic: true,
      output_directory: path.relative(ROOT, path.resolve(ROOT, options.outputDirectory)),
      files: ['checkpoint.json', 'completion-gate.json', 'completion-result.json', 'completion-status.json', 'session-state.json']
    },
    blocking_diagnostics: []
  };

  publishDirectoryAtomically(options.outputDirectory, {
    'session-state.json': nextSession,
    'checkpoint.json': nextCheckpoint,
    'completion-status.json': derived.status,
    'completion-gate.json': derived.gate,
    'completion-result.json': result
  }, (stageDirectory) => {
    const carriers = validateGeneratedCompletionCarriers(stageDirectory);
    let derivedPassed = true;
    try {
      const status = JSON.parse(fs.readFileSync(path.join(stageDirectory, 'completion-status.json'), 'utf8'));
      const gate = JSON.parse(fs.readFileSync(path.join(stageDirectory, 'completion-gate.json'), 'utf8'));
      derivedPassed = status.schema === 'ev4-builder-derived-completion-status@1.0.0'
        && gate.schema === 'ev4-builder-derived-completion-gate@1.0.0'
        && Object.values(status.states).every((value) => value === true)
        && Object.values(gate.proofs).every((proof) => proof.derived_status === 'confirmed');
    } catch {
      derivedPassed = false;
    }
    return { passed: carriers.passed && derivedPassed, carriers, derivedPassed };
  });
  return { ...validation, result, nextSession, nextCheckpoint };
}
