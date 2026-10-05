import fs from 'node:fs';
import path from 'node:path';

import {
  computeCanonicalDigest,
  computePackageDigest,
  sha256Bytes
} from '../canonical-builder-package.mjs';
import {
  attachRunEvidence,
  completeRun,
  confirmRunBatch,
  emitRunBatch,
  initializeAtomicRun,
  validateCanonicalRun
} from './canonical-run-runtime.mjs';
import { bindComparativeRequirement } from './comparative-admission.mjs';

export const ROOT = process.cwd();
const BUILDER_FIXTURE = path.join(ROOT, 'tests', 'valid', 'runtime-transaction', 'carriers', 'builder_context_package.json');
const CE_FIXTURE = path.join(ROOT, 'tests', 'valid', 'ce_builder_package_adapter_valid.json');

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

export function cleanBuilderPackage() {
  const pkg = readJson(BUILDER_FIXTURE);
  for (const entry of pkg.source_payload_ledger || []) entry.source_ref = `operator-content:${entry.payload_name}`;
  pkg.input_authorization.package_digest.value = computePackageDigest(pkg);
  return pkg;
}

export function createSourceCase(baseDirectory, mode, name) {
  const directory = path.join(baseDirectory, name);
  fs.mkdirSync(directory, { recursive: true });
  if (mode === 'manual-builder-input') {
    const builder = writeJson(path.join(directory, 'builder-input.json'), cleanBuilderPackage());
    return { sourceMode: mode, sourceArtifactFile: null, builderInputFile: builder, sourceArg: '-', builderArg: builder, externalFiles: [builder] };
  }
  if (mode === 'project-gate') {
    const pkg = cleanBuilderPackage();
    const builder = writeJson(path.join(directory, 'builder-input.json'), pkg);
    const receipt = writeJson(path.join(directory, 'project-gate-receipt.json'), {
      schema: 'ev4-project-gate-c2b-receipt@1.0.0',
      receipt_id: `PG-${name}`,
      producer_repository: 'metadata-not-authority/example',
      producer_commit_sha: '0'.repeat(40),
      source_file_sha256: sha256Bytes(fs.readFileSync(builder)),
      canonical_package_digest: computePackageDigest(pkg)
    });
    return { sourceMode: mode, sourceArtifactFile: receipt, builderInputFile: builder, sourceArg: receipt, builderArg: builder, externalFiles: [receipt, builder] };
  }
  const wrapper = readJson(CE_FIXTURE);
  wrapper.content_sha256 = computeCanonicalDigest(wrapper.ce_builder_executable_package);
  wrapper.producer_repository = 'metadata-not-authority/example';
  const source = writeJson(path.join(directory, 'direct-ce-source.json'), wrapper);
  return { sourceMode: mode, sourceArtifactFile: source, builderInputFile: null, sourceArg: source, builderArg: '-', externalFiles: [source] };
}

export function activeRun(runDirectory, fullDerivation = false) {
  const loaded = validateCanonicalRun(runDirectory, { fullDerivation });
  if (!loaded.passed) throw new Error(JSON.stringify(loaded.diagnostics));
  return loaded;
}

function directRequirement(action, index) {
  const fields = ['target_element', 'element_type', 'instruction', 'expected_result'];
  return {
    schema: 'ev4-comparative-decision-requirement@1.0.0',
    action_id: action.action_id,
    decision_requirement_id: `TEST-DIRECT-${action.action_id}`,
    implementation_question: 'Test fixture direct execution precheck.',
    governing_upstream_constraints: ['exact test action is already fully specified'],
    implementation_surface_type: 'generic',
    material_behavior_dimensions: [],
    content_variability: 'fixed',
    reference_frame: 'none',
    responsive_relevance: false,
    text_semantics_relevance: false,
    interaction_relevance: false,
    media_relevance: false,
    reuse_scope: 'local',
    platform_capability_relevance: false,
    accessibility_relevance: false,
    performance_relevance: false,
    security_relevance: false,
    saved_state_relevance: false,
    runtime_validation_relevance: false,
    allowed_authority_boundary: 'BUILDER_BOUNDED_ONLY',
    required_material_parameters: fields,
    fully_specified_upstream_parameters: fields,
    unresolved_material_parameters: [],
    upstream_parameter_bindings: Object.fromEntries(fields.map((field) => [field, { source_ref: `first_builder_batch.actions[${index}].${field}`, evidence: String(action[field] ?? '') }]))
  };
}

export function bindTestDirectRequirements(baseDirectory, runDirectory, name) {
  const pkg = activeRun(runDirectory, true).derivation?.builderPackage;
  if (!pkg) throw new Error('Full derivation did not expose Builder package for test precheck.');
  const directory = path.join(baseDirectory, `${name}-comparative-direct`);
  for (const [index, action] of (pkg.first_builder_batch?.actions || []).entries()) {
    const file = writeJson(path.join(directory, `${index}.json`), directRequirement(action, index));
    const result = bindComparativeRequirement({ runDirectory, requirementSourceFile: file });
    if (!result.passed) throw new Error(JSON.stringify(result.diagnostics));
  }
}

export function initializeManualRun(baseDirectory, name) {
  const source = createSourceCase(baseDirectory, 'manual-builder-input', `${name}-source`);
  const runDirectory = path.join(baseDirectory, `run-${name}`);
  const intake = initializeAtomicRun({
    sourceMode: source.sourceMode,
    sourceArtifactFile: source.sourceArtifactFile,
    builderInputFile: source.builderInputFile,
    runDirectory
  });
  if (!intake.passed) throw new Error(JSON.stringify(intake.diagnostics));
  bindTestDirectRequirements(baseDirectory, runDirectory, name);
  return { source, runDirectory, intake };
}

export function progressToWaiting(baseDirectory, name) {
  const value = initializeManualRun(baseDirectory, name);
  const emitted = emitRunBatch({ runDirectory: value.runDirectory });
  if (!emitted.passed) throw new Error(JSON.stringify(emitted.diagnostics));
  return { ...value, emitted };
}

export function progressToConfirmed(baseDirectory, name) {
  const value = progressToWaiting(baseDirectory, name);
  const loaded = activeRun(value.runDirectory);
  const confirmed = confirmRunBatch({
    runDirectory: value.runDirectory,
    userToken: loaded.context.confirmation.expected_user_token
  });
  if (!confirmed.passed) throw new Error(JSON.stringify(confirmed.diagnostics));
  return { ...value, confirmed };
}

export function createEvidenceSources(baseDirectory, runDirectory, name) {
  const loaded = activeRun(runDirectory);
  const directory = path.join(baseDirectory, `${name}-evidence`);
  const sources = [];
  function add(label, evidenceType, claimIds, claimClasses, subjectRef, actionId = null) {
    sources.push(writeJson(path.join(directory, `${label}.json`), {
      schema: 'ev4-builder-evidence-source@1.0.0',
      evidence_type: evidenceType,
      claim_ids: claimIds,
      claim_classes: claimClasses,
      subject_ref: subjectRef,
      session_id: loaded.session.session_id,
      package_digest: loaded.context.canonical_package_digest,
      ...(actionId ? { action_id: actionId } : {}),
      status: 'verified'
    }));
  }
  for (const actionId of loaded.context.action_batch.action_ids) add(`action-${actionId}`, 'diagnostic', [`ASSERT-${actionId}`], ['required_action_execution'], actionId, actionId);
  add('scaffold', 'diagnostic', ['ASSERT-SCAFFOLD'], ['scaffold_built'], 'builder-output');
  add('structure', 'structure_panel_screenshot', ['ASSERT-STRUCTURE'], ['structure_built'], 'builder-output');
  add('content', 'editor_screenshot', ['ASSERT-CONTENT'], ['content_filled'], 'builder-output');
  add('layout', 'frontend_screenshot', ['ASSERT-LAYOUT'], ['desktop_layout_established', 'layout_verified'], 'builder-output');
  add('export', 'export_json', ['ASSERT-EXPORT'], ['export_checked', 'export_verified'], 'builder-output');
  return sources;
}

export function attachAllEvidence(baseDirectory, runDirectory, name) {
  const sources = createEvidenceSources(baseDirectory, runDirectory, name);
  for (const file of sources) {
    const result = attachRunEvidence({ runDirectory, evidenceSourceFile: file });
    if (!result.passed) throw new Error(JSON.stringify(result.diagnostics));
  }
  return sources;
}

export function progressToCompletable(baseDirectory, name) {
  const value = progressToConfirmed(baseDirectory, name);
  const evidenceSources = attachAllEvidence(baseDirectory, value.runDirectory, name);
  return { ...value, evidenceSources };
}

export function completeHappyRun(baseDirectory, name) {
  const value = progressToCompletable(baseDirectory, name);
  const completed = completeRun({ runDirectory: value.runDirectory });
  if (!completed.passed) throw new Error(JSON.stringify(completed.diagnostics));
  return { ...value, completed };
}
