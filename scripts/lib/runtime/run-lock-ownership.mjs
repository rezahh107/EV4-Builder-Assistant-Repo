import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  diagnostic,
  resolveRoot,
  readJson,
  writeJson,
  safeRunRef,
  sleepSync
} from './run-primitives.mjs';
import { loadRunUnlocked } from './run-state-validation.mjs';

const LOCK_SCHEMA = 'ev4-builder-local-run-lock@1.0.0';
const RECOVERY_GUARD_SCHEMA = 'ev4-builder-local-lock-recovery-guard@1.0.0';

function blocked(operation, code, message, detail = '') {
  return {
    passed: false,
    status: 'blocked',
    operation,
    state_modified: false,
    diagnostics: [diagnostic(code, message, detail)]
  };
}

function metadataFile(directory) {
  return path.join(directory, 'lock.json');
}

function processStartToken(processId) {
  if (process.platform !== 'linux') return null;
  try {
    const stat = fs.readFileSync(`/proc/${processId}/stat`, 'utf8');
    const close = stat.lastIndexOf(')');
    if (close < 0) return null;
    const fieldsAfterCommand = stat.slice(close + 2).trim().split(/\s+/);
    return fieldsAfterCommand[19] || null;
  } catch {
    return null;
  }
}

function validLockMetadata(metadata, expectedSchema = LOCK_SCHEMA) {
  return metadata?.schema === expectedSchema
    && typeof metadata?.lock_id === 'string'
    && metadata.lock_id.length >= 16
    && Number.isInteger(metadata?.process_id)
    && metadata.process_id > 0
    && (metadata.process_start_token === null || typeof metadata.process_start_token === 'string');
}

function readMetadata(directory) {
  try {
    return { passed: true, metadata: readJson(metadataFile(directory)) };
  } catch (error) {
    return { passed: false, metadata: null, error };
  }
}

export function inspectRecordedOwnerLiveness(metadata) {
  if (!validLockMetadata(metadata)) return { state: 'malformed', detail: 'lock_metadata_invalid' };
  try {
    process.kill(metadata.process_id, 0);
  } catch (error) {
    if (error?.code === 'ESRCH') return { state: 'dead', detail: 'process_not_found' };
    if (error?.code === 'EPERM') return { state: 'unknown', detail: 'process_permission_denied' };
    return { state: 'unknown', detail: error?.code || error?.message || 'process_probe_failed' };
  }

  if (metadata.process_start_token !== null) {
    const observed = processStartToken(metadata.process_id);
    if (observed === null) {
      try {
        process.kill(metadata.process_id, 0);
      } catch (error) {
        if (error?.code === 'ESRCH') return { state: 'dead', detail: 'process_ended_during_probe' };
      }
      return { state: 'unknown', detail: 'process_start_identity_unavailable' };
    }
    if (observed !== metadata.process_start_token) return { state: 'dead', detail: 'process_identity_reused' };
  }

  return { state: 'live', detail: 'recorded_owner_alive' };
}

function acquireOwnedDirectory(directory, schema, operation) {
  const lockId = randomUUID();
  try {
    fs.mkdirSync(directory, { recursive: false });
  } catch (error) {
    if (error?.code === 'EEXIST') return { passed: false, result: blocked(operation, 'RUN_BUSY_OR_STALE_LOCK', 'Run mutation lock is already held. No State was loaded or modified.') };
    throw error;
  }

  const metadata = {
    schema,
    lock_id: lockId,
    operation,
    process_id: process.pid,
    process_start_token: processStartToken(process.pid),
    created_at: new Date().toISOString()
  };

  try {
    writeJson(metadataFile(directory), metadata, 'wx');
  } catch (error) {
    try { fs.rmdirSync(directory); } catch { /* Preserve any replacement or non-empty directory. */ }
    throw error;
  }

  return { passed: true, lockDirectory: directory, lock_id: lockId, metadata };
}

function claimOwnedDirectory(directory, expectedLockId, purpose) {
  const before = readMetadata(directory);
  if (!before.passed || before.metadata?.lock_id !== expectedLockId) return { passed: false, reason: 'ownership_mismatch' };
  const claimedDirectory = `${directory}.${purpose}-${expectedLockId}`;
  try {
    fs.renameSync(directory, claimedDirectory);
  } catch (error) {
    return { passed: false, reason: error?.code || 'claim_failed' };
  }
  const after = readMetadata(claimedDirectory);
  if (!after.passed || after.metadata?.lock_id !== expectedLockId) {
    if (!fs.existsSync(directory)) {
      try { fs.renameSync(claimedDirectory, directory); } catch { /* Fail closed and preserve both paths. */ }
    }
    return { passed: false, reason: 'ownership_changed_during_claim', claimedDirectory };
  }
  return { passed: true, claimedDirectory, metadata: after.metadata };
}

function restoreClaimedDirectory(claimedDirectory, lockDirectory) {
  if (!claimedDirectory || !fs.existsSync(claimedDirectory) || fs.existsSync(lockDirectory)) return false;
  try {
    fs.renameSync(claimedDirectory, lockDirectory);
    return true;
  } catch {
    return false;
  }
}

export function acquireRunLock(runDirectory, operation) {
  const run = resolveRoot(runDirectory);
  const lockDirectory = path.join(run, '.mutation-lock');
  const handle = acquireOwnedDirectory(lockDirectory, LOCK_SCHEMA, operation);
  if (!handle.passed) return handle;

  try {
    const current = readJson(path.join(run, 'CURRENT.json'));
    const metadata = { ...handle.metadata, run_id: current.run_id };
    fs.writeFileSync(metadataFile(lockDirectory), `${JSON.stringify(metadata, null, 2)}\n`, { flag: 'w' });
    handle.metadata = metadata;
  } catch {
    // The authoritative load after acquisition reports malformed or missing State.
  }

  const hold = Number.parseInt(process.env.EV4_BUILDER_TEST_HOLD_LOCK_MS || '0', 10);
  if (hold > 0) sleepSync(hold);
  return handle;
}

export function releaseRunLock(handle) {
  if (!handle?.lockDirectory || typeof handle?.lock_id !== 'string') return { released: false, reason: 'invalid_handle' };
  if (!fs.existsSync(handle.lockDirectory)) return { released: false, reason: 'lock_missing' };
  const claim = claimOwnedDirectory(handle.lockDirectory, handle.lock_id, 'release');
  if (!claim.passed) return { released: false, reason: claim.reason };
  fs.rmSync(claim.claimedDirectory, { recursive: true, force: true });
  return { released: true, reason: null };
}

function collectRecoveryDebris(run) {
  const paths = [];
  for (const name of fs.readdirSync(run)) if (name.startsWith('CURRENT.tmp-')) paths.push(name);
  const generations = path.join(run, 'generations');
  if (fs.existsSync(generations)) {
    for (const name of fs.readdirSync(generations)) if (name.startsWith('.tmp-')) paths.push(`generations/${name}`);
  }
  return paths.sort();
}

export function recoverRunLock({ runDirectory }) {
  const run = resolveRoot(runDirectory);
  const lockDirectory = path.join(run, '.mutation-lock');
  const recoveryGuardDirectory = path.join(run, '.mutation-lock-recovery');
  const guard = acquireOwnedDirectory(recoveryGuardDirectory, RECOVERY_GUARD_SCHEMA, 'recover-run-lock');
  if (!guard.passed) return blocked('recover-run-lock', 'RUN-LOCK-RECOVERY-005', 'Another lock recovery attempt is already in progress.');

  let claimedDirectory = null;
  let recoveryLock = null;
  try {
    if (!fs.existsSync(lockDirectory)) return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-001', 'No Run mutation lock exists.')] };
    const read = readMetadata(lockDirectory);
    if (!read.passed || !validLockMetadata(read.metadata)) return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-002', 'Run mutation lock metadata is malformed; recovery is blocked.')] };

    const initialLiveness = inspectRecordedOwnerLiveness(read.metadata);
    if (initialLiveness.state === 'live') return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-LIVE-OWNER', 'Recorded Run lock owner is still alive; recovery is blocked.', initialLiveness.detail)] };
    if (initialLiveness.state !== 'dead') return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-UNKNOWN-OWNER', 'Recorded Run lock owner liveness is unknown; recovery is blocked.', initialLiveness.detail)] };

    const claim = claimOwnedDirectory(lockDirectory, read.metadata.lock_id, 'recovering');
    if (!claim.passed) return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-006', 'Run mutation lock ownership changed during recovery; no lock was removed.', claim.reason)] };
    claimedDirectory = claim.claimedDirectory;

    recoveryLock = acquireOwnedDirectory(lockDirectory, LOCK_SCHEMA, 'recover-run-lock');
    if (!recoveryLock.passed) {
      return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-006', 'A replacement writer acquired the Run mutation lock during recovery; no replacement lock was removed.')] };
    }

    const claimedLiveness = inspectRecordedOwnerLiveness(claim.metadata);
    if (claimedLiveness.state !== 'dead') {
      const code = claimedLiveness.state === 'live' ? 'RUN-LOCK-RECOVERY-LIVE-OWNER' : 'RUN-LOCK-RECOVERY-UNKNOWN-OWNER';
      return { passed: false, diagnostics: [diagnostic(code, 'Recorded owner is not proven dead after lock claim; recovery is blocked.', claimedLiveness.detail)] };
    }

    const loaded = loadRunUnlocked(run);
    if (!loaded.passed) return { ...loaded, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-003', 'Active Run validation failed; lock recovery is blocked.'), ...loaded.diagnostics] };

    const debris = collectRecoveryDebris(run);
    const authoritativeText = JSON.stringify({ current: loaded.current, manifest: loaded.manifest });
    for (const ref of debris) {
      if (authoritativeText.includes(ref)) return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-004', `Recovery debris is referenced by active authority: ${ref}.`)] };
    }

    for (const ref of debris) {
      const target = safeRunRef(run, ref);
      if (!target || !fs.existsSync(target)) continue;
      const stat = fs.statSync(target);
      if (stat.isDirectory()) fs.rmSync(target, { recursive: true, force: true });
      else fs.rmSync(target, { force: true });
    }

    fs.rmSync(claimedDirectory, { recursive: true, force: true });
    claimedDirectory = null;
    return {
      passed: true,
      diagnostics: [],
      result: {
        schema: 'ev4-builder-run-lock-recovery-result@1.0.0',
        status: 'accepted',
        run_id: loaded.manifest.run_id,
        active_generation: loaded.current.generation,
        state_modified: false,
        current_pointer_advanced: false,
        lock_removed: true,
        recovered_lock_id: read.metadata.lock_id,
        temporary_paths_removed: debris,
        orphan_generations_preserved: true,
        builder_build_complete: loaded.checkpoint.runtime_state === 'COMPLETED',
        responsive_complete: false,
        production_ready: false
      }
    };
  } finally {
    if (recoveryLock?.passed) releaseRunLock(recoveryLock);
    if (claimedDirectory && fs.existsSync(claimedDirectory)) restoreClaimedDirectory(claimedDirectory, lockDirectory);
    releaseRunLock(guard);
  }
}
