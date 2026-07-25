#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import {
  recoverRunLock
} from './lib/runtime/canonical-run-runtime.mjs';
import {
  acquireRunLock,
  releaseRunLock
} from './lib/runtime/run-lock-ownership.mjs';
import {
  ROOT,
  initializeManualRun,
  readJson
} from './lib/runtime/runtime-test-fixtures.mjs';

const SELF = path.join(ROOT, 'scripts', 'test-builder-lock-restore-no-clobber.mjs');
const CLI = path.join(ROOT, 'scripts', 'builder-inspector.mjs');
const LOCK_SOURCE = path.join(ROOT, 'scripts', 'lib', 'runtime', 'run-lock-ownership.mjs');
const MODE = process.argv[2] || null;

function emitWorkerResult(result) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(result?.released === true || result?.passed === true ? 0 : 2);
}

if (MODE === '--release-worker') {
  const handle = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  emitWorkerResult(releaseRunLock(handle));
} else if (MODE === '--recovery-worker') {
  emitWorkerResult(recoverRunLock({ runDirectory: process.argv[3] }));
} else {
  await main();
}

async function main() {
  const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-lock-restore-no-clobber-'));
  const failures = [];
  let count = 0;

  async function test(id, title, fn) {
    count += 1;
    try {
      await fn();
      console.log(`PASS ${id}: ${title}`);
    } catch (error) {
      failures.push(`FAIL ${id}: ${title}: ${error.stack || error.message}`);
    }
  }

  function lockDirectory(runDirectory) {
    return path.join(runDirectory, '.mutation-lock');
  }

  function lockFile(runDirectory) {
    return path.join(lockDirectory(runDirectory), 'lock.json');
  }

  function claimFiles(runDirectory, purpose = null) {
    const directory = lockDirectory(runDirectory);
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory)
      .filter((name) => name.startsWith(purpose ? `.lock-claim-${purpose}-` : '.lock-claim-'))
      .map((name) => path.join(directory, name))
      .sort();
  }

  function writeHandle(directory, name, handle) {
    const file = path.join(directory, `${name}-handle.json`);
    fs.writeFileSync(file, `${JSON.stringify(handle, null, 2)}\n`, { flag: 'wx' });
    return file;
  }

  function writeContinue(syncDirectory, point) {
    fs.writeFileSync(path.join(syncDirectory, `${point}.continue`), 'continue\n', { flag: 'wx' });
  }

  async function waitForPath(target, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (fs.existsSync(target)) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for ${target}`);
  }

  function spawnWorker(args, env = {}) {
    const child = spawn(process.execPath, [SELF, ...args], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const done = new Promise((resolve) => {
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.on('close', (status) => {
        let output = null;
        try { output = JSON.parse(stdout); } catch { /* Preserve raw output. */ }
        resolve({ status, stdout, stderr, output });
      });
    });
    return { child, done };
  }

  function crashCli(args, point) {
    return spawnSync(process.execPath, [CLI, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: false,
      env: { ...process.env, EV4_BUILDER_CRASH_POINT: point }
    });
  }

  function entrySnapshot(target) {
    const lstat = fs.lstatSync(target);
    const snapshot = {
      dev: lstat.dev,
      ino: lstat.ino,
      mode: lstat.mode,
      kind: lstat.isSymbolicLink() ? 'symlink' : lstat.isDirectory() ? 'directory' : 'file'
    };
    if (snapshot.kind === 'file') snapshot.bytes = fs.readFileSync(target).toString('base64');
    else if (snapshot.kind === 'symlink') snapshot.target = fs.readlinkSync(target);
    else snapshot.entries = fs.readdirSync(target).sort();
    return snapshot;
  }

  try {
    await test('T-RESTORE-POSITIVE-CONTROL', 'claimed authority restores by hard link when final entry is absent', async () => {
      const value = initializeManualRun(TEMP, 'restore-positive');
      const handle = acquireRunLock(value.runDirectory, 'restore-positive-owner');
      assert.equal(handle.passed, true);
      const handleFile = writeHandle(TEMP, 'restore-positive', handle);
      const syncDirectory = fs.mkdtempSync(path.join(TEMP, 'restore-positive-sync-'));
      const point = 'after_claim_before_verify';
      const worker = spawnWorker(['--release-worker', handleFile], {
        EV4_BUILDER_TEST_RESTORE_SYNC_DIRECTORY: syncDirectory,
        EV4_BUILDER_TEST_RESTORE_SYNC_POINT: point
      });

      await waitForPath(path.join(syncDirectory, `${point}.ready.json`));
      const claimedFile = claimFiles(value.runDirectory, 'release')[0];
      assert.ok(claimedFile);
      assert.equal(fs.existsSync(lockFile(value.runDirectory)), false);
      const metadata = readJson(claimedFile);
      metadata.lock_id = `changed-${metadata.lock_id}`;
      fs.writeFileSync(claimedFile, `${JSON.stringify(metadata, null, 2)}\n`);
      const claimedStat = fs.statSync(claimedFile);
      const claimedBytes = fs.readFileSync(claimedFile);

      writeContinue(syncDirectory, point);
      const completed = await worker.done;
      assert.notEqual(completed.status, 0, completed.stderr || completed.stdout);
      assert.equal(completed.output?.released, false);
      assert.equal(completed.output?.reason, 'ownership_changed_during_claim');
      assert.equal(fs.existsSync(claimedFile), false);
      assert.equal(fs.existsSync(lockFile(value.runDirectory)), true);
      const finalStat = fs.statSync(lockFile(value.runDirectory));
      assert.equal(finalStat.dev, claimedStat.dev);
      assert.equal(finalStat.ino, claimedStat.ino);
      assert.equal(fs.readFileSync(lockFile(value.runDirectory)).equals(claimedBytes), true);
    });

    await test('T-RESTORE-REPLACEMENT-WINS', 'existing replacement authority wins without byte or inode change', async () => {
      const value = initializeManualRun(TEMP, 'restore-replacement-wins');
      const oldHandle = acquireRunLock(value.runDirectory, 'restore-old-owner');
      assert.equal(oldHandle.passed, true);
      const handleFile = writeHandle(TEMP, 'restore-replacement-wins', oldHandle);
      const syncDirectory = fs.mkdtempSync(path.join(TEMP, 'restore-replacement-sync-'));
      const point = 'before_post_claim_restore';
      const worker = spawnWorker(['--release-worker', handleFile], {
        EV4_BUILDER_TEST_FORCE_POST_CLAIM_INVALID: '1',
        EV4_BUILDER_TEST_RESTORE_SYNC_DIRECTORY: syncDirectory,
        EV4_BUILDER_TEST_RESTORE_SYNC_POINT: point
      });

      await waitForPath(path.join(syncDirectory, `${point}.ready.json`));
      const oldClaim = claimFiles(value.runDirectory, 'release')[0];
      assert.ok(oldClaim);
      assert.equal(fs.existsSync(lockFile(value.runDirectory)), false);
      const replacement = acquireRunLock(value.runDirectory, 'restore-replacement-owner');
      assert.equal(replacement.passed, true);
      const replacementBefore = entrySnapshot(lockFile(value.runDirectory));

      writeContinue(syncDirectory, point);
      const completed = await worker.done;
      assert.notEqual(completed.status, 0, completed.stderr || completed.stdout);
      assert.equal(completed.output?.released, false);
      assert.equal(completed.output?.reason, 'ownership_changed_during_claim');
      assert.deepEqual(entrySnapshot(lockFile(value.runDirectory)), replacementBefore);
      assert.equal(readJson(lockFile(value.runDirectory)).lock_id, replacement.lock_id);
      assert.equal(fs.existsSync(oldClaim), true);
      assert.equal(releaseRunLock(replacement).released, true);
      assert.equal(fs.existsSync(oldClaim), true);
    });

    await test('T-POST-CLAIM-VERIFY-RACE', 'post-claim verification failure cannot clobber a new writer', async () => {
      const value = initializeManualRun(TEMP, 'post-claim-verify-race');
      const oldHandle = acquireRunLock(value.runDirectory, 'post-claim-old-owner');
      assert.equal(oldHandle.passed, true);
      const handleFile = writeHandle(TEMP, 'post-claim-verify-race', oldHandle);
      const syncDirectory = fs.mkdtempSync(path.join(TEMP, 'post-claim-sync-'));
      const point = 'after_claim_before_verify';
      const worker = spawnWorker(['--release-worker', handleFile], {
        EV4_BUILDER_TEST_RESTORE_SYNC_DIRECTORY: syncDirectory,
        EV4_BUILDER_TEST_RESTORE_SYNC_POINT: point
      });

      await waitForPath(path.join(syncDirectory, `${point}.ready.json`));
      const oldClaim = claimFiles(value.runDirectory, 'release')[0];
      assert.ok(oldClaim);
      const changed = readJson(oldClaim);
      changed.lock_id = `foreign-${changed.lock_id}`;
      fs.writeFileSync(oldClaim, `${JSON.stringify(changed, null, 2)}\n`);
      const replacement = acquireRunLock(value.runDirectory, 'post-claim-replacement-owner');
      assert.equal(replacement.passed, true);
      const replacementBefore = entrySnapshot(lockFile(value.runDirectory));

      writeContinue(syncDirectory, point);
      const completed = await worker.done;
      assert.notEqual(completed.status, 0, completed.stderr || completed.stdout);
      assert.equal(completed.output?.reason, 'ownership_changed_during_claim');
      assert.deepEqual(entrySnapshot(lockFile(value.runDirectory)), replacementBefore);
      assert.equal(readJson(lockFile(value.runDirectory)).lock_id, replacement.lock_id);
      assert.equal(fs.existsSync(oldClaim), true);
      assert.equal(releaseRunLock(replacement).released, true);
    });

    await test('T-RECOVERY-FINALLY-RESTORE-RACE', 'recovery cleanup preserves a replacement writer and primary diagnostic', async () => {
      const value = initializeManualRun(TEMP, 'recovery-finally-restore-race');
      const crashed = crashCli(['emit-batch', value.runDirectory], 'after_lock_acquisition');
      assert.equal(crashed.status, 97, crashed.stderr || crashed.stdout);
      fs.writeFileSync(path.join(value.runDirectory, 'CURRENT.json'), '{"broken":true}\n');

      const syncDirectory = fs.mkdtempSync(path.join(TEMP, 'recovery-finally-sync-'));
      const point = 'before_recovery_finally_restore';
      const worker = spawnWorker(['--recovery-worker', value.runDirectory], {
        EV4_BUILDER_TEST_RESTORE_SYNC_DIRECTORY: syncDirectory,
        EV4_BUILDER_TEST_RESTORE_SYNC_POINT: point
      });

      await waitForPath(path.join(syncDirectory, `${point}.ready.json`));
      const oldClaim = claimFiles(value.runDirectory, 'recovering')[0];
      assert.ok(oldClaim);
      assert.equal(fs.existsSync(lockFile(value.runDirectory)), false);
      const replacement = acquireRunLock(value.runDirectory, 'recovery-finally-replacement-owner');
      assert.equal(replacement.passed, true);
      const replacementBefore = entrySnapshot(lockFile(value.runDirectory));

      writeContinue(syncDirectory, point);
      const completed = await worker.done;
      assert.notEqual(completed.status, 0, completed.stderr || completed.stdout);
      assert.equal(completed.output?.passed, false);
      assert.equal(completed.output?.diagnostics?.[0]?.code, 'RUN-LOCK-RECOVERY-003');
      assert.deepEqual(entrySnapshot(lockFile(value.runDirectory)), replacementBefore);
      assert.equal(readJson(lockFile(value.runDirectory)).lock_id, replacement.lock_id);
      assert.equal(fs.existsSync(oldClaim), true);
      assert.equal(releaseRunLock(replacement).released, true);
    });

    await test('T-RESTORE-METHOD-CONFORMANCE', 'all claimed-lock restoration uses the common hard-link no-clobber helper', () => {
      const source = fs.readFileSync(LOCK_SOURCE, 'utf8');
      const restoreStart = source.indexOf('function restoreClaimedLockFile(');
      const restoreEnd = source.indexOf('function claimOwnedLockFile(', restoreStart);
      assert.notEqual(restoreStart, -1);
      assert.notEqual(restoreEnd, -1);
      const restoreSource = source.slice(restoreStart, restoreEnd);
      assert.match(restoreSource, /fs\.linkSync\(claimedFile, finalFile\)/);
      assert.doesNotMatch(restoreSource, /finalEntryExists\(finalFile\)/);
      assert.doesNotMatch(restoreSource, /renameSync/);
      assert.doesNotMatch(source, /fs\.renameSync\(claimedFile,\s*finalFile\)/);
      assert.match(source, /fs\.linkSync\(temporaryFile, finalFile\)/);
      assert.equal((source.match(/restoreClaimedLockFile\(/g) || []).length, 4);
      assert.doesNotMatch(source, /copyFileSync|symlinkSync/);
    });
  } finally {
    fs.rmSync(TEMP, { recursive: true, force: true });
  }

  if (failures.length) {
    console.error('Claimed lock restore no-clobber tests failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    console.error(`Passed ${count - failures.length}/${count} tests.`);
    process.exit(1);
  }

  console.log(`Claimed lock restore no-clobber tests passed: ${count}/${count}.`);
}
