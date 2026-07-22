import { clone } from './test-runtime-engine-support.mjs';
import { computeCanonicalDigest } from './lib/canonical-builder-package.mjs';
import { validateActionLedger, validateCompletionGateBinding, validateCompletionScope } from './lib/runtime-transaction-engine.mjs';

export function testLedgerScopeAndGate(h) {
  const { ledger, checkpoint, verification, status, gate, expectPassed, expectBlocked } = h;
  const baseline = validateActionLedger(ledger, checkpoint, verification);
  expectPassed('valid Action Ledger', baseline);
  if (!baseline.complete) h.fail('valid Action Ledger is not complete.');

  const mutations = [
    ['pending Action deleted', (l) => { l.actions = []; }],
    ['entire Action Batch omitted', (l) => { l.batches = []; l.actions = []; }],
    ['confirmed Action from another batch', (l) => { l.actions[0].batch_id = 'FOREIGN-BATCH'; }],
    ['foreign Action ID', (l) => { l.actions[0].action_id = 'FOREIGN-ACTION'; }],
    ['duplicate Action ID', (l) => { l.actions.push(clone(l.actions[0])); }],
    ['Action with two statuses', (l) => { l.actions.push({ ...clone(l.actions[0]), status: 'cancelled', disposition_reason: 'x', authorization_ref: 'AUTH' }); }],
    ['unauthorized cancellation', (l) => { l.actions[0] = { action_id: 'BATCH-001-A01', batch_id: 'BATCH-001', status: 'cancelled' }; }],
    ['not-applicable without justification', (l) => { l.actions[0] = { action_id: 'BATCH-001-A01', batch_id: 'BATCH-001', status: 'not_applicable' }; }],
    ['Ledger package mismatch', (l) => { l.package_digest = '0'.repeat(64); }],
    ['Ledger candidate mismatch', (l) => { l.selected_candidate_id = 'FOREIGN'; }],
    ['Ledger session mismatch', (l) => { l.session_id = 'FOREIGN'; }],
    ['stale Ledger sequence', (l) => { l.ledger_sequence = 2; }],
    ['altered Ledger after Checkpoint', (l) => { l.actions[0].confirmation_ref = 'ALTERED'; }]
  ];
  for (const [label, mutate] of mutations) {
    const x = clone(ledger); mutate(x);
    expectBlocked(label, () => validateActionLedger(x, checkpoint, verification));
  }
  const pending = clone(ledger); pending.actions[0] = { action_id: 'BATCH-001-A01', batch_id: 'BATCH-001', status: 'pending' };
  const pendingCheckpoint = clone(checkpoint);
  pendingCheckpoint.action_ledger_digest = computeCanonicalDigest(pending);
  pendingCheckpoint.confirmed_action_ids = [];
  pendingCheckpoint.unconfirmed_action_ids = ['BATCH-001-A01'];
  expectPassed('pending Action represented exactly', validateActionLedger(pending, pendingCheckpoint, verification));
  const omittedPending = clone(pendingCheckpoint); omittedPending.unconfirmed_action_ids = [];
  expectBlocked('pending Action omitted from Checkpoint arrays', () => validateActionLedger(pending, omittedPending, verification));
  const summary = clone(checkpoint); summary.confirmed_action_ids = []; summary.unconfirmed_action_ids = [];
  expectBlocked('Checkpoint summary not reconciling', () => validateActionLedger(ledger, summary, verification));

  const scope = validateCompletionScope(status, checkpoint);
  expectPassed('valid Completion Scope', scope);
  for (const [label, mutate] of [
    ['missing required Builder state', (x) => { x.states.structure_built = false; }],
    ['false required evidence', (x) => { x.evidence.layout = false; }],
    ['contradictory scope exclusion', (x) => { x.scope_excludes_responsive = false; }],
    ['unsupported scope', (x) => { x.completion_scope = 'unsupported'; }],
    ['production-ready claim without scope', (x) => { x.production_ready = true; }],
    ['responsive-complete claim in Builder scope', (x) => { x.responsive_complete = true; }],
    ['incomplete desktop disguised by exclusion', (x) => { x.states.desktop_layout_established = false; x.scope_excludes_responsive = true; }]
  ]) { const x = clone(status); mutate(x); expectBlocked(label, () => validateCompletionScope(x, checkpoint)); }

  const gateValidation = validateCompletionGateBinding(gate, status, checkpoint, ledger, baseline, verification, scope);
  expectPassed('valid Completion Gate binding', gateValidation);
  for (const [label, field, value] of [
    ['wrong candidate', 'selected_candidate_id', 'FOREIGN'], ['wrong package', 'package_digest', '1'.repeat(64)],
    ['wrong Session', 'session_id', 'FOREIGN'], ['wrong Checkpoint', 'checkpoint_id', 'FOREIGN'],
    ['stale Checkpoint sequence', 'checkpoint_sequence', 99], ['wrong Ledger ID', 'action_ledger_id', 'FOREIGN'],
    ['wrong Ledger digest', 'action_ledger_digest', '2'.repeat(64)], ['wrong evidence digest', 'evidence_ledger_digest', '3'.repeat(64)],
    ['unsupported Gate scope', 'completion_scope', 'unsupported']
  ]) { const x = clone(gate); x[field] = value; expectBlocked(label, () => validateCompletionGateBinding(x, status, checkpoint, ledger, baseline, verification, scope)); }
  const foreignEvidence = clone(gate); foreignEvidence.proofs.layout_verified.evidence_refs = ['FOREIGN-EVIDENCE'];
  expectBlocked('foreign evidence reference', () => validateCompletionGateBinding(foreignEvidence, status, checkpoint, ledger, baseline, verification, scope));
  const copied = clone(gate); copied.session_id = 'OTHER-RUN'; copied.checkpoint_id = 'OTHER-CP';
  expectBlocked('Gate copied from another Run', () => validateCompletionGateBinding(copied, status, checkpoint, ledger, baseline, verification, scope));
}
