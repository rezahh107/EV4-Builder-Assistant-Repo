import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { normalizeCeBuilderExecutablePackage } from '../normalize-ce-builder-executable-package.mjs';
import { assertCeToBuilderContractGatePass } from '../validate-ce-to-builder-contract-gate.mjs';
import {
  computeCanonicalDigest,
  computePackageDigest,
  sha256Bytes,
  sortedCanonicalJson
} from './canonical-builder-package.mjs';
import { verifyBuilderInput } from './builder-runtime-transition.mjs';

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
  if (context?.origin_assurance !== expectedOrigin) diagnostics.push(diagnostic('BUILDER-CONTEXT-106', 'Origin assurance overclaims or mismatches explicit source mode.'));
  const expectedReceipt = context?.source_mode === SOURCE_MODES.PROJECT_GATE ? 'matched' : 'not_applicable';
  if (context?.receipt_binding_status !== expectedReceipt) diagnostics.push(diagnostic('BUILDER-CONTEXT-107', 'Receipt binding status mismatches explicit source mode.'));
  for (const field of ['selected_source_sha256', 'builder_input_sha256', 'canonical_package_digest']) if (!HASH.test(context?.[field] || '')) diagnostics.push(diagnostic('BUILDER-CONTEXT-108', `Runtime Context ${field} is invalid.`));
  if (context?.synthetic_derived !== false) diagnostics.push(diagnostic('BUILDER-CONTEXT-109', 'Runtime Context was derived from synthetic content.'));
  if (!HASH.test(context?.context_digest || '') || context.context_digest !== computeCanonicalDigest(contextWithoutDigest(context))) diagnostics.push(diagnostic('BUILDER-CONTEXT-110', 'Runtime Context digest is missing or invalid.'));
  for (const forbidden of ['verification_status', 'producer_repository', 'producer_commit_sha', 'producer_artifact_id', 'producer_artifact_sha256']) if (Object.hasOwn(context || {}, forbidden)) diagnostics.push(diagnostic('BUILDER-CONTEXT-111', `Runtime Context contains provenance-overclaiming field: ${forbidden}.`));
  return diagnostics;
}

function validateBuilderFile(builderInputFile) {
  const verification = verifyBuilderInput(builderInputFile);
  return { verification, builderPackage: verification.package, builderInputBytes: readBytes(builderInputFile) };
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

export function resolveExplicitBuilderSource({ sourceMode, sourceArtifactFile = null, builderInputFile = null }) {
  const diagnostics = [];
  if (!ALLOWED_SOURCE_MODES.has(sourceMode)) return { passed: false, diagnostics: [diagnostic('BUILDER-SOURCE-101', `Unsupported explicit source mode: ${sourceMode}.`)] };
  if (sourceMode === SOURCE_MODES.DIRECT_CE && builderInputFile) diagnostics.push(diagnostic('BUILDER-SOURCE-117', 'Direct CE mode forbids a caller-supplied Builder Input path.'));
  if (sourceMode === SOURCE_MODES.MANUAL_BUILDER_INPUT && sourceArtifactFile) diagnostics.push(diagnostic('BUILDER-SOURCE-118', 'Manual Builder Input mode forbids a source artifact path.'));
  let sourceArtifact = null;
  let builderPackage = null;
  let builderInputBytes = null;

  if (sourceMode === SOURCE_MODES.PROJECT_GATE) {
    if (!sourceArtifactFile || !builderInputFile) diagnostics.push(diagnostic('BUILDER-SOURCE-102', 'Project Gate mode requires Receipt and exact Builder Input bytes.'));
    if (sourceArtifactFile) {
      try { sourceArtifact = readJson(sourceArtifactFile); }
      catch (error) { diagnostics.push(diagnostic('BUILDER-SOURCE-103', 'Project Gate Receipt is unreadable or malformed.', error.message)); }
    }
    if (sourceArtifact && sourceArtifact.schema !== 'ev4-project-gate-c2b-receipt@1.0.0') diagnostics.push(diagnostic('BUILDER-SOURCE-104', 'Project Gate mode requires ev4-project-gate-c2b-receipt@1.0.0.'));
    if (builderInputFile) {
      try {
        const validated = validateBuilderFile(builderInputFile);
        builderPackage = validated.builderPackage;
        builderInputBytes = validated.builderInputBytes;
        diagnostics.push(...validated.verification.diagnostics);
        const actualSha = sha256Bytes(builderInputBytes);
        const actualDigest = validated.verification.identity?.canonical_package_digest;
        if (sourceArtifact?.source_file_sha256 !== actualSha) diagnostics.push(diagnostic('BUILDER-SOURCE-105', 'Project Gate Receipt does not match selected Builder Input bytes.'));
        if (sourceArtifact?.canonical_package_digest !== actualDigest) diagnostics.push(diagnostic('BUILDER-SOURCE-106', 'Project Gate Receipt package digest does not match selected Builder Input.'));
      } catch (error) {
        diagnostics.push(diagnostic('BUILDER-SOURCE-107', 'Selected Builder Input cannot be read or validated.', error.message));
      }
    }
  }

  if (sourceMode === SOURCE_MODES.DIRECT_CE) {
    if (!sourceArtifactFile) diagnostics.push(diagnostic('BUILDER-SOURCE-108', 'Direct CE mode requires actual CE source package.'));
    if (sourceArtifactFile) {
      try {
        sourceArtifact = readJson(sourceArtifactFile);
        const cePackage = sourceArtifact?.ce_builder_executable_package;
        if (!isObject(cePackage)) diagnostics.push(diagnostic('BUILDER-SOURCE-109', 'Direct CE source must contain ce_builder_executable_package.'));
        if (isObject(cePackage)) {
          const actualDigest = computeCanonicalDigest(cePackage);
          if (!HASH.test(sourceArtifact.content_sha256 || '') || sourceArtifact.content_sha256 !== actualDigest) diagnostics.push(diagnostic('BUILDER-SOURCE-110', 'Direct CE declared digest does not match actual CE package.'));
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
  const context = buildRuntimeContext({ sourceMode, sourceArtifactFile, builderInputFile, builderInputBytes, builderPackage });
  return { passed: true, diagnostics: [], sourceArtifact, builderPackage, builderInputBytes, context };
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
    diagnostics.push(diagnostic('BUILDER-CONTEXT-112', 'Stored Runtime Context is unreadable or malformed.', error.message));
  }
  if (resolution.context && suppliedContext && sortedCanonicalJson(resolution.context) !== sortedCanonicalJson(suppliedContext)) diagnostics.push(diagnostic('BUILDER-CONTEXT-113', 'Stored Runtime Context does not match fresh derivation from selected source bytes.'));
  return { ...resolution, suppliedContext, passed: resolution.passed && diagnostics.length === 0, diagnostics };
}

function inactiveLegacyAuthority(operation) {
  return {
    passed: false,
    status: 'blocked',
    authority_scope: 'legacy_fixture_and_historical_reproduction_only',
    runtime_mode: 'fixture-validation',
    runtime_state: 'NOT_A_REAL_RUN',
    builder_build_complete: false,
    responsive_complete: false,
    production_ready: false,
    diagnostics: [diagnostic('BUILDER-LEGACY-AUTHORITY-INACTIVE', `${operation} is inactive. Use the canonical Run-directory API.`)]
  };
}

export function resolveRealBuilderSource() { return inactiveLegacyAuthority('resolveRealBuilderSource'); }
export function writeRealIntake() { return inactiveLegacyAuthority('writeRealIntake'); }
export function validateRealCompletion() { return inactiveLegacyAuthority('validateRealCompletion'); }
export function publishRealCompletion() { return inactiveLegacyAuthority('publishRealCompletion'); }
