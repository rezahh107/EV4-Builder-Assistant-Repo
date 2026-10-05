import fs from 'node:fs';
import path from 'node:path';
import { acquireRunLock, releaseRunLock } from './run-lock-ownership.mjs';
import { loadRunUnlocked } from './run-state-validation.mjs';
import { diagnostic, fsyncDirectory, readJson } from './run-primitives.mjs';
import {
  COMPARATIVE_ADMISSION_VALIDATOR_ID,
  COMPARATIVE_ADMISSION_VALIDATOR_VERSION,
  deriveRequiredDomains,
  deriveRequirementClassification,
  normalizeRequirement,
  normalizeResolution,
  buildReceipt,
  requirementPath,
  resolutionPath,
  receiptPath,
  verifyRequirementCarrier,
  verifyResolutionAndReceipt
} from './comparative-admission-model.mjs';

export { COMPARATIVE_ADMISSION_VALIDATOR_ID, COMPARATIVE_ADMISSION_VALIDATOR_VERSION, deriveRequiredDomains, deriveRequirementClassification };

function writeImmutableJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) throw Object.assign(new Error(`Immutable comparative carrier already exists: ${file}`), { code: 'RUN-COMPARATIVE-IMMUTABLE' });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, file);
    fsyncDirectory(path.dirname(file));
  } catch (error) {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    throw error;
  }
}

const blockedResult = (code, message, errors = []) => ({ passed: false, status: 'blocked', diagnostics: [diagnostic(code, message, errors.join('; '))] });

export function bindComparativeRequirement({ runDirectory, requirementSourceFile }) {
  const handle = acquireRunLock(runDirectory, 'bind-comparative-requirement');
  if (!handle.passed) return handle.result || handle;
  try {
    const loaded = loadRunUnlocked(runDirectory);
    if (!loaded.passed) return { passed: false, diagnostics: loaded.diagnostics };
    if (loaded.session?.runtime_state !== 'BUILD_ACTIVE' || loaded.checkpoint?.runtime_state !== 'BUILD_ACTIVE') return blockedResult('RUN-COMPARATIVE-REQ-001', 'Comparative Requirement may be bound only in BUILD_ACTIVE before emission.');
    const source = readJson(requirementSourceFile);
    const normalized = normalizeRequirement(source, loaded);
    if (!normalized.passed) return blockedResult('RUN-COMPARATIVE-REQ-002', 'Comparative Requirement validation failed.', normalized.errors);
    const target = requirementPath(loaded.runDirectory, normalized.requirement.action_id);
    if (fs.existsSync(resolutionPath(loaded.runDirectory, normalized.requirement.action_id)) || fs.existsSync(receiptPath(loaded.runDirectory, normalized.requirement.action_id))) return blockedResult('RUN-COMPARATIVE-REQ-003', 'Requirement cannot be created or rewritten after Resolution/Admission exists.');
    writeImmutableJson(target, normalized.requirement);
    return { passed: true, result: { schema: 'ev4-builder-comparative-requirement-bind-result@1.0.0', status: 'accepted', action_id: normalized.requirement.action_id, decision_requirement_id: normalized.requirement.decision_requirement_id, decision_requirement_digest: normalized.requirement.decision_requirement_digest, required_domain_ids: normalized.requirement.required_domain_ids, authority_classification: normalized.requirement.derived_authority_classification, state_modified: false } };
  } catch (error) {
    return blockedResult(error.code || 'RUN-COMPARATIVE-REQ-FAILURE', 'Comparative Requirement binding failed.', [error.message]);
  } finally { releaseRunLock(handle); }
}

export function admitComparativeResolution({ runDirectory, resolutionSourceFile }) {
  const handle = acquireRunLock(runDirectory, 'admit-comparative-resolution');
  if (!handle.passed) return handle.result || handle;
  try {
    const loaded = loadRunUnlocked(runDirectory);
    if (!loaded.passed) return { passed: false, diagnostics: loaded.diagnostics };
    if (loaded.session?.runtime_state !== 'BUILD_ACTIVE' || loaded.checkpoint?.runtime_state !== 'BUILD_ACTIVE') return blockedResult('RUN-COMPARATIVE-ADM-001', 'Comparative Resolution may be admitted only in BUILD_ACTIVE before emission.');
    const source = readJson(resolutionSourceFile);
    const req = verifyRequirementCarrier(loaded, source.action_id);
    if (!req.passed) return blockedResult('RUN-COMPARATIVE-ADM-002', 'Locked Comparative Requirement is invalid.', req.errors);
    const normalized = normalizeResolution(source, req.requirement);
    if (!normalized.passed) return blockedResult('RUN-COMPARATIVE-ADM-003', 'Comparative Resolution validation failed.', normalized.errors);
    const rTarget = resolutionPath(loaded.runDirectory, req.requirement.action_id);
    const aTarget = receiptPath(loaded.runDirectory, req.requirement.action_id);
    if (fs.existsSync(rTarget) || fs.existsSync(aTarget)) return blockedResult('RUN-COMPARATIVE-ADM-004', 'Comparative Resolution/Admission is immutable once published.');
    const receipt = buildReceipt(req.requirement, normalized.resolution);
    writeImmutableJson(rTarget, normalized.resolution);
    writeImmutableJson(aTarget, receipt);
    return { passed: true, result: { schema: 'ev4-builder-comparative-admission-result@1.0.0', status: 'accepted', action_id: receipt.action_id, decision_requirement_id: receipt.decision_requirement_id, resolution_id: receipt.resolution_id, receipt_digest: receipt.receipt_digest, required_domain_ids: receipt.required_domain_ids, evaluated_domain_ids: receipt.evaluated_domain_ids, admitted: true, state_modified: false } };
  } catch (error) {
    return blockedResult(error.code || 'RUN-COMPARATIVE-ADM-FAILURE', 'Comparative Resolution admission failed.', [error.message]);
  } finally { releaseRunLock(handle); }
}

export function verifyComparativeAdmissions(predecessor) {
  const diagnostics = [], details = [];
  for (const actionId of predecessor.context?.action_batch?.action_ids || []) {
    const req = verifyRequirementCarrier(predecessor, actionId);
    if (!req.passed) { diagnostics.push(diagnostic('RUN-COMPARATIVE-EMIT-001', `Action ${actionId} lacks a valid locked Comparative Requirement.`, req.errors.join('; '))); continue; }
    const classification = req.requirement.derived_authority_classification;
    if (classification === 'UPSTREAM_DECISION_REQUIRED') { diagnostics.push(diagnostic('RUN-COMPARATIVE-EMIT-002', `Action ${actionId} requires an upstream decision and cannot be emitted.`)); continue; }
    if (classification === 'DIRECT_EXECUTION') { details.push({ action_id: actionId, classification, required_domain_ids: req.requirement.required_domain_ids, admitted: true, receipt_digest: null }); continue; }
    if (classification !== 'BOUNDED_MICRO_RESOLUTION') { diagnostics.push(diagnostic('RUN-COMPARATIVE-EMIT-003', `Action ${actionId} has invalid comparative classification ${classification}.`)); continue; }
    const admission = verifyResolutionAndReceipt(predecessor, req.requirement);
    if (!admission.passed) { diagnostics.push(diagnostic('RUN-COMPARATIVE-EMIT-004', `Action ${actionId} has no valid Comparative Admission Receipt.`, admission.errors.join('; '))); continue; }
    details.push({ action_id: actionId, classification, required_domain_ids: req.requirement.required_domain_ids, admitted: true, receipt_digest: admission.receipt.receipt_digest });
  }
  return { passed: diagnostics.length === 0, diagnostics, actions: details };
}
