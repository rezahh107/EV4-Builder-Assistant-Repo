import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { normalizeCeBuilderExecutablePackage } from '../normalize-ce-builder-executable-package.mjs';
import { assertCeToBuilderContractGatePass } from '../validate-ce-to-builder-contract-gate.mjs';
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
import {
  CLAIM_COMPATIBILITY,
  RUNTIME_MODES,
  createConfirmationReceipt,
  fixtureValidateBuilderInput,
  validateConfirmationReceipt,
  verifyEvidenceLedger,
  writeConfirmationReceipt
} from './builder-truth-spine.mjs';

const ROOT = process.cwd();
const HASH = /^[a-f0-9]{64}$/;

export const SOURCE_MODES = Object.freeze({
  PROJECT_GATE: 'project-gate',
  DIRECT_CE: 'direct-ce',
  MANUAL_BUILDER_INPUT: 'manual-builder-input'
});

const ALLOWED_SOURCE_MODES = new Set(Object.values(SOURCE_MODES));

function diagnostic(code, message, detail = '') {
  return { code, message, ...(detail ? { detail } : {}) };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function resolvePath(file) {
  return path.resolve(ROOT, file);
}

function relativePath(file) {
  return path.relative(ROOT, resolvePath(file));
}

function readBytes(file) {
  return fs.readFileSync(resolvePath(file));
}

function readJson(file) {
  return JSON.parse(readBytes(file).toString('utf8'));
}

function writeJsonAtomic(file, value) {
  const target = resolvePath(file);
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
    if (key === 'fixture_classification' && typeof entry === 'string' && /synthetic|fixture|test/i.test(entry)) findings.push(next);
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
      verification_status: manual ? 'manual_attributed' : 'content_derived',
      may_authorize_new_design_decision: false
    };
  });
}

function contextWithoutDigest(context) {
  const clone = structuredClone(context);
  delete clone.context_digest;
  return clone;
}

function contextSemantics(sourceMode) {
  if (sourceMode === SOURCE_MODES.MANUAL_BUILDER_INPUT) {
    return {
      content_binding_status: 'verified',
      source_selection: 'operator_explicit',
      origin_assurance: 'manual_operator_supplied',
      receipt_binding_status: 'not_applicable'
    };
  }
  return {
    content_binding_status: 'verified',
    source_selection: 'operator_explicit',
    origin_assurance: 'not_independently_verified',
    receipt_binding_status: sourceMode === SOURCE_MODES.PROJECT_GATE ? 'matched' : 'not_applicable'
  };
}

function buildRuntimeContext({ sourceMode, sourceArtifactFile, builderInputFile, builderInputBytes, builderPackage }) {
  const actionBatch = batchIdentity(builderPackage);
  const packageDigest = computePackageDigest(builderPackage);
  const selectedSourceFile = sourceMode === SOURCE_MODES.DIRECT_CE ? sourceArtifactFile : builderInputFile;
  const context = {
    schema: 'ev4-builder-verified-context@1.0.0',
    runtime_mode: RUNTIME_MODES.REAL,
    source_mode: sourceMode,
    ...contextSemantics(sourceMode),
    selected_source_ref: relativePath(selectedSourceFile),
    selected_source_sha256: sha256Bytes(readBytes(selectedSourceFile)),
    source_artifact_ref: sourceArtifactFile ? relativePath(sourceArtifactFile) : null,
    builder_input_ref: builderInputFile ? relativePath(builderInputFile) : null,
    builder_input_sha256: sha256Bytes(builderInputBytes),
    canonical_package_digest: packageDigest,
    selected_candidate_id: builderPackage.selected_candidate_id,
    builder_context_schema: builderPackage.schema,
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
  if (context?.schema !== 'ev4-builder-verified-context@1.0.0') diagnostics.push(diagnostic('BUILDER-CONTEXT-101', 'Unsupported Builder Runtime Context schema.'));
  if (context?.runtime_mode !== RUNTIME_MODES.REAL) diagnostics.push(diagnostic('BUILDER-CONTEXT-102', 'Builder Runtime Context is not a real-builder-run carrier.'));
  if (!ALLOWED_SOURCE_MODES.has(context?.source_mode)) diagnostics.push(diagnostic('BUILDER-CONTEXT-103', 'Builder Runtime Context has an unsupported source mode.'));
  if (context?.source_selection !== 'operator_explicit') diagnostics.push(diagnostic('BUILDER-CONTEXT-104', 'Source selection must be operator_explicit.'));
  if (context?.content_binding_status !== 'verified') diagnostics.push(diagnostic('BUILDER-CONTEXT-105', 'Runtime content binding was not verified.'));
  const expectedOrigin = context?.source_mode === SOURCE_MODES.MANUAL_BUILDER_INPUT ? 'manual_operator_supplied' : 'not_independently_verified';
  if (context?.origin_assurance !== expectedOrigin) diagnostics.push(diagnostic('BUILDER-CONTEXT-106', 'Origin assurance overclaims or mismatches the explicit source mode.'));
  const expectedReceipt = context?.source_mode === SOURCE_MODES.PROJECT_GATE ? 'matched' : 'not_applicable';
  if (context?.receipt_binding_status !== expectedReceipt) diagnostics.push(diagnostic('BUILDER-CONTEXT-107', 'Receipt binding status mismatches the explicit source mode.'));
  for (const field of ['selected_source_sha256', 'builder_input_sha256', 'canonical_package_digest']) {
    if (!HASH.test(context?.[field] || '')) diagnostics.push(diagnostic('BUILDER-CONTEXT-108', `Builder Runtime Context ${field} is invalid.`));
  }
  if (context?.synthetic_derived !== false) diagnostics.push(diagnostic('BUILDER-CONTEXT-109', 'Builder Runtime Context was derived from synthetic content.'));
  if (!HASH.test(context?.context_digest || '') || context.context_digest !== computeCanonicalDigest(contextWithoutDigest(context))) {
    diagnostics.push(diagnostic('BUILDER-CONTEXT-110', 'Builder Runtime Context digest is missing or invalid.'));
  }
  for (const forbidden of ['verification_status', 'producer_repository', 'producer_commit_sha', 'producer_artifact_id', 'producer_artifact_sha256']) {
    if (Object.hasOwn(context || {}, forbidden)) diagnostics.push(diagnostic('BUILDER-CONTEXT-111', `Builder Runtime Context contains provenance-overclaiming field: ${forbidden}.`));
  }
  return diagnostics;
}

function validateBuilderFile(builderInputFile) {
  const verification = verifyBuilderInput(builderInputFile);
  return {
    verification,
    builderPackage: verification.package,
    builderInputBytes: readBytes(builderInputFile)
  };
}

function validateDerivedBuilderPackage(builderPackage) {
  const builderInputBytes = Buffer.from(`${JSON.stringify(builderPackage, null, 2)}\n`, 'utf8');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-builder-explicit-source-'));
  try {
    const file = path.join(temp, 'builder-input.json');
    fs.writeFileSync(file, builderInputBytes);
    const verification = verifyBuilderInput(file);
    return { verification, builderInputBytes };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

export function resolveExplicitBuilderSource({ sourceMode, sourceArtifactFile = null, builderInputFile = null }) {
  const diagnostics = [];
  if (!ALLOWED_SOURCE_MODES.has(sourceMode)) {
    return { passed: false, diagnostics: [diagnostic('BUILDER-SOURCE-101', `Unsupported explicit source mode: ${sourceMode}.`)] };
  }

  let sourceArtifact = null;
  let builderPackage = null;
  let builderInputBytes = null;

  if (sourceMode === SOURCE_MODES.PROJECT_GATE) {
    if (!sourceArtifactFile || !builderInputFile) diagnostics.push(diagnostic('BUILDER-SOURCE-102', 'Project Gate mode requires a Receipt and exact Builder Input bytes.'));
    if (sourceArtifactFile) {
      try {
        sourceArtifact = readJson(sourceArtifactFile);
      } catch (error) {
        diagnostics.push(diagnostic('BUILDER-SOURCE-103', 'Project Gate Receipt is unreadable or malformed.', error.message));
      }
    }
    if (sourceArtifact && sourceArtifact.schema !== 'ev4-project-gate-c2b-receipt@1.0.0') {
      diagnostics.push(diagnostic('BUILDER-SOURCE-104', 'Project Gate mode requires ev4-project-gate-c2b-receipt@1.0.0 content-binding data.'));
    }
    if (builderInputFile) {
      try {
        const validated = validateBuilderFile(builderInputFile);
        builderPackage = validated.builderPackage;
        builderInputBytes = validated.builderInputBytes;
        diagnostics.push(...validated.verification.diagnostics);
        const actualSha = sha256Bytes(builderInputBytes);
        const actualDigest = validated.verification.identity?.canonical_package_digest;
        if (sourceArtifact?.source_file_sha256 !== actualSha) diagnostics.push(diagnostic('BUILDER-SOURCE-105', 'Project Gate Receipt does not match the selected Builder Input bytes.'));
        if (sourceArtifact?.canonical_package_digest !== actualDigest) diagnostics.push(diagnostic('BUILDER-SOURCE-106', 'Project Gate Receipt package digest does not match the selected Builder Input content.'));
      } catch (error) {
        diagnostics.push(diagnostic('BUILDER-SOURCE-107', 'Selected Builder Input cannot be read or validated.', error.message));
      }
    }
  }

  if (sourceMode === SOURCE_MODES.DIRECT_CE) {
    if (!sourceArtifactFile) diagnostics.push(diagnostic('BUILDER-SOURCE-108', 'Direct CE mode requires the actual CE source package.'));
    if (sourceArtifactFile) {
      try {
        sourceArtifact = readJson(sourceArtifactFile);
        const cePackage = sourceArtifact?.ce_builder_executable_package;
        if (!isObject(cePackage)) diagnostics.push(diagnostic('BUILDER-SOURCE-109', 'Direct CE source must contain ce_builder_executable_package.'));
        if (isObject(cePackage)) {
          const actualDigest = computeCanonicalDigest(cePackage);
          if (!HASH.test(sourceArtifact.content_sha256 || '') || sourceArtifact.content_sha256 !== actualDigest) {
            diagnostics.push(diagnostic('BUILDER-SOURCE-110', 'Direct CE declared content digest does not match the actual CE package content.'));
          }
          try {
            assertCeToBuilderContractGatePass(sourceArtifact);
            builderPackage = normalizeCeBuilderExecutablePackage(cePackage);
            const validated = validateDerivedBuilderPackage(builderPackage);
            builderInputBytes = validated.builderInputBytes;
            diagnostics.push(...validated.verification.diagnostics);
          } catch (error) {
            diagnostics.push(diagnostic('BUILDER-SOURCE-111', 'Direct CE Contract Gate, adapter or Builder validation failed.', error.message));
          }
        }
      } catch (error) {
        diagnostics.push(diagnostic('BUILDER-SOURCE-112', 'Direct CE source is unreadable or malformed.', error.message));
      }
    }
  }

  if (sourceMode === SOURCE_MODES.MANUAL_BUILDER_INPUT) {
    if (!builderInputFile) diagnostics.push(diagnostic('BUILDER-SOURCE-113', 'Manual Builder Input mode requires exact operator-selected Builder Input bytes.'));
    if (builderInputFile) {
      try {
        const validated = validateBuilderFile(builderInputFile);
        builderPackage = validated.builderPackage;
        builderInputBytes = validated.builderInputBytes;
        diagnostics.push(...validated.verification.diagnostics);
      } catch (error) {
        diagnostics.push(diagnostic('BUILDER-SOURCE-114', 'Manual Builder Input cannot be read or validated.', error.message));
      }
    }
  }

  if (!builderPackage || !builderInputBytes) diagnostics.push(diagnostic('BUILDER-SOURCE-115', 'Runtime-derived Builder package is unavailable.'));
  const syntheticFindings = builderPackage ? scanSynthetic(builderPackage) : [];
  if (syntheticFindings.length) diagnostics.push(diagnostic('BUILDER-SOURCE-116', 'Real Builder Run rejects fixture or synthetic Builder content.', syntheticFindings.join(', ')));

  if (diagnostics.length) return { passed: false, diagnostics, sourceArtifact, builderPackage };

  const context = buildRuntimeContext({
    sourceMode,
    sourceArtifactFile,
    builderInputFile,
    builderInputBytes,
    builderPackage
  });
  return { passed: true, diagnostics: [], sourceArtifact, builderPackage, builderInputBytes, context };
}

export function resolveRealBuilderSource(options) {
  return resolveExplicitBuilderSource({
    sourceMode: options.sourceMode ?? options.sourceKind,
    sourceArtifactFile: options.sourceArtifactFile ?? null,
    builderInputFile: options.builderInputFile ?? null
  });
}

export function verifyDerivedContext({ sourceMode, sourceKind, sourceArtifactFile = null, builderInputFile = null, contextFile }) {
  const selectedMode = sourceMode ?? sourceKind;
  const resolution = resolveExplicitBuilderSource({ sourceMode: selectedMode, sourceArtifactFile, builderInputFile });
  const diagnostics = [...resolution.diagnostics];
  let suppliedContext = null;
  try {
    suppliedContext = readJson(contextFile);
    diagnostics.push(...verifyContextShape(suppliedContext));
  } catch (error) {
    diagnostics.push(diagnostic('BUILDER-CONTEXT-112', 'Stored Builder Runtime Context is unreadable or malformed.', error.message));
  }
  if (resolution.context && suppliedContext && sortedCanonicalJson(resolution.context) !== sortedCanonicalJson(suppliedContext)) {
    diagnostics.push(diagnostic('BUILDER-CONTEXT-113', 'Stored Builder Runtime Context does not match fresh derivation from the selected source bytes.'));
  }
  return {
    ...resolution,
    suppliedContext,
    passed: resolution.passed && diagnostics.length === 0,
    diagnostics
  };
}

export function writeRealIntake({ sourceMode, sourceKind, sourceArtifactFile = null, builderInputFile = null, contextOutputFile, resultOutputFile = null }) {
  const selectedMode = sourceMode ?? sourceKind;
  const resolution = resolveExplicitBuilderSource({ sourceMode: selectedMode, sourceArtifactFile, builderInputFile });
  const result = {
    schema: 'ev4-builder-real-intake-result@1.0.0',
    status: resolution.passed ? 'accepted' : 'blocked',
    runtime_mode: RUNTIME_MODES.REAL,
    source_mode: selectedMode,
    source_selection: 'operator_explicit',
    builder_build_complete: false,
    runtime_state: resolution.passed ? 'BUILD_ACTIVE' : 'INTAKE_VALIDATING',
    context_digest: resolution.context?.context_digest ?? null,
    canonical_package_digest: resolution.context?.canonical_package_digest ?? null,
    selected_candidate_id: resolution.context?.selected_candidate_id ?? null,
    content_binding_status: resolution.context?.content_binding_status ?? 'unverified',
    origin_assurance: resolution.context?.origin_assurance ?? 'not_available',
    receipt_binding_status: resolution.context?.receipt_binding_status ?? 'not_applicable',
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
  if (!sessionSchema.passed || !sessionSemantic.passed) diagnostics.push(diagnostic('BUILDER-RUNTIME-101', 'Session State validation failed.', sessionSchema.detail || sessionSemantic.detail));
  if (!checkpointSchema.passed || !checkpointSemantic.passed) diagnostics.push(diagnostic('BUILDER-RUNTIME-102', 'Checkpoint validation failed.', checkpointSchema.detail || checkpointSemantic.detail));
  return diagnostics;
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
      verification_method: 'content_bound_evidence',
      required_evidence_types: CLAIM_COMPATIBILITY.layout_verified,
      verified_evidence_refs: evidence.verified.filter((entry) => entry.claim_classes.includes('layout_verified')).map((entry) => entry.evidence_id),
      derived_status: claims.has('layout_verified') ? 'confirmed' : 'missing',
      diagnostics: []
    },
    export_verified: {
      claim_id: 'export_verified',
      subject_ref: 'builder-output',
      verification_method: 'content_bound_evidence',
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

export function validateRealCompletion({ sourceMode, sourceKind, sourceArtifactFile = null, builderInputFile = null, contextFile, sessionFile, checkpointFile, confirmationReceiptFile }) {
  const selectedMode = sourceMode ?? sourceKind;
  const diagnostics = [];
  let canonical = null;
  try {
    canonical = requireCanonicalTransition('complete-builder');
  } catch (error) {
    diagnostics.push(diagnostic('BUILDER-COMPLETE-101', error.message));
  }

  const contextVerification = verifyDerivedContext({
    sourceMode: selectedMode,
    sourceArtifactFile,
    builderInputFile,
    contextFile
  });
  diagnostics.push(...contextVerification.diagnostics);

  let session;
  let checkpoint;
  try {
    session = readJson(sessionFile);
    checkpoint = readJson(checkpointFile);
  } catch (error) {
    diagnostics.push(diagnostic('BUILDER-COMPLETE-102', 'Completion carriers are unreadable or malformed.', error.message));
    return { passed: false, diagnostics };
  }

  diagnostics.push(...validateSessionAndCheckpoint(sessionFile, checkpointFile));
  const context = contextVerification.context;
  if (context) {
    const identity = verifyRuntimeIdentity({ identity: {
      canonical_package_digest: context.canonical_package_digest,
      selected_candidate_id: context.selected_candidate_id
    } }, session, checkpoint);
    diagnostics.push(...identity.diagnostics);
  }

  if (session.workflow_mode !== 'APPROVED_HANDOFF_MODE' || session.runtime_state !== 'BUILD_ACTIVE' || session.current_state !== 'BUILD_ACTIVE' || checkpoint.workflow_mode !== 'APPROVED_HANDOFF_MODE' || checkpoint.runtime_state !== 'BUILD_ACTIVE') {
    diagnostics.push(diagnostic('BUILDER-COMPLETE-103', 'Real Completion requires APPROVED_HANDOFF_MODE / BUILD_ACTIVE predecessor carriers.'));
  }

  const blockers = blockersFrom(session, checkpoint);
  if (blockers.length) diagnostics.push(diagnostic('BUILDER-COMPLETE-104', `Completion has unresolved blockers: ${blockers.join(', ')}.`));

  const confirmation = context
    ? validateConfirmationReceipt({ receiptFile: confirmationReceiptFile, context, session, checkpoint })
    : { passed: false, diagnostics: [diagnostic('BUILDER-CONFIRM-100', 'Freshly derived Runtime Context is unavailable.')], receipt: null };
  diagnostics.push(...confirmation.diagnostics);

  const evidence = context
    ? verifyEvidenceLedger({ checkpoint, checkpointFile, context, session })
    : { passed: false, diagnostics: [diagnostic('BUILDER-EVIDENCE-100', 'Freshly derived Runtime Context is unavailable.')], verified: [], verified_claim_classes: [], verified_action_ids: [] };
  diagnostics.push(...evidence.diagnostics);

  const derived = evidence.passed ? deriveCompletion(evidence) : null;
  if (derived && Object.values(derived.status.states).some((value) => value !== true)) diagnostics.push(diagnostic('BUILDER-COMPLETE-105', 'Derived Completion Status is incomplete.'));
  if (derived && Object.values(derived.gate.proofs).some((proof) => proof.derived_status !== 'confirmed')) diagnostics.push(diagnostic('BUILDER-COMPLETE-106', 'Derived Completion Gate is incomplete.'));

  return {
    passed: contextVerification.passed && confirmation.passed && evidence.passed && diagnostics.length === 0,
    diagnostics,
    canonical,
    context,
    builderPackage: contextVerification.builderPackage,
    session,
    checkpoint,
    confirmation: confirmation.receipt,
    evidence,
    derived,
    blockers
  };
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
    source_mode: context.source_mode,
    selected_source_sha256: context.selected_source_sha256,
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
    source_binding: {
      source_mode: context.source_mode,
      source_selection: context.source_selection,
      content_binding_status: context.content_binding_status,
      origin_assurance: context.origin_assurance,
      receipt_binding_status: context.receipt_binding_status,
      selected_source_sha256: context.selected_source_sha256
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
      output_directory: relativePath(options.outputDirectory),
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

export {
  CLAIM_COMPATIBILITY,
  RUNTIME_MODES,
  createConfirmationReceipt,
  fixtureValidateBuilderInput,
  validateConfirmationReceipt,
  verifyEvidenceLedger,
  writeConfirmationReceipt
};
