#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const VALID_FIXTURE = 'tests/valid/runtime-transaction/complete-transaction.json';
const MUTATION_REGISTRY = 'tests/invalid/runtime-transaction/mutations.json';
const REQUIRED_LINEAGE_FIELDS = [
  'decision_family',
  'decision_card_ref',
  'selected_option',
  'rejected_options',
  'evidence_refs',
  'evidence_state',
  'consumer_stage'
];
const POSITIVE_CLAIMS = ['executed', 'successful', 'validated', 'completed', 'equivalent'];
const VALID_CLASS_SCOPES = new Set(['Local Classes', 'Global Classes']);
const EXECUTABLE_PACKAGE_STATUSES = new Set(['ready', 'ready_with_visible_flags']);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function equal(left, right) {
  return stableJson(left) === stableJson(right);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return [...new Set(values)];
}

function batchPrefix(actionId) {
  const match = typeof actionId === 'string' ? actionId.match(/^(BATCH-[A-Z0-9]+)-A\d+$/) : null;
  return match ? match[1] : null;
}

function hasPositiveClaim(claims = {}) {
  return POSITIVE_CLAIMS.some((name) => claims[name] === true);
}

function add(errors, code, message) {
  errors.push({ code, message });
}

function validateLineageArray(lineage, errors, location, code = 'BUILDER-TRX-005') {
  if (!Array.isArray(lineage) || lineage.length === 0) {
    add(errors, code, `${location} must contain at least one decision-lineage record.`);
    return false;
  }

  const seen = new Set();
  let valid = true;
  for (const [index, record] of lineage.entries()) {
    const recordLocation = `${location}[${index}]`;
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      add(errors, code, `${recordLocation} must be an object.`);
      valid = false;
      continue;
    }
    for (const field of REQUIRED_LINEAGE_FIELDS) {
      const value = record[field];
      const present = Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && String(value).length > 0;
      if (!present) {
        add(errors, code, `${recordLocation}.${field} is required and non-empty.`);
        valid = false;
      }
    }
    if (record.consumer_stage !== 'builder') {
      add(errors, code, `${recordLocation}.consumer_stage must be builder.`);
      valid = false;
    }
    if (seen.has(record.decision_card_ref)) {
      add(errors, 'BUILDER-TRX-006', `${recordLocation} duplicates decision_card_ref ${record.decision_card_ref}.`);
      valid = false;
    }
    seen.add(record.decision_card_ref);
  }
  return valid;
}

function compareLineage(upstream, downstream, errors, location, missingCode = 'BUILDER-TRX-005') {
  if (!Array.isArray(downstream) || downstream.length === 0) {
    add(errors, missingCode, `${location} dropped required upstream decision lineage.`);
    return;
  }
  if (downstream.length !== upstream.length) {
    add(errors, 'BUILDER-TRX-006', `${location} must carry exactly ${upstream.length} lineage record(s); received ${downstream.length}.`);
  }

  const upstreamByRef = new Map(upstream.map((record) => [record.decision_card_ref, record]));
  const seen = new Set();
  for (const [index, record] of downstream.entries()) {
    const ref = record?.decision_card_ref;
    if (!ref || !upstreamByRef.has(ref)) {
      add(errors, missingCode, `${location}[${index}] references unknown or missing decision lineage.`);
      continue;
    }
    if (seen.has(ref)) add(errors, 'BUILDER-TRX-006', `${location}[${index}] duplicates lineage ${ref}.`);
    seen.add(ref);
    if (!equal(record, upstreamByRef.get(ref))) {
      add(errors, missingCode, `${location}[${index}] modified upstream decision lineage ${ref}.`);
    }
  }
  for (const ref of upstreamByRef.keys()) {
    if (!seen.has(ref)) add(errors, missingCode, `${location} omitted upstream lineage ${ref}.`);
  }
}

function validateSource(tx, errors) {
  const source = tx.source || {};
  const semanticCandidates = Array.isArray(source.semantic_candidate_paths) ? source.semantic_candidate_paths : [];
  const receiptPaths = Array.isArray(source.audit_receipt_paths) ? source.audit_receipt_paths : [];

  if (semanticCandidates.length !== 1 || semanticCandidates[0] !== source.input_path) {
    add(errors, 'BUILDER-TRX-001', 'Exactly one semantic candidate must equal source.input_path.');
  }
  if (receiptPaths.includes(source.input_path) || /project-gate-c2b-receipt\.json$/i.test(String(source.input_path || ''))) {
    add(errors, 'BUILDER-TRX-001', 'Audit receipts cannot be Builder semantic input.');
  }

  if (source.source_kind === 'project_gate_builder_input') {
    if (path.basename(String(source.input_path || '')) !== 'builder-input.json') {
      add(errors, 'BUILDER-TRX-001', 'Project Gate semantic input must be standalone builder-input.json.');
    }
    if (source.parsed_schema !== 'ev4-builder-context-package@1.0.0') {
      add(errors, 'BUILDER-TRX-001', 'Project Gate builder-input.json must contain the Builder Context schema.');
    }
  } else if (source.source_kind === 'direct_ce_builder') {
    if (source.parsed_schema !== 'ev4-builder-executable-package@1.0.0') {
      add(errors, 'BUILDER-TRX-001', 'Direct CE→Builder input must contain the CE Builder Executable Package schema.');
    }
  } else {
    add(errors, 'BUILDER-TRX-001', `Unsupported source_kind: ${source.source_kind}.`);
  }

  const actualSourceSha = sha256(String(source.captured_source_bytes ?? ''));
  if (source.captured_source_sha256 !== actualSourceSha) {
    add(errors, 'BUILDER-TRX-001', 'captured_source_sha256 must be derived from the exact captured source bytes.');
  }

  const provenance = source.provenance || {};
  if (
    provenance.verified !== true ||
    !Number.isInteger(provenance.repository_id) ||
    !/^[a-f0-9]{40}$/i.test(String(provenance.commit_sha || '')) ||
    !/^[a-f0-9]{40}$/i.test(String(provenance.blob_sha || '')) ||
    provenance.path !== source.input_path ||
    provenance.content_sha256 !== actualSourceSha
  ) {
    add(errors, 'BUILDER-TRX-001', 'Source provenance must be independently verified and bound to the same captured bytes and path.');
  }

  const probe = source.equivalence_probe || {};
  if (
    probe.project_gate_result !== 'pass' ||
    probe.direct_builder_gate_result !== 'pass' ||
    probe.project_gate_result !== probe.direct_builder_gate_result ||
    probe.project_gate_package_digest !== probe.direct_builder_package_digest
  ) {
    add(errors, 'BUILDER-TRX-002', 'Project Gate and direct Builder-owned paths must converge on identical pass/fail and package identity semantics.');
  }
}

function deriveAuthorization(tx) {
  const pkg = tx.builder_package || {};
  const actions = Array.isArray(pkg.first_builder_batch?.actions) ? pkg.first_builder_batch.actions : [];
  const actionIds = actions.map((action) => action?.action_id).filter(Boolean);
  const confirmationIds = Array.isArray(pkg.confirmation_request?.confirmed_action_ids)
    ? pkg.confirmation_request.confirmed_action_ids
    : [];
  const kernelLineageDeclared = (pkg.source_payload_ledger || []).some((entry) => (
    entry?.payload_name === 'Kernel_Decision_Lineage' ||
    entry?.schema === 'ev4-kernel-decision-lineage@1.0.0'
  ));
  const lineagePresent = !kernelLineageDeclared || (Array.isArray(pkg.decision_lineage) && pkg.decision_lineage.length > 0);
  const confirmationBound = (
    actions.length > 0 &&
    equal(actionIds, confirmationIds) &&
    pkg.confirmation_request?.confirmation_id === `CONFIRM-${pkg.first_builder_batch?.batch_id}` &&
    pkg.confirmation_request?.expected_user_token === `تایید ${pkg.first_builder_batch?.batch_id}` &&
    pkg.confirmation_request?.template_id === 'standard_batch_confirmation'
  );
  const eligible = (
    EXECUTABLE_PACKAGE_STATUSES.has(pkg.package_status) &&
    pkg.selected_candidate_locked === true &&
    pkg.production_ready_allowed === false &&
    pkg.required_constructability_carriers_complete === true &&
    Array.isArray(pkg.blocking_dependencies) &&
    pkg.blocking_dependencies.length === 0 &&
    actions.length > 0 &&
    confirmationBound &&
    lineagePresent
  );
  return {
    decision: eligible ? 'approved' : 'blocked_invalid_package',
    eligible_workflow_mode: eligible ? 'APPROVED_HANDOFF_MODE' : 'START_INTAKE_MODE',
    eligible_runtime_state: eligible ? 'WAITING_FOR_CONFIRMATION' : 'EVIDENCE_REQUIRED',
    package_digest: pkg.package_identity?.digest,
    source_sha256: tx.source?.captured_source_sha256,
    authorized_action_ids: eligible ? actionIds : []
  };
}

function validatePackageAndAuthorization(tx, errors) {
  const pkg = tx.builder_package || {};
  const actions = Array.isArray(pkg.first_builder_batch?.actions) ? pkg.first_builder_batch.actions : [];
  const actionIds = actions.map((action) => action?.action_id).filter(Boolean);
  const batchId = pkg.first_builder_batch?.batch_id;
  const confirmation = pkg.confirmation_request || {};

  if (pkg.package_identity?.digest !== sha256(String(pkg.package_identity?.material ?? ''))) {
    add(errors, 'BUILDER-TRX-003', 'Package identity digest must be recomputed from the normalized package identity material.');
  }

  if (pkg.legacy_text_usage?.confirmation_sentence_used_as_authority === true ||
      pkg.legacy_text_usage?.builder_assistant_prompt_seed_used_as_authority === true) {
    add(errors, 'BUILDER-TRX-004', 'Package prose and legacy prompt fields are display-only and cannot alter runtime state.');
  }

  if (unique(actionIds).length !== actionIds.length || actionIds.length === 0) {
    add(errors, 'BUILDER-TRX-007', 'Authorized action IDs must be unique and non-empty.');
  }
  const prefixes = unique(actionIds.map(batchPrefix));
  if (prefixes.length !== 1 || prefixes[0] !== batchId) {
    add(errors, 'BUILDER-TRX-007', 'All first batch action IDs must belong to first_builder_batch.batch_id.');
  }
  if (!equal(confirmation.confirmed_action_ids, actionIds)) {
    add(errors, 'BUILDER-TRX-007', 'confirmation_request.confirmed_action_ids must exactly equal the complete authorized action set.');
  }
  if (confirmation.confirmation_id !== `CONFIRM-${batchId}` ||
      confirmation.expected_user_token !== `تایید ${batchId}` ||
      confirmation.template_id !== 'standard_batch_confirmation') {
    add(errors, 'BUILDER-TRX-007', 'Structured confirmation identity and token must derive from the exact batch ID.');
  }
  if (confirmation.package_digest !== pkg.package_identity?.digest) {
    add(errors, 'BUILDER-TRX-007', 'Confirmation must bind to the exact validated package identity.');
  }

  const expected = deriveAuthorization(tx);
  const derived = tx.derived_input_authorization || {};
  for (const field of ['decision', 'eligible_workflow_mode', 'eligible_runtime_state', 'package_digest', 'source_sha256']) {
    if (derived[field] !== expected[field]) {
      add(errors, 'BUILDER-TRX-003', `derived_input_authorization.${field} must be Builder-derived; expected ${expected[field]}, received ${derived[field]}.`);
    }
  }
  if (!equal(derived.authorized_action_ids, expected.authorized_action_ids)) {
    add(errors, 'BUILDER-TRX-003', 'derived_input_authorization.authorized_action_ids must be recomputed from the complete validated package.');
  }
  if (derived.derived_by !== 'scripts/validate-builder-runtime-transaction.mjs') {
    add(errors, 'BUILDER-TRX-003', 'Derived input authorization must identify the Builder-owned executable validator.');
  }

  const caller = pkg.caller_input_authorization;
  if (caller) {
    if (
      caller.decision !== expected.decision ||
      caller.package_digest !== expected.package_digest ||
      caller.source_sha256 !== expected.source_sha256 ||
      !equal(caller.authorized_action_ids, expected.authorized_action_ids)
    ) {
      add(errors, 'BUILDER-TRX-003', 'Caller-authored authorization is an assertion and cannot override Builder recomputation.');
    }
  }

  const kernelLineageDeclared = (pkg.source_payload_ledger || []).some((entry) => (
    entry?.payload_name === 'Kernel_Decision_Lineage' ||
    entry?.schema === 'ev4-kernel-decision-lineage@1.0.0'
  ));
  if (kernelLineageDeclared) validateLineageArray(pkg.decision_lineage, errors, 'builder_package.decision_lineage');
}

function validateSessionConfirmationAndBatch(tx, errors) {
  const pkg = tx.builder_package || {};
  const auth = tx.derived_input_authorization || {};
  const session = tx.session_state || {};
  const event = tx.confirmation_event || {};
  const batch = tx.action_batch || {};
  const packageActions = Array.isArray(pkg.first_builder_batch?.actions) ? pkg.first_builder_batch.actions : [];
  const packageActionIds = packageActions.map((action) => action.action_id);
  const sessionActionIds = Array.isArray(session.authorized_action_ids) ? session.authorized_action_ids : [];
  const batchActionIds = Array.isArray(batch.actions) ? batch.actions.map((action) => action.action_id) : [];
  const approvedNodes = new Set(pkg.approved_structure_node_ids || []);
  const approvedClasses = new Map((pkg.approved_class_map || []).map((entry) => [entry.class_name, entry.class_scope]));
  const upstreamLineage = pkg.decision_lineage || [];

  if (
    session.workflow_mode !== auth.eligible_workflow_mode ||
    session.runtime_state !== auth.eligible_runtime_state ||
    session.selected_candidate_id !== pkg.selected_candidate_id ||
    session.package_digest !== auth.package_digest ||
    session.source_sha256 !== auth.source_sha256 ||
    !equal(sessionActionIds, auth.authorized_action_ids)
  ) {
    add(errors, 'BUILDER-TRX-008', 'Session state must initialize from the exact derived package authorization.');
  }
  compareLineage(upstreamLineage, session.decision_lineage, errors, 'session_state.decision_lineage');

  if (
    event.session_id !== session.session_id ||
    event.package_digest !== session.package_digest ||
    event.confirmation_id !== pkg.confirmation_request?.confirmation_id ||
    event.user_token !== pkg.confirmation_request?.expected_user_token ||
    !equal(event.confirmed_action_ids, packageActionIds)
  ) {
    add(errors, 'BUILDER-TRX-007', 'User confirmation must bind to the exact session, package digest, token, and complete action set.');
  }

  if (
    batch.authorized !== true ||
    batch.session_id !== session.session_id ||
    batch.package_digest !== session.package_digest ||
    batch.selected_candidate_id !== pkg.selected_candidate_id ||
    batch.batch_id !== pkg.first_builder_batch?.batch_id ||
    !equal(batchActionIds, packageActionIds)
  ) {
    add(errors, 'BUILDER-TRX-008', 'Action Batch must correspond exactly to the active authorized session and package.');
  }

  compareLineage(upstreamLineage, batch.decision_lineage, errors, 'action_batch.decision_lineage');
  for (const [index, action] of (batch.actions || []).entries()) {
    if (!approvedNodes.has(action.target_node)) {
      add(errors, 'BUILDER-TRX-008', `action_batch.actions[${index}].target_node is not in the approved structure.`);
    }
    if (action.class_name) {
      const approvedScope = approvedClasses.get(action.class_name);
      if (!approvedScope || !VALID_CLASS_SCOPES.has(action.class_scope) || action.class_scope !== approvedScope) {
        add(errors, 'BUILDER-TRX-008', `action_batch.actions[${index}] has an unapproved or ambiguous Elementor class scope.`);
      }
    }
    if (!action.decision_lineage_ref) {
      add(errors, 'BUILDER-TRX-005', `action_batch.actions[${index}] dropped required decision lineage.`);
    } else {
      const upstream = upstreamLineage.find((record) => record.decision_card_ref === action.decision_lineage_ref.decision_card_ref);
      if (!upstream || !equal(upstream, action.decision_lineage_ref)) {
        add(errors, 'BUILDER-TRX-005', `action_batch.actions[${index}] modified or invented decision lineage.`);
      }
    }
  }
}

function validateEvidenceCheckpointFallbackAndCompletion(tx, errors) {
  const pkg = tx.builder_package || {};
  const session = tx.session_state || {};
  const batch = tx.action_batch || {};
  const checkpoint = tx.checkpoint || {};
  const upstreamLineage = pkg.decision_lineage || [];
  const actionIds = (batch.actions || []).map((action) => action.action_id);
  const confirmed = Array.isArray(checkpoint.confirmed_action_ids) ? checkpoint.confirmed_action_ids : [];
  const unconfirmed = Array.isArray(checkpoint.unconfirmed_action_ids) ? checkpoint.unconfirmed_action_ids : [];
  const evidenceById = new Map((tx.evidence_records || []).map((record) => [record.evidence_id, record]));

  if (
    checkpoint.session_id !== session.session_id ||
    checkpoint.batch_id !== batch.batch_id ||
    checkpoint.package_digest !== batch.package_digest ||
    checkpoint.selected_candidate_id !== batch.selected_candidate_id ||
    !equal([...confirmed, ...unconfirmed], actionIds)
  ) {
    add(errors, 'BUILDER-TRX-008', 'Checkpoint must correspond to the active Action Batch and partition the exact action set.');
  }
  compareLineage(upstreamLineage, checkpoint.decision_lineage, errors, 'checkpoint.decision_lineage');

  for (const actionId of confirmed) {
    const supporting = (checkpoint.evidence_refs || [])
      .map((ref) => evidenceById.get(ref))
      .filter((record) => record?.action_id === actionId && record.status === 'available');
    if (supporting.length === 0 || supporting.some((record) => record.kind !== 'machine_trace' || record.machine_trace_complete !== true)) {
      add(errors, 'BUILDER-TRX-009', `Confirmed action ${actionId} requires a complete retained machine trace; screenshots cannot compensate.`);
    }
  }

  for (const [surfaceName, surface, missingCode] of [
    ['fallback', tx.fallback || {}, 'BUILDER-TRX-010'],
    ['repair_packet', tx.repair_packet || {}, 'BUILDER-TRX-010']
  ]) {
    compareLineage(upstreamLineage, surface.decision_lineage, errors, `${surfaceName}.decision_lineage`, missingCode);
    if (hasPositiveClaim(surface.claims)) {
      const refs = Array.isArray(surface.evidence_refs) ? surface.evidence_refs : [];
      const validEvidence = refs.length > 0 && refs.every((ref) => {
        const record = evidenceById.get(ref);
        return record?.status === 'available' && record.kind === 'machine_trace' && record.machine_trace_complete === true;
      });
      if (!validEvidence) {
        add(errors, 'BUILDER-TRX-010', `${surfaceName} cannot claim execution, success, validation, completion, or equivalence without retained machine evidence.`);
      }
    }
  }

  const completion = tx.completion || {};
  const actionCompleteIds = Array.isArray(completion.action_complete_ids) ? completion.action_complete_ids : [];
  const allActionsComplete = equal(actionCompleteIds, actionIds);
  const checkpointComplete = equal(confirmed, actionIds) && unconfirmed.length === 0;
  const requiredCheckpoints = new Set(completion.required_checkpoint_ids || []);
  const observedCheckpoints = new Set(completion.observed_checkpoint_ids || []);
  const allRequiredCheckpointsObserved = [...requiredCheckpoints].every((id) => observedCheckpoints.has(id));
  const evidenceRefs = completion.evidence_refs || [];
  const completeEvidence = evidenceRefs.length > 0 && evidenceRefs.every((ref) => {
    const record = evidenceById.get(ref);
    return record?.status === 'available' && record.kind === 'machine_trace' && record.machine_trace_complete === true;
  });

  if (completion.batch_complete === true && !(allActionsComplete && checkpointComplete)) {
    add(errors, 'BUILDER-TRX-011', 'Batch completion requires every authorized action to be checkpoint-confirmed.');
  }
  if (completion.session_complete === true && completion.batch_complete !== true) {
    add(errors, 'BUILDER-TRX-011', 'Session completion requires batch completion.');
  }
  if (completion.build_complete === true && !(
    completion.session_complete === true &&
    allRequiredCheckpointsObserved &&
    completion.execution_evidence_complete === true &&
    completion.completion_gate_status === 'passed' &&
    completeEvidence
  )) {
    add(errors, 'BUILDER-TRX-011', 'Build completion requires the full checkpoint set, complete machine evidence, and a passed completion gate.');
  }
  if (completion.responsive_ready === true || completion.production_ready === true) {
    add(errors, 'BUILDER-TRX-011', 'Builder completion cannot collapse into Responsive or production readiness.');
  }

  if (completion.display_text && (
    batch.authorized !== true ||
    !['WAITING_FOR_CONFIRMATION', 'BUILD_ACTIVE', 'COMPLETED'].includes(session.runtime_state)
  )) {
    add(errors, 'BUILDER-TRX-011', 'Positive wording cannot compensate for an invalid machine state.');
  }
}

function validatePublicationAndEnforcement(tx, errors) {
  const publication = tx.publication || {};
  const invalidTransaction = (
    publication.structural_failure === true ||
    publication.construction_complete !== true ||
    publication.validation_passed !== true
  );

  if (publication.output_path === publication.source_path || publication.temporary_path === publication.source_path) {
    add(errors, 'BUILDER-TRX-013', 'Output and temporary paths must not alias the source input.');
  }
  if (publication.artifact_published === true && (
    publication.validated_before_publish !== true ||
    publication.atomic_publish !== true
  )) {
    add(errors, 'BUILDER-TRX-013', 'Published artifacts must be fully constructed, validated, and atomically published.');
  }
  if (invalidTransaction && publication.artifact_published === true) {
    add(errors, 'BUILDER-TRX-012', 'Structural or validation failure must not publish a partial actionable artifact.');
  }
  if (invalidTransaction && publication.artifact_must_not_be_consumed !== true) {
    add(errors, 'BUILDER-TRX-012', 'Failed generation must mark any residual artifact as non-consumable.');
  }
  if (invalidTransaction && publication.prior_valid_output_preserved !== true) {
    add(errors, 'BUILDER-TRX-013', 'Invalid generation must preserve any prior valid owned output.');
  }

  const enforcement = tx.enforcement || {};
  const central = new Set(enforcement.central_validator_entries || []);
  const exactHead = new Set(enforcement.exact_head_workflow_entries || []);
  if (
    !central.has('validate:builder-lineage-sequence') ||
    !central.has('scripts/validate-builder-runtime-transaction.mjs') ||
    !exactHead.has('npm run validate') ||
    enforcement.schema_strict !== true ||
    enforcement.mutation_negative_count !== 38 ||
    enforcement.positive_control_count !== 1 ||
    enforcement.mutation_registry_locked !== true
  ) {
    add(errors, 'BUILDER-TRX-014', 'Enforcement claims require executable central validators, exact-head CI wiring, strict schemas, and the complete mutation suite.');
  }
}

export function validateBuilderRuntimeTransaction(tx) {
  const errors = [];
  if (!tx || typeof tx !== 'object' || Array.isArray(tx)) {
    return [{ code: 'BUILDER-TRX-012', message: 'Transaction evidence must be a JSON object.' }];
  }
  if (tx.schema !== 'ev4-builder-runtime-transaction-evidence@1.0.0') {
    add(errors, 'BUILDER-TRX-012', 'Unsupported transaction evidence schema.');
  }

  validateSource(tx, errors);
  validatePackageAndAuthorization(tx, errors);
  validateSessionConfirmationAndBatch(tx, errors);
  validateEvidenceCheckpointFallbackAndCompletion(tx, errors);
  validatePublicationAndEnforcement(tx, errors);

  return errors.sort((left, right) => left.code.localeCompare(right.code) || left.message.localeCompare(right.message));
}

function applyMutation(tx, operation) {
  const firstLineage = () => tx.builder_package.decision_lineage[0];
  switch (operation) {
    case 'positive_control':
      return tx;
    case 'receipt_as_input':
      tx.source.input_path = 'project-gate-c2b-receipt.json';
      tx.source.semantic_candidate_paths = ['project-gate-c2b-receipt.json'];
      tx.source.provenance.path = 'project-gate-c2b-receipt.json';
      return tx;
    case 'mixed_semantic_candidates':
      tx.source.semantic_candidate_paths.push('extra-builder-input.json');
      return tx;
    case 'wrong_internal_schema':
      tx.source.parsed_schema = 'ev4-project-gate-c2b-receipt@1.0.0';
      return tx;
    case 'ready_with_failed_semantics':
      tx.builder_package.required_constructability_carriers_complete = false;
      return tx;
    case 'caller_approval_bypass':
      tx.builder_package.required_constructability_carriers_complete = false;
      tx.builder_package.caller_input_authorization.decision = 'approved';
      return tx;
    case 'missing_candidate_lock':
      tx.builder_package.selected_candidate_locked = false;
      return tx;
    case 'missing_constructability_carrier':
      tx.builder_package.required_constructability_carriers_complete = false;
      return tx;
    case 'project_gate_weaker':
      tx.source.equivalence_probe.direct_builder_gate_result = 'fail';
      return tx;
    case 'direct_gate_weaker':
      tx.source.equivalence_probe.project_gate_result = 'fail';
      return tx;
    case 'fabricated_provenance':
      tx.source.provenance.verified = false;
      tx.source.provenance.repository_id = 999;
      return tx;
    case 'source_bytes_changed':
      tx.source.captured_source_bytes += '{"mutated":true}\n';
      return tx;
    case 'digest_for_different_bytes':
      tx.source.provenance.content_sha256 = sha256('different bytes');
      return tx;
    case 'missing_intake_lineage':
      delete tx.builder_package.decision_lineage;
      return tx;
    case 'changed_selected_option':
      tx.action_batch.decision_lineage[0].selected_option = 'mutated_option';
      return tx;
    case 'changed_evidence_refs':
      tx.checkpoint.decision_lineage[0].evidence_refs = ['EVID-MUTATED'];
      return tx;
    case 'stale_duplicate_lineage':
      tx.checkpoint.decision_lineage.push({ ...clone(firstLineage()), selected_option: 'stale_option' });
      return tx;
    case 'action_missing_lineage':
      delete tx.action_batch.actions[0].decision_lineage_ref;
      return tx;
    case 'fallback_missing_lineage':
      delete tx.fallback.decision_lineage;
      return tx;
    case 'fallback_success_without_evidence':
      tx.fallback.claims.successful = true;
      return tx;
    case 'repair_claim_without_evidence':
      tx.repair_packet.claims.executed = true;
      tx.repair_packet.claims.equivalent = true;
      return tx;
    case 'incomplete_machine_trace':
      tx.evidence_records[0].machine_trace_complete = false;
      return tx;
    case 'confirmation_sentence_authority':
      tx.builder_package.legacy_text_usage.confirmation_sentence_used_as_authority = true;
      return tx;
    case 'prompt_seed_authority':
      tx.builder_package.legacy_text_usage.builder_assistant_prompt_seed_used_as_authority = true;
      return tx;
    case 'unknown_confirmation_action':
      tx.builder_package.confirmation_request.confirmed_action_ids[1] = 'BATCH-001-A99';
      return tx;
    case 'multi_batch_confirmation':
      tx.builder_package.confirmation_request.confirmed_action_ids[1] = 'BATCH-002-A01';
      return tx;
    case 'stale_confirmation_after_mutation':
      tx.builder_package.package_identity.material += '|mutated';
      tx.builder_package.package_identity.digest = sha256(tx.builder_package.package_identity.material);
      tx.derived_input_authorization.package_digest = tx.builder_package.package_identity.digest;
      tx.builder_package.caller_input_authorization.package_digest = tx.builder_package.package_identity.digest;
      tx.session_state.package_digest = tx.builder_package.package_identity.digest;
      tx.action_batch.package_digest = tx.builder_package.package_identity.digest;
      tx.checkpoint.package_digest = tx.builder_package.package_identity.digest;
      return tx;
    case 'action_candidate_mismatch':
      tx.action_batch.selected_candidate_id = 'ARCH-FAM-MUTATED';
      return tx;
    case 'ambiguous_class_scope':
      delete tx.action_batch.actions[0].class_scope;
      return tx;
    case 'checkpoint_batch_mismatch':
      tx.checkpoint.batch_id = 'BATCH-999';
      return tx;
    case 'screenshot_only_execution':
      tx.evidence_records.forEach((record) => { record.kind = 'screenshot'; });
      return tx;
    case 'single_checkpoint_collapses_build':
      tx.completion.required_checkpoint_ids.push('CP-002');
      return tx;
    case 'incomplete_completion_gate':
      tx.completion.required_checkpoint_ids = ['CP-001', 'CP-002'];
      tx.completion.observed_checkpoint_ids = ['CP-001'];
      tx.completion.completion_gate_status = 'passed';
      return tx;
    case 'wording_compensates_machine_state':
      tx.session_state.runtime_state = 'EVIDENCE_REQUIRED';
      tx.completion.display_text = 'Everything completed successfully.';
      return tx;
    case 'partial_publication_on_failure':
      tx.publication.structural_failure = true;
      tx.publication.validation_passed = false;
      tx.publication.artifact_published = true;
      tx.publication.artifact_must_not_be_consumed = false;
      return tx;
    case 'source_output_alias':
      tx.publication.output_path = tx.publication.source_path;
      return tx;
    case 'invalid_pack_replaces_valid':
      tx.publication.construction_complete = false;
      tx.publication.validation_passed = false;
      tx.publication.artifact_published = true;
      tx.publication.artifact_must_not_be_consumed = false;
      tx.publication.prior_valid_output_preserved = false;
      return tx;
    case 'central_validator_removed':
      tx.enforcement.central_validator_entries = ['validate:builder-lineage-sequence'];
      return tx;
    case 'coordinated_weakening':
      tx.enforcement.schema_strict = false;
      tx.enforcement.mutation_negative_count = 0;
      tx.enforcement.mutation_registry_locked = false;
      return tx;
    default:
      throw new Error(`Unknown mutation operation: ${operation}`);
  }
}

function runSelfTest() {
  const base = readJson(path.join(ROOT, VALID_FIXTURE));
  const registry = readJson(path.join(ROOT, MUTATION_REGISTRY));
  const cases = registry.cases || [];
  if (cases.length !== 39) throw new Error(`Expected 39 transaction cases, found ${cases.length}.`);

  const baseErrors = validateBuilderRuntimeTransaction(base);
  if (baseErrors.length > 0) {
    throw new Error(`Positive transaction fixture failed:\n${JSON.stringify(baseErrors, null, 2)}`);
  }
  console.log(`Builder runtime transaction positive fixture passed: ${VALID_FIXTURE}`);

  let negativeCount = 0;
  let positiveCount = 0;
  for (const testCase of cases) {
    const mutated = applyMutation(clone(base), testCase.operation);
    const errors = validateBuilderRuntimeTransaction(mutated);
    if (testCase.expected_result === 'pass') {
      positiveCount += 1;
      if (errors.length > 0) {
        throw new Error(`${testCase.id} positive control failed:\n${JSON.stringify(errors, null, 2)}`);
      }
      console.log(`${testCase.id} positive control passed.`);
      continue;
    }

    negativeCount += 1;
    if (errors.length === 0) {
      throw new Error(`${testCase.id} unexpectedly passed: ${testCase.description}`);
    }
    if (!errors.some((error) => error.code === testCase.expected_code)) {
      throw new Error(`${testCase.id} did not emit ${testCase.expected_code}:\n${JSON.stringify(errors, null, 2)}`);
    }
    console.log(`${testCase.id} correctly failed with ${testCase.expected_code}.`);
  }

  if (negativeCount !== 38 || positiveCount !== 1) {
    throw new Error(`Expected 38 negative mutations and 1 positive control; received ${negativeCount} and ${positiveCount}.`);
  }
  console.log('Builder runtime transaction mutation suite passed: 38 negative mutations + 1 exact positive control.');
}

function runFiles(files) {
  let failed = false;
  for (const filePath of files) {
    const errors = validateBuilderRuntimeTransaction(readJson(filePath));
    if (errors.length > 0) {
      failed = true;
      console.error(`Builder runtime transaction validation failed: ${filePath}`);
      for (const error of errors) console.error(`- ${error.code}: ${error.message}`);
    } else {
      console.log(`Builder runtime transaction validation passed: ${filePath}`);
    }
  }
  if (failed) process.exit(1);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const files = process.argv.slice(2);
  if (files.length === 0) runSelfTest();
  else runFiles(files);
}
