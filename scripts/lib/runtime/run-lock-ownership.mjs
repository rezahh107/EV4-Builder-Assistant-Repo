import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  diagnostic,
  resolveRoot,
  readJson,
  stableJson,
  injectedPoint,
  fsyncFile,
  fsyncDirectory,
  safeRunRef,
  sleepSync
} from './run-primitives.mjs';
import { loadRunUnlocked } from './run-state-validation.mjs';

const LOCK_SCHEMA = 'ev4-builder-local-run-lock@1.0.0';
const RECOVERY_GUARD_SCHEMA = 'ev4-builder-local-lock-recovery-guard@1.0.0';
const PREPARATION_PREFIX = '.lock-preparation-';
const CLAIM_PREFIX = '.lock-claim-';

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

function preparationFile(directory, lockId) {
  return path.join(directory, `${PREPARATION_PREFIX}${lockId}.json`);
}

function claimFile(directory, purpose, lockId) {
  return path.join(directory, `${CLAIM_PREFIX}${purpose}-${lockId}-${randomUUID()}.json`);
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

function readMetadataFile(file) {
  try {
    return { passed: true, metadata: readJson(file) };
  } catch (error) {
    return { passed: false, metadata: null, error };
  }
}

function readMetadata(directory) {
  return readMetadataFile(metadataFile(directory));
}

function ensureInertContainer(directory, operation) {
  try {
    fs.mkdirSync(directory, { recursive: false });
    fsyncDirectory(path.dirname(directory));
    return { passed: true };
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      return {
        passed: false,
        result: blocked(operation, 'RUN-LOCK-PUBLICATION-UNAVAILABLE', 'Run lock container could not be created; no State was loaded or modified.', error?.code || error?.message || 'container_creation_failed')
      };
    }
  }

  try {
    const stat = fs.lstatSync(directory);
    if (stat.isDirectory() && !stat.isSymbolicLink()) return { passed: true };
    return {
      passed: false,
      result: blocked(operation, 'RUN-LOCK-PUBLICATION-UNAVAILABLE', 'Run lock container exists but is not a real directory; no State was loaded or modified.', 'container_type_invalid')
    };
  } catch (error) {
    return {
      passed: false,
      result: blocked(operation, 'RUN-LOCK-PUBLICATION-UNAVAILABLE', 'Run lock container could not be inspected; no State was loaded or modified.', error?.code || error?.message || 'container_inspection_failed')
    };
  }
}

function finalEntryExists(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function busyResult(operation) {
  return blocked(operation, 'RUN_BUSY_OR_STALE_LOCK', 'Run mutation lock is already held. No State was loaded or modified.');
}

function publicationUnavailable(operation, error) {
  return blocked(
    operation,
    'RUN-LOCK-PUBLICATION-UNAVAILABLE',
    'Complete Run lock metadata could not be published with hard-link no-clobber semantics. No State was loaded or modified.',
    error?.code || error?.message || 'hard_link_publication_failed'
  );
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
  const container = ensureInertContainer(directory, operation);
  if (!container.passed) return container;

  const finalFile = metadataFile(directory);
  try {
    if (finalEntryExists(finalFile)) return { passed: false, result: busyResult(operation) };
  } catch (error) {
    return { passed: false, result: publicationUnavailable(operation, error) };
  }

  const lockId = randomUUID();
  const metadata = {
    schema,
    lock_id: lockId,
    operation,
    process_id: process.pid,
    process_start_token: processStartToken(process.pid),
    created_at: new Date().toISOString()
  };
  const serializedMetadata = stableJson(metadata);
  const temporaryFile = preparationFile(directory, lockId);
  let linked = false;

  try {
    injectedPoint(null, 'before_lock_temporary_write');
    fs.writeFileSync(temporaryFile, serializedMetadata, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    fsyncFile(temporaryFile);
    injectedPoint(null, 'after_lock_temporary_write');
    injectedPoint(null, 'before_lock_final_link');
    try {
      fs.linkSync(temporaryFile, finalFile);
    } catch (error) {
      if (error?.code === 'EEXIST') return { passed: false, result: busyResult(operation) };
      return { passed: false, result: publicationUnavailable(operation, error) };
    }
    linked = true;
    fsyncDirectory(directory);

    try {
      injectedPoint(null, 'after_lock_final_link');
      fs.rmSync(temporaryFile, { force: true });
      fsyncDirectory(directory);
    } catch {
      // Complete final metadata is already authoritative. Preparation debris is inert.
    }

    return { passed: true, lockDirectory: directory, lock_id: lockId, metadata };
  } catch (error) {
    if (linked) return { passed: true, lockDirectory: directory, lock_id: lockId, metadata };
    return { passed: false, result: publicationUnavailable(operation, error) };
  } finally {
    if (!linked && fs.existsSync(temporaryFile)) {
      try {
        fs.rmSync(temporaryFile, { force: true });
        fsyncDirectory(directory);
      } catch {
        // The current attempt's preparation file remains inert and cannot block retry.
      }
    }
  }
}

function claimOwnedLockFile(directory, expectedLockId, purpose) {
  const finalFile = metadataFile(directory);
  const before = readMetadataFile(finalFile);
  if (!before.passed || before.metadata?.lock_id !== expectedLockId) return { passed: false, reason: 'ownership_mismatch' };

  const claimedFile = claimFile(directory, purpose, expectedLockId);
  try {
    fs.renameSync(finalFile, claimedFile);
    fsyncDirectory(directory);
  } catch (error) {
    return { passed: false, reason: error?.code || 'claim_failed' };
  }

  const after = readMetadataFile(claimedFile);
  if (!after.passed || after.metadata?.lock_id !== expectedLockId) {
    try {
      if (!finalEntryExists(finalFile)) {
        fs.renameSync(claimedFile, finalFile);
        fsyncDirectory(directory);
      }
    } catch {
      // Fail closed and preserve both names when restoration races.
    }
    return { passed: false, reason: 'ownership_changed_during_claim', claimedFile };
  }
  return { passed: true, claimedFile, metadata: after.metadata };
}

function restoreClaimedLockFile(claimedFile, lockDirectory) {
  const finalFile = metadataFile(lockDirectory);
  if (!claimedFile || !fs.existsSync(claimedFile)) return false;
  try {
    if (finalEntryExists(finalFile)) return false;
    fs.renameSync(claimedFile, finalFile);
    fsyncDirectory(lockDirectory);
    return true;
  } catch {
    return false;
  }
}

function removeAssociatedPreparationFiles(directory, authorityFile, expectedLockId) {
  let authorityStat;
  try {
    authorityStat = fs.statSync(authorityFile);
  } catch {
    return [];
  }

  const removed = [];
  for (const name of fs.readdirSync(directory).sort()) {
    if (!name.startsWith(PREPARATION_PREFIX)) continue;
    const candidate = path.join(directory, name);
    try {
      const candidateLstat = fs.lstatSync(candidate);
      if (!candidateLstat.isFile() || candidateLstat.isSymbolicLink()) continue;
      const candidateStat = fs.statSync(candidate);
      if (candidateStat.dev !== authorityStat.dev || candidateStat.ino !== authorityStat.ino) continue;
      const read = readMetadataFile(candidate);
      if (!read.passed || read.metadata?.lock_id !== expectedLockId) continue;
      fs.rmSync(candidate, { force: true });
      removed.push(name);
    } catch {
      // Foreign or concurrently changed debris remains inert.
    }
  }
  if (removed.length) fsyncDirectory(directory);
  return removed;
}

function removeContainerIfEmpty(directory) {
  try {
    fs.rmdirSync(directory);
    fsyncDirectory(path.dirname(directory));
  } catch {
    // Non-empty or concurrently reused containers remain inert infrastructure.
  }
}

export function acquireRunLock(runDirectory, operation) {
  const run = resolveRoot(runDirectory);
  const lockDirectory = path.join(run, '.mutation-lock');
  const handle = acquireOwnedDirectory(lockDirectory, LOCK_SCHEMA, operation);
  if (!handle.passed) return handle;

  const hold = Number.parseInt(process.env.EV4_BUILDER_TEST_HOLD_LOCK_MS || '0', 10);
  if (hold > 0) sleepSync(hold);
  return handle;
}

export function releaseRunLock(handle) {
  if (!handle?.lockDirectory || typeof handle?.lock_id !== 'string') return { released: false, reason: 'invalid_handle' };
  const finalFile = metadataFile(handle.lockDirectory);
  try {
    if (!finalEntryExists(finalFile)) return { released: false, reason: 'lock_missing' };
  } catch {
    return { released: false, reason: 'lock_inspection_failed' };
  }

  const claim = claimOwnedLockFile(handle.lockDirectory, handle.lock_id, 'release');
  if (!claim.passed) return { released: false, reason: claim.reason };
  removeAssociatedPreparationFiles(handle.lockDirectory, claim.claimedFile, handle.lock_id);
  fs.rmSync(claim.claimedFile, { force: true });
  fsyncDirectory(handle.lockDirectory);
  removeContainerIfEmpty(handle.lockDirectory);
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
  if (!guard.passed) {
    if (guard.result?.diagnostics?.[0]?.code === 'RUN_BUSY_OR_STALE_LOCK') {
      return blocked('recover-run-lock', 'RUN-LOCK-RECOVERY-005', 'Another lock recovery attempt is already in progress.');
    }
    return guard.result;
  }

  let claimedFile = null;
  let recoveryLock = null;
  try {
    const finalFile = metadataFile(lockDirectory);
    let finalPresent;
    try {
      finalPresent = finalEntryExists(finalFile);
    } catch {
      return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-002', 'Run mutation lock metadata is malformed; recovery is blocked.')] };
    }
    if (!finalPresent) return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-001', 'No Run mutation lock exists.')] };
    const read = readMetadata(lockDirectory);
    if (!read.passed || !validLockMetadata(read.metadata)) return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-002', 'Run mutation lock metadata is malformed; recovery is blocked.')] };

    const initialLiveness = inspectRecordedOwnerLiveness(read.metadata);
    if (initialLiveness.state === 'live') return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-LIVE-OWNER', 'Recorded Run lock owner is still alive; recovery is blocked.', initialLiveness.detail)] };
    if (initialLiveness.state !== 'dead') return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-UNKNOWN-OWNER', 'Recorded Run lock owner liveness is unknown; recovery is blocked.', initialLiveness.detail)] };

    const claim = claimOwnedLockFile(lockDirectory, read.metadata.lock_id, 'recovering');
    if (!claim.passed) return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-006', 'Run mutation lock ownership changed during recovery; no lock was removed.', claim.reason)] };
    claimedFile = claim.claimedFile;

    recoveryLock = acquireOwnedDirectory(lockDirectory, LOCK_SCHEMA, 'recover-run-lock');
    if (!recoveryLock.passed) {
      if (recoveryLock.result?.diagnostics?.[0]?.code === 'RUN_BUSY_OR_STALE_LOCK') {
        return { passed: false, diagnostics: [diagnostic('RUN-LOCK-RECOVERY-006', 'A replacement writer acquired the Run mutation lock during recovery; no replacement lock was removed.')] };
      }
      return recoveryLock.result;
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

    const lockPreparationDebris = removeAssociatedPreparationFiles(lockDirectory, claimedFile, read.metadata.lock_id)
      .map((name) => `.mutation-lock/${name}`);
    fs.rmSync(claimedFile, { force: true });
    fsyncDirectory(lockDirectory);
    claimedFile = null;
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
        temporary_paths_removed: [...debris, ...lockPreparationDebris].sort(),
        orphan_generations_preserved: true,
        builder_build_complete: loaded.checkpoint.runtime_state === 'COMPLETED',
        responsive_complete: false,
        production_ready: false
      }
    };
  } finally {
    if (recoveryLock?.passed) releaseRunLock(recoveryLock);
    if (claimedFile && fs.existsSync(claimedFile)) restoreClaimedLockFile(claimedFile, lockDirectory);
    releaseRunLock(guard);
  }
}
