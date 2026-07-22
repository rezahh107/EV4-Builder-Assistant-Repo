#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  computeCanonicalDigest,
  computePackageDigest,
  sha256Bytes,
  sortedCanonicalJson
} from './lib/canonical-builder-package.mjs';

const ROOT = process.cwd();
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const HASH = /^[a-f0-9]{64}$/;
const TRANSITIONS_PATH = path.join(ROOT, 'runtime', 'state-transitions.v1.json');

function usage() {
  console.error(`Usage:
  node scripts/builder-inspector.mjs intake <builder-input.json> [intake-result.json]
  node scripts/builder-inspector.mjs verify-capsule <builder-input.json> <intake-result.json>
  node scripts/builder-inspector.mjs resume <intake-result.json> <session-state.json> <checkpoint.json> [resume-result.json]
  node scripts/builder-inspector.mjs completion <intake-result.json> <session-state.json> <checkpoint.json> <completion-status.json> <completion-gate.json> [completion-result.json]`);
  process.exit(2);
}

function resolveFile(value) {
  if (!value || typeof value !== 'string') usage();
  return path.resolve(ROOT, value);
}

function readBytes(file) {
  return fs.readFileSync(resolveFile(file));
}

function readJson(file) {
  return JSON.parse(readBytes(file).toString('utf8'));
}

function diagnosticText(result) {
  return `${result.stderr || ''}\n${result.stdout || ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-8)
    .join(' | ')
    .slice(0, 1200);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    shell: false
  });
  return {
    passed: !result.error && result.status === 0,
    detail: result.error?.message || diagnosticText(result),
    exit_code: result.status ?? 1
  };
}

function runAjv(schema, data, refs = []) {
  const args = [
    '--yes',
    'ajv-cli@5',
    'validate',
    '--spec=draft2020',
    '--strict=false',
    '-s', schema
  ];
  for (const ref of refs) args.push('-r', ref);
  args.push('-d', data);
  return run(NPX, args);
}

function runNode(script, ...args) {
  return run(process.execPath, [script, ...args]);
}

function atomicWriteJson(outputFile, value) {
  const output = resolveFile(outputFile);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.tmp-${process.pid}-${Date.now()}`;
  const body = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(temporary, body, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temporary, output);
}

function addDiagnostic(target, code, message, detail = '') {
  target.push({ code, message, ...(detail ? { detail } : {}) });
}

function printResult(result, outputFile) {
  if (outputFile) atomicWriteJson(outputFile, result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function validateSession(file) {
  const schema = runAjv('schemas/session-state.schema.json', file, [
    'schemas/checkpoint.schema.json',
    'schemas/evidence-record.schema.json',
    'schemas/repair-packet.schema.json'
  ]);
  const semantic = runNode('scripts/validate-session-state.mjs', file);
  return { passed: schema.passed && semantic.passed, schema, semantic };
}

function validateCheckpoint(file) {
  const schema = runAjv('schemas/checkpoint.schema.json', file, [
    'schemas/evidence-record.schema.json'
  ]);
  const semantic = runNode('scripts/validate-checkpoint.mjs', file);
  return { passed: schema.passed && semantic.passed, schema, semantic };
}

function validateCompletionStatus(file) {
  const schema = runAjv('schemas/completion-status.schema.json', file);
  const semantic = runNode('scripts/validate-completion-status.mjs', file);
  return { passed: schema.passed && semantic.passed, schema, semantic };
}

function validateCompletionGate(file) {
  const schema = runAjv('schemas/completion-gate.schema.json', file);
  const semantic = runNode('scripts/validate-completion-gate.mjs', file);
  return { passed: schema.passed && semantic.passed, schema, semantic };
}

function isAcceptedCapsule(capsule) {
  return capsule?.schema === 'ev4-builder-intake-result@1.0.0'
    && capsule.status === 'accepted'
    && HASH.test(capsule.source_file_sha256 || '')
    && HASH.test(capsule.canonical_package_digest || '')
    && typeof capsule.selected_candidate_id === 'string'
    && capsule.selected_candidate_id.length > 0;
}

function unresolvedFromCheckpoint(checkpoint) {
  const explicit = Array.isArray(checkpoint.unresolved_blockers) ? checkpoint.unresolved_blockers : [];
  const assertionBlockers = (checkpoint.assertions || [])
    .filter((entry) => ['not_checked', 'insufficient_evidence'].includes(entry?.status))
    .map((entry) => entry.assertion_id || entry.subject_ref || 'unresolved_assertion');
  return [...new Set([...explicit, ...assertionBlockers])];
}

function intake(sourceFile, outputFile = `${sourceFile}.intake-result.json`) {
  const diagnostics = [];
  const warnings = [];
  const bytes = readBytes(sourceFile);
  const sourceHash = sha256Bytes(bytes);
  let pkg = null;

  try {
    pkg = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    addDiagnostic(diagnostics, 'BUILDER-INTAKE-001', 'Malformed JSON.', error.message);
  }

  if (pkg && pkg.schema !== 'ev4-builder-context-package@1.0.0') {
    const special = pkg.schema?.includes('receipt')
      ? 'Receipt-only intake is not Builder semantic input.'
      : pkg.schema?.includes('project-gate')
        ? 'Raw Project Gate envelopes are not Builder semantic input.'
        : 'Unsupported Builder input schema.';
    addDiagnostic(diagnostics, 'BUILDER-INTAKE-002', special, `received=${pkg.schema ?? '<missing>'}`);
  }

  if (pkg && diagnostics.length === 0) {
    const checks = [
      ['BUILDER-INTAKE-003', 'Builder Context Schema validation failed.', runAjv('schemas/builder-context-package.schema.json', sourceFile)],
      ['BUILDER-INTAKE-004', 'Builder semantic/cross-field validation failed.', runNode('scripts/validate-package.mjs', sourceFile)],
      ['BUILDER-INTAKE-005', 'Decision-lineage validation failed.', runNode('scripts/validate-builder-context-decision-lineage.mjs', sourceFile)]
    ];
    for (const [code, message, result] of checks) {
      if (!result.passed) addDiagnostic(diagnostics, code, message, result.detail);
    }

    if (pkg.selected_candidate_locked !== true || typeof pkg.selected_candidate_id !== 'string' || !pkg.selected_candidate_id) {
      addDiagnostic(diagnostics, 'BUILDER-INTAKE-006', 'Selected candidate identity is not locked and usable.');
    }

    const authorization = pkg.input_authorization;
    if (
      authorization?.decision !== 'approved'
      || authorization?.eligible_workflow_mode !== 'APPROVED_HANDOFF_MODE'
      || authorization?.eligible_runtime_state !== 'BUILD_ACTIVE'
      || (authorization.blocking_diagnostics || []).length !== 0
    ) {
      addDiagnostic(diagnostics, 'BUILDER-INTAKE-007', 'input_authorization does not authorize a normal Builder run.');
    }

    const computedDigest = computePackageDigest(pkg);
    if (authorization?.package_digest?.value !== computedDigest) {
      addDiagnostic(diagnostics, 'BUILDER-INTAKE-008', 'Package digest does not match canonical Builder package bytes.');
    }

    warnings.push(...(authorization?.visible_flags || []));
  }

  const accepted = pkg && diagnostics.length === 0;
  const result = {
    schema: 'ev4-builder-intake-result@1.0.0',
    status: accepted ? 'accepted' : 'blocked',
    source_file_sha256: sourceHash,
    canonical_package_digest: pkg ? computePackageDigest(pkg) : null,
    selected_candidate_id: pkg?.selected_candidate_id ?? null,
    builder_context_schema: pkg?.schema ?? null,
    blocking_diagnostics: diagnostics,
    warnings,
    source_file_unchanged: sha256Bytes(readBytes(sourceFile)) === sourceHash,
    publication: {
      atomic: true,
      output_path: path.relative(ROOT, resolveFile(outputFile))
    }
  };

  printResult(result, outputFile);
  process.exitCode = accepted ? 0 : 1;
}

function verifyCapsule(sourceFile, capsuleFile) {
  const pkg = readJson(sourceFile);
  const capsule = readJson(capsuleFile);
  const sourceHash = sha256Bytes(readBytes(sourceFile));
  const digest = computePackageDigest(pkg);
  const errors = [];

  if (!isAcceptedCapsule(capsule)) errors.push('capsule_is_not_accepted');
  if (capsule.source_file_sha256 !== sourceHash) errors.push('source_file_sha256_mismatch');
  if (capsule.canonical_package_digest !== digest) errors.push('canonical_package_digest_mismatch');
  if (capsule.selected_candidate_id !== pkg.selected_candidate_id) errors.push('selected_candidate_id_mismatch');
  if (capsule.builder_context_schema !== pkg.schema) errors.push('builder_context_schema_mismatch');

  const result = {
    schema: 'ev4-builder-capsule-verification@1.0.0',
    status: errors.length === 0 ? 'accepted' : 'blocked',
    source_file_sha256_matches: capsule.source_file_sha256 === sourceHash,
    canonical_package_digest_matches: capsule.canonical_package_digest === digest,
    selected_candidate_matches: capsule.selected_candidate_id === pkg.selected_candidate_id,
    blocking_diagnostics: errors
  };
  printResult(result);
  process.exitCode = errors.length === 0 ? 0 : 1;
}

function resume(capsuleFile, sessionFile, checkpointFile, outputFile = `${sessionFile}.resume-result.json`) {
  const diagnostics = [];
  const capsule = readJson(capsuleFile);
  const session = readJson(sessionFile);
  const checkpoint = readJson(checkpointFile);
  const sessionValidation = validateSession(sessionFile);
  const checkpointValidation = validateCheckpoint(checkpointFile);
  const transitions = readJson(path.relative(ROOT, TRANSITIONS_PATH));

  if (!isAcceptedCapsule(capsule)) addDiagnostic(diagnostics, 'BUILDER-RESUME-001', 'A valid accepted intake capsule is required.');
  if (!sessionValidation.passed) addDiagnostic(diagnostics, 'BUILDER-RESUME-002', 'Session State validation failed.', sessionValidation.semantic.detail || sessionValidation.schema.detail);
  if (!checkpointValidation.passed) addDiagnostic(diagnostics, 'BUILDER-RESUME-003', 'Checkpoint validation failed.', checkpointValidation.semantic.detail || checkpointValidation.schema.detail);

  const sessionIdMatches = typeof session.session_id === 'string'
    && session.session_id.length > 0
    && session.session_id === checkpoint.session_id;
  const packageDigestMatches = session.package_digest === capsule.canonical_package_digest
    && checkpoint.package_digest === capsule.canonical_package_digest;
  const selectedCandidateMatches = session.selected_candidate_id === capsule.selected_candidate_id
    && checkpoint.selected_candidate_id === capsule.selected_candidate_id;
  const checkpointAndStateConsistent = session.last_verified_checkpoint?.checkpoint_id === checkpoint.checkpoint_id
    && sortedCanonicalJson(session.last_verified_checkpoint) === sortedCanonicalJson(checkpoint);
  const checkpointBlockers = unresolvedFromCheckpoint(checkpoint);
  const stateBlockers = Array.isArray(session.unresolved_evidence) ? session.unresolved_evidence : [];
  const unresolvedBlockersPreserved = checkpointBlockers.every((item) => stateBlockers.includes(item));
  const target = session.resume_target;
  const targetAllowed = target
    && Array.isArray(transitions.allowed_combinations?.[target.workflow_mode])
    && transitions.allowed_combinations[target.workflow_mode].includes(target.runtime_state)
    && target.runtime_state !== 'COMPLETED';
  const transitionIsLegal = session.runtime_state === 'PAUSED' && targetAllowed;

  const booleans = {
    session_id_matches: sessionIdMatches,
    package_digest_matches: packageDigestMatches,
    selected_candidate_matches: selectedCandidateMatches,
    checkpoint_valid: checkpointValidation.passed,
    session_state_valid: sessionValidation.passed,
    checkpoint_and_state_consistent: checkpointAndStateConsistent,
    unresolved_blockers_preserved: unresolvedBlockersPreserved,
    transition_is_legal: transitionIsLegal
  };

  for (const [name, value] of Object.entries(booleans)) {
    if (!value) addDiagnostic(diagnostics, `BUILDER-RESUME-${name}`, `${name} must be true.`);
  }

  const result = {
    schema: 'ev4-builder-resume-result@1.0.0',
    status: diagnostics.length === 0 ? 'accepted' : 'blocked',
    ...booleans,
    resume_target: target ?? null,
    blocking_diagnostics: diagnostics
  };
  printResult(result, outputFile);
  process.exitCode = diagnostics.length === 0 ? 0 : 1;
}

function completion(capsuleFile, sessionFile, checkpointFile, statusFile, gateFile, outputFile = `${sessionFile}.completion-result.json`) {
  const diagnostics = [];
  const capsule = readJson(capsuleFile);
  const session = readJson(sessionFile);
  const checkpoint = readJson(checkpointFile);
  const sessionValidation = validateSession(sessionFile);
  const checkpointValidation = validateCheckpoint(checkpointFile);
  const statusValidation = validateCompletionStatus(statusFile);
  const gateValidation = validateCompletionGate(gateFile);

  if (!isAcceptedCapsule(capsule)) addDiagnostic(diagnostics, 'BUILDER-COMPLETE-001', 'A valid accepted intake capsule is required.');

  const sessionIdMatches = typeof session.session_id === 'string'
    && session.session_id.length > 0
    && session.session_id === checkpoint.session_id;
  const packageDigestMatches = session.package_digest === capsule.canonical_package_digest
    && checkpoint.package_digest === capsule.canonical_package_digest;
  const selectedCandidateMatches = session.selected_candidate_id === capsule.selected_candidate_id
    && checkpoint.selected_candidate_id === capsule.selected_candidate_id;
  const finalCheckpointValid = checkpointValidation.passed
    && session.last_verified_checkpoint?.checkpoint_id === checkpoint.checkpoint_id
    && sortedCanonicalJson(session.last_verified_checkpoint) === sortedCanonicalJson(checkpoint);
  const requiredActionsComplete = Array.isArray(checkpoint.confirmed_action_ids)
    && checkpoint.confirmed_action_ids.length > 0
    && Array.isArray(checkpoint.unconfirmed_action_ids)
    && checkpoint.unconfirmed_action_ids.length === 0;
  const unresolved = [
    ...(Array.isArray(session.unresolved_evidence) ? session.unresolved_evidence : []),
    ...unresolvedFromCheckpoint(checkpoint)
  ];
  const completionConditions = {
    workflow_mode_approved: session.workflow_mode === 'APPROVED_HANDOFF_MODE' && checkpoint.workflow_mode === 'APPROVED_HANDOFF_MODE',
    runtime_state_completed: session.runtime_state === 'COMPLETED' && session.current_state === 'COMPLETED' && checkpoint.runtime_state === 'COMPLETED',
    final_checkpoint_valid: finalCheckpointValid,
    package_digest_matches: packageDigestMatches,
    selected_candidate_matches: selectedCandidateMatches,
    session_id_matches: sessionIdMatches,
    required_actions_complete: requiredActionsComplete,
    unresolved_blocking_evidence_count: unresolved.length,
    completion_status_valid: statusValidation.passed,
    completion_gate_valid: gateValidation.passed
  };

  for (const [name, value] of Object.entries(completionConditions)) {
    const ok = name === 'unresolved_blocking_evidence_count' ? value === 0 : value === true;
    if (!ok) addDiagnostic(diagnostics, `BUILDER-COMPLETE-${name}`, `${name} did not pass.`);
  }

  const result = {
    schema: 'ev4-builder-completion-result@1.0.0',
    status: diagnostics.length === 0 ? 'accepted' : 'blocked',
    ...completionConditions,
    builder_build_complete: diagnostics.length === 0,
    responsive_complete: false,
    production_ready: false,
    blocking_diagnostics: diagnostics
  };
  printResult(result, outputFile);
  process.exitCode = diagnostics.length === 0 ? 0 : 1;
}

const [command, ...args] = process.argv.slice(2);
if (command === 'intake' && args.length >= 1) intake(args[0], args[1]);
else if (command === 'verify-capsule' && args.length === 2) verifyCapsule(args[0], args[1]);
else if (command === 'resume' && args.length >= 3) resume(args[0], args[1], args[2], args[3]);
else if (command === 'completion' && args.length >= 5) completion(args[0], args[1], args[2], args[3], args[4], args[5]);
else usage();
