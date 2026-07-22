import fs from 'node:fs';
import path from 'node:path';
import { computeCanonicalDigest } from '../canonical-builder-package.mjs';
import { ROOT, RuntimeTransactionError, diagnostic, resolvePath } from './common.mjs';

const DEFAULT_SCOPE_PATH = path.join(ROOT, 'runtime', 'completion-scopes.v1.json');

export function loadCompletionScopes(scopePath = DEFAULT_SCOPE_PATH) {
  const authority = JSON.parse(fs.readFileSync(resolvePath(scopePath), 'utf8'));
  if (authority.schema !== 'ev4-builder-completion-scopes@1.0.0' || !authority.scopes) {
    throw new RuntimeTransactionError('COMPLETION-SCOPE-AUTHORITY-INVALID', 'Completion Scope authority is invalid.');
  }
  return authority;
}

export function validateCompletionScope(status, checkpoint, scopeAuthority = null) {
  const diagnostics = [];
  const authority = scopeAuthority || loadCompletionScopes();
  const scope = authority.scopes[status.completion_scope];
  if (!scope) {
    diagnostics.push(diagnostic('COMPLETION-SCOPE-UNSUPPORTED', `Unsupported completion_scope: ${status.completion_scope ?? '<missing>'}`));
    return { passed: false, diagnostics, scope: null };
  }
  if (!(scope.claim_scope_values || []).includes(status.claim_scope)) diagnostics.push(diagnostic('COMPLETION-SCOPE-CLAIM-MISMATCH', 'claim_scope is incompatible with completion_scope.'));
  for (const stateName of scope.required_states || []) {
    if (status.states?.[stateName] !== true) diagnostics.push(diagnostic('COMPLETION-SCOPE-STATE-MISSING', `Required Builder state is not true: ${stateName}`));
  }
  for (const category of scope.required_evidence_categories || []) {
    if (status.evidence?.[category] !== true) diagnostics.push(diagnostic('COMPLETION-SCOPE-EVIDENCE-MISSING', `Required Builder evidence category is not true: ${category}`));
  }
  for (const [field, expected] of Object.entries(scope.required_top_level || {})) {
    if (status[field] !== expected) diagnostics.push(diagnostic('COMPLETION-SCOPE-FLAG-MISMATCH', `${field} must equal ${JSON.stringify(expected)} for ${status.completion_scope}.`));
  }
  for (const forbidden of scope.forbidden_true_claims || []) {
    if (status[forbidden] === true) diagnostics.push(diagnostic('COMPLETION-SCOPE-FORBIDDEN-CLAIM', `${forbidden} must not be true for ${status.completion_scope}.`));
  }
  if (status.scope_excludes_responsive === true && !scope.permitted_exclusions?.includes('responsive')) {
    diagnostics.push(diagnostic('COMPLETION-SCOPE-EXCLUSION-FORBIDDEN', 'Responsive exclusion is not permitted by this completion scope.'));
  }
  if (status.scope_excludes_responsive !== true && scope.required_top_level?.scope_excludes_responsive === true) {
    diagnostics.push(diagnostic('COMPLETION-SCOPE-EXCLUSION-CONTRADICTION', 'Builder-only desktop scope must explicitly exclude Responsive completion.'));
  }

  const unresolvedAssertions = (checkpoint.assertions || []).filter((entry) => ['not_checked', 'insufficient_evidence'].includes(entry.status));
  if (unresolvedAssertions.length > 0) diagnostics.push(diagnostic('COMPLETION-SCOPE-ASSERTIONS-UNRESOLVED', 'Checkpoint contains unresolved Builder assertions.'));
  return { passed: diagnostics.length === 0, diagnostics, scope };
}

export function validateCompletionGateBinding(gate, status, checkpoint, ledger, ledgerValidation, verification, scopeValidation) {
  const diagnostics = [];
  const evidenceDigest = computeCanonicalDigest(checkpoint.evidence_ledger || []);
  const expected = {
    session_id: checkpoint.session_id,
    package_digest: verification.canonical_package_digest,
    source_file_sha256: verification.source_file_sha256,
    selected_candidate_id: verification.selected_candidate_id,
    checkpoint_id: checkpoint.checkpoint_id,
    checkpoint_sequence: checkpoint.checkpoint_sequence,
    action_ledger_id: ledger.ledger_id,
    action_ledger_digest: ledgerValidation.digest,
    completion_scope: status.completion_scope,
    evidence_ledger_digest: evidenceDigest
  };
  for (const [field, value] of Object.entries(expected)) {
    if (gate[field] !== value) diagnostics.push(diagnostic('COMPLETION-GATE-BINDING-MISMATCH', `Completion Gate ${field} does not match the active Runtime Transaction.`));
  }

  const evidenceIds = new Set((checkpoint.evidence_ledger || []).map((entry) => entry.evidence_id));
  for (const [proofName, proof] of Object.entries(gate.proofs || {})) {
    for (const ref of proof.evidence_refs || []) {
      if (!evidenceIds.has(ref)) diagnostics.push(diagnostic('COMPLETION-GATE-FOREIGN-EVIDENCE', `Proof ${proofName} references foreign evidence: ${ref}`));
    }
  }
  for (const category of scopeValidation.scope?.required_evidence_categories || []) {
    const proofName = scopeValidation.scope.evidence_proof_map?.[category];
    const proof = gate.proofs?.[proofName];
    if (!proof || proof.status !== 'confirmed' || !Array.isArray(proof.evidence_refs) || proof.evidence_refs.length === 0) {
      diagnostics.push(diagnostic('COMPLETION-GATE-PROOF-MISSING', `Completion Gate lacks confirmed proof for required category ${category}.`));
    }
  }
  if (gate.production_ready_allowed !== false || gate.production_ready_claim !== false) {
    diagnostics.push(diagnostic('COMPLETION-GATE-PRODUCTION-CLAIM', 'Builder-only Completion Gate must keep production readiness false.'));
  }
  return { passed: diagnostics.length === 0, diagnostics, evidence_ledger_digest: evidenceDigest };
}
