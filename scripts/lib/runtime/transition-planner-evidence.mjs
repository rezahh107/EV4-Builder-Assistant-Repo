import { computeCanonicalDigest, sha256Bytes } from '../canonical-builder-package.mjs';
import { CLAIM_COMPATIBILITY } from '../builder-explicit-source-runtime.mjs';
import { ALLOWED_MULTI_CLAIM_SETS, diagnostic, timestampForSequence, generationRef, buildCheckpoint, updateSessionForCheckpoint } from './run-primitives.mjs';
import { expectedPublicationFiles, validatePublication } from './run-state-store.mjs';
import { failedPlan, successfulPlan } from './transition-planner-common.mjs';

export const BUILDER_OUTPUT_SUBJECT = 'builder-output';

export function claimSetCompatible(claimClasses) {
  if (claimClasses.length <= 1) return true;
  return ALLOWED_MULTI_CLAIM_SETS.has([...claimClasses].sort().join('|'));
}

export function expectedEvidenceSubject(claimClass, source, predecessor) {
  if (claimClass === 'required_action_execution') {
    return predecessor.context.action_batch.action_ids.includes(source?.action_id) ? source.action_id : null;
  }
  return Object.hasOwn(CLAIM_COMPATIBILITY, claimClass) ? BUILDER_OUTPUT_SUBJECT : null;
}

function subjectPolicyDiagnostics(source, predecessor) {
  const diagnostics = [];
  const expectedSubjects = new Set();
  for (const claimClass of source?.claim_classes || []) {
    const expected = expectedEvidenceSubject(claimClass, source, predecessor);
    if (expected !== null) expectedSubjects.add(expected);
  }
  if (expectedSubjects.size > 1) diagnostics.push(diagnostic('RUN-EVIDENCE-016', 'Evidence claim aggregation requires inconsistent subject identities.'));
  if (expectedSubjects.size === 1) {
    const [expected] = expectedSubjects;
    if (source?.subject_ref !== expected) diagnostics.push(diagnostic('RUN-EVIDENCE-017', `Evidence subject_ref must equal the canonical subject for its claim class: ${expected}.`));
  }
  return diagnostics;
}

export function validateEvidenceSource(source, predecessor) {
  const diagnostics = [];
  if (source?.schema !== 'ev4-builder-evidence-source@1.0.0') diagnostics.push(diagnostic('RUN-EVIDENCE-001', 'Evidence source schema is unsupported.'));
  if (typeof source?.status !== 'string' || source.status !== 'verified') diagnostics.push(diagnostic('RUN-EVIDENCE-002', 'Evidence source.status must equal the exact string "verified".'));
  if (!Array.isArray(source?.claim_ids) || source.claim_ids.length === 0 || new Set(source.claim_ids).size !== source.claim_ids.length) diagnostics.push(diagnostic('RUN-EVIDENCE-003', 'Evidence claim_ids must be a non-empty unique set.'));
  if (!Array.isArray(source?.claim_classes) || source.claim_classes.length === 0 || !claimSetCompatible(source.claim_classes)) diagnostics.push(diagnostic('RUN-EVIDENCE-004', 'Evidence claim_classes are missing or incompatible.'));
  if (source?.session_id !== predecessor.session.session_id) diagnostics.push(diagnostic('RUN-EVIDENCE-005', 'Evidence Session binding is stale or foreign.'));
  if (source?.package_digest !== predecessor.context.canonical_package_digest) diagnostics.push(diagnostic('RUN-EVIDENCE-006', 'Evidence Package binding is stale or foreign.'));
  for (const claimClass of source?.claim_classes || []) {
    const allowed = CLAIM_COMPATIBILITY[claimClass];
    if (!allowed || !allowed.includes(source.evidence_type)) diagnostics.push(diagnostic('RUN-EVIDENCE-007', `Evidence type cannot satisfy ${claimClass}.`));
  }
  if ((source?.claim_classes || []).includes('required_action_execution')) {
    if (!predecessor.context.action_batch.action_ids.includes(source.action_id)) diagnostics.push(diagnostic('RUN-EVIDENCE-008', 'Action execution Evidence action_id is missing or foreign.'));
    if (source.subject_ref !== source.action_id) diagnostics.push(diagnostic('RUN-EVIDENCE-009', 'Action execution Evidence subject_ref must equal action_id.'));
  }
  if (typeof source?.subject_ref !== 'string' || !source.subject_ref) diagnostics.push(diagnostic('RUN-EVIDENCE-010', 'Evidence subject_ref is missing.'));
  if (typeof source?.evidence_type !== 'string' || !source.evidence_type) diagnostics.push(diagnostic('RUN-EVIDENCE-011', 'Evidence type is missing.'));
  diagnostics.push(...subjectPolicyDiagnostics(source, predecessor));
  return diagnostics;
}

export function planEvidenceTransition({ predecessor, evidenceBytes }) {
  const diagnostics = [];
  const { manifest, context, session, checkpoint } = predecessor;
  const bytes = Buffer.from(evidenceBytes || []);
  let source;
  try { source = JSON.parse(bytes.toString('utf8')); }
  catch (error) { return failedPlan(predecessor, [diagnostic('RUN-EVIDENCE-013', 'External Evidence source is unreadable or malformed.', error.message)]); }
  const evidenceSha = sha256Bytes(bytes);
  const evidenceId = `EV-${evidenceSha.slice(0, 20)}`;
  const evidenceRef = `evidence/${evidenceId}.json`;
  if (checkpoint.runtime_state !== 'BUILD_ACTIVE' || !manifest.active_confirmation_receipt_ref) diagnostics.push(diagnostic('RUN-EVIDENCE-012', 'Evidence attachment requires a confirmed BUILD_ACTIVE Run.'));
  diagnostics.push(...validateEvidenceSource(source, predecessor));
  if ((manifest.evidence_snapshot_refs || []).includes(evidenceRef)) diagnostics.push(diagnostic('RUN-EVIDENCE-014', 'Identical Evidence snapshot is already attached.'));
  const existingAssertionIds = new Set((checkpoint.assertions || []).map((entry) => entry.assertion_id));
  for (const claimId of source.claim_ids || []) if (existingAssertionIds.has(claimId)) diagnostics.push(diagnostic('RUN-EVIDENCE-015', `Assertion already exists: ${claimId}.`));
  if (diagnostics.length) return failedPlan(predecessor, diagnostics);
  const resultingAssertions = [...checkpoint.assertions];
  for (const claimId of source.claim_ids) resultingAssertions.push({ assertion_id: claimId, subject_ref: source.subject_ref, claim: source.claim_classes.join('|'), status: 'confirmed', evidence_refs: [evidenceId] });
  const resultingLedger = [...checkpoint.evidence_ledger, { evidence_id: evidenceId, evidence_type: source.evidence_type, source_ref: evidenceRef, captured_at: timestampForSequence(checkpoint.checkpoint_sequence + 1), content_sha256: evidenceSha, supports_claim_ids: [...source.claim_ids], status: 'available' }];
  const resulting = buildCheckpoint({ runId: manifest.run_id, sessionId: session.session_id, context, sequence: checkpoint.checkpoint_sequence + 1, parentId: checkpoint.checkpoint_id, state: 'BUILD_ACTIVE', confirmedActionIds: checkpoint.confirmed_action_ids, unconfirmedActionIds: checkpoint.unconfirmed_action_ids, unresolvedBlockers: checkpoint.unresolved_blockers || [], assertions: resultingAssertions, evidenceLedger: resultingLedger, createdFrom: source.evidence_type });
  const nextSession = updateSessionForCheckpoint(session, resulting);
  const transitionId = `EVIDENCE-${computeCanonicalDigest({ run_id: manifest.run_id, evidence_sha256: evidenceSha, predecessor: checkpoint.checkpoint_id }).slice(0, 16)}`;
  const resultRef = `transitions/evidence/${transitionId}/evidence-attachment-result.json`;
  const refs = { generation_ref: generationRef(predecessor.current.generation + 1), evidence_ref: evidenceRef, result_ref: resultRef };
  const result = { schema: 'ev4-builder-evidence-attachment-result@1.0.0', run_id: manifest.run_id, transition_id: transitionId, status: 'accepted', evidence_id: evidenceId, evidence_snapshot_ref: evidenceRef, evidence_snapshot_sha256: evidenceSha, context_digest: context.context_digest, package_digest: context.canonical_package_digest, selected_candidate_id: context.selected_candidate_id, batch_id: context.action_batch.batch_id, action_ids: [...context.action_batch.action_ids], action_digests: { ...context.action_batch.action_digests }, predecessor_checkpoint: { checkpoint_id: checkpoint.checkpoint_id, checkpoint_sequence: checkpoint.checkpoint_sequence }, resulting_checkpoint: { checkpoint_id: resulting.checkpoint_id, checkpoint_sequence: resulting.checkpoint_sequence, parent_checkpoint_id: resulting.parent_checkpoint_id }, builder_build_complete: false, responsive_complete: false, production_ready: false, publication: { atomic: true, files: expectedPublicationFiles('attach-evidence', refs) }, blocking_diagnostics: [] };
  const publicationDiagnostics = validatePublication(result, 'attach-evidence', refs, 'ev4-builder-evidence-attachment-result@1.0.0', manifest.run_id);
  if (publicationDiagnostics.length) return failedPlan(predecessor, publicationDiagnostics);
  return successfulPlan('attach-evidence', context, nextSession, resulting, { evidence_snapshot_refs: [...manifest.evidence_snapshot_refs, evidenceRef], evidence_attachment_result_refs: [...manifest.evidence_attachment_result_refs, resultRef] }, result, [{ ref: evidenceRef, kind: 'bytes', value: bytes }, { ref: resultRef, kind: 'json', value: result }], refs, { evidenceId, evidenceRef, evidenceSha, source });
}
