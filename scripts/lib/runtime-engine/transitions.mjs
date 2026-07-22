import fs from 'node:fs';
import path from 'node:path';
import { ROOT, RuntimeTransactionError, diagnostic, duplicates, resolvePath } from './common.mjs';

const DEFAULT_TRANSITION_PATH = path.join(ROOT, 'runtime', 'state-transitions.v1.json');
const genericFact = (name) => (context) => context.guardFacts?.[name] === true;

export function createGuardRegistry() {
  const names = [
    'no_initialized_session', 'preserve_session_id', 'preserve_checkpoint', 'preserve_unresolved_blockers',
    'candidate_is_unambiguous', 'schema_valid', 'semantic_valid', 'lineage_valid', 'input_authorization_valid',
    'blocking_diagnostic_present', 'session_exists', 'resumable_state_recorded', 'prior_initialized_state_exists',
    'session_id_matches', 'package_digest_matches', 'source_file_sha256_matches', 'candidate_matches',
    'checkpoint_valid', 'unresolved_blockers_preserved', 'action_batch_valid', 'no_blocker',
    'confirmation_binding_created', 'active_confirmation_matches', 'checkpoint_updated',
    'repair_packet_created_or_updated', 'final_checkpoint_valid', 'required_actions_complete',
    'unresolved_blocking_evidence_count_zero', 'completion_status_valid', 'completion_gate_valid',
    'builder_input_verified', 'intake_capsule_reconciled', 'action_ledger_reconciled',
    'completion_scope_satisfied', 'completion_gate_cross_bound', 'predecessor_checkpoint_bound'
  ];
  return Object.fromEntries(names.map((name) => [name, genericFact(name)]));
}

export function loadTransitionAuthority(options = {}) {
  const transitionPath = resolvePath(options.transitionPath || DEFAULT_TRANSITION_PATH);
  const guardRegistry = options.guardRegistry || createGuardRegistry();
  const authority = JSON.parse(fs.readFileSync(transitionPath, 'utf8'));
  const diagnostics = [];
  if (authority.schema !== 'ev4-builder-state-transitions@1.0.0') diagnostics.push(diagnostic('TRANSITION-AUTHORITY-001', 'Unsupported transition authority schema.'));
  for (const duplicate of duplicates((authority.transitions || []).map((entry) => entry.id))) diagnostics.push(diagnostic('TRANSITION-AUTHORITY-002', `Duplicate transition id: ${duplicate}`));
  for (const transition of authority.transitions || []) {
    if (!transition.id || !transition.trigger) diagnostics.push(diagnostic('TRANSITION-AUTHORITY-003', 'Every transition requires id and trigger.'));
    for (const guard of transition.guards || []) {
      if (typeof guardRegistry[guard] !== 'function') diagnostics.push(diagnostic('TRANSITION-AUTHORITY-004', `No guard evaluator is registered for ${guard}.`, `transition=${transition.id}`));
    }
    if (transition.to && typeof transition.to === 'object') {
      const mode = transition.to.workflow_mode;
      const state = transition.to.runtime_state;
      if (mode !== 'SAME' && state && !authority.allowed_combinations?.[mode]?.includes(state)) diagnostics.push(diagnostic('TRANSITION-AUTHORITY-005', `Transition ${transition.id} targets an illegal mode/state combination.`));
    }
  }
  if (diagnostics.length) throw new RuntimeTransactionError('TRANSITION-AUTHORITY-INVALID', 'Canonical transition authority is invalid.', diagnostics);
  return { ...authority, guardRegistry, transitionPath };
}

export function isAllowedCombination(workflowMode, runtimeState, authority = null) {
  const loaded = authority || loadTransitionAuthority();
  return Array.isArray(loaded.allowed_combinations?.[workflowMode]) && loaded.allowed_combinations[workflowMode].includes(runtimeState);
}

function sourceMatches(from, session) {
  if (from === null) return !session;
  if (typeof from === 'string') {
    if (from === 'ANY_INITIALIZED_STATE') return Boolean(session?.session_id);
    if (from === 'ANY_INITIALIZED_NON_COMPLETED_STATE') return Boolean(session?.session_id) && session.runtime_state !== 'COMPLETED';
    return false;
  }
  return (from.workflow_mode === 'ANY' || from.workflow_mode === session?.workflow_mode) && from.runtime_state === session?.runtime_state;
}

function resolveTarget(transition, session) {
  if (transition.to === 'SAME_STATE') return { workflow_mode: session.workflow_mode, runtime_state: session.runtime_state };
  if (transition.to === 'PREVIOUS_RESUMABLE_STATE') return session.resume_target ?? null;
  if (typeof transition.to === 'object') return { workflow_mode: transition.to.workflow_mode === 'SAME' ? session.workflow_mode : transition.to.workflow_mode, runtime_state: transition.to.runtime_state };
  return null;
}

export function evaluateTransition(authority, transitionId, context) {
  const transition = authority.transitions.find((entry) => entry.id === transitionId);
  if (!transition) throw new RuntimeTransactionError('TRANSITION-UNKNOWN', `Unknown transition: ${transitionId}`);
  const diagnostics = [];
  if (!sourceMatches(transition.from, context.session)) diagnostics.push(diagnostic('TRANSITION-SOURCE-MISMATCH', `Source mode/state does not match transition ${transitionId}.`));
  const target = resolveTarget(transition, context.session);
  if (!target || !isAllowedCombination(target.workflow_mode, target.runtime_state, authority)) diagnostics.push(diagnostic('TRANSITION-TARGET-ILLEGAL', `Resolved target for ${transitionId} is unavailable or illegal.`));
  if (target && (transition.forbidden_targets || []).includes(target.runtime_state)) diagnostics.push(diagnostic('TRANSITION-TARGET-FORBIDDEN', `Transition ${transitionId} forbids target runtime_state ${target.runtime_state}.`));

  const guardResults = {};
  for (const guard of transition.guards || []) {
    const evaluator = authority.guardRegistry[guard];
    if (typeof evaluator !== 'function') { diagnostics.push(diagnostic('TRANSITION-GUARD-MISSING', `Guard evaluator is unavailable: ${guard}`)); guardResults[guard] = false; continue; }
    let passed = false;
    try { passed = evaluator(context) === true; }
    catch (error) { diagnostics.push(diagnostic('TRANSITION-GUARD-ERROR', `Guard ${guard} raised an error.`, error.message)); }
    guardResults[guard] = passed;
    if (!passed) diagnostics.push(diagnostic('TRANSITION-GUARD-FAILED', `Guard failed: ${guard}`));
  }
  if (diagnostics.length) throw new RuntimeTransactionError('TRANSITION-BLOCKED', `Transition ${transitionId} was blocked.`, diagnostics);
  return { transition, target, guardResults };
}
