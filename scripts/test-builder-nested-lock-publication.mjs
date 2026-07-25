#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  emitRunBatch,
  recoverRunLock
} from './lib/runtime/canonical-run-runtime.mjs';
import {
  acquireRunLock,
  inspectRecordedOwnerLiveness,
  releaseRunLock
} from './lib/runtime/run-lock-ownership.mjs';
import {
  ROOT,
  activeRun,
  initializeManualRun,
  readJson
} from './lib/runtime/runtime-test-fixtures.mjs';

const CLI = path.join(ROOT, 'scripts', 'builder-inspector.mjs');
const LOCK_SOURCE = path.join(ROOT, 'scripts', 'lib', 'runtime', 'run-lock-ownership.mjs');
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-nested-lock-publication-'));
const failures = [];
let count = 0;

function test(id, title, fn) {
  count += 1;
  try {
    fn();
    console.log(`PASS ${id}: ${title}`);
  } catch (error) {
    failures.push(`FAIL ${id}: ${title}: ${error.message}`);
  }
}

function crashCli(args, point) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, EV4_BUILDER_CRASH_POINT: point }
  });
}

function lockDirectory(runDirectory) {
  return path.join(runDirectory, '.mutation-lock');
}

function lockFile(runDirectory) {
  return path.join(lockDirectory(runDirectory), 'lock.json');
}

function preparationNames(runDirectory) {
  const directory = lockDirectory(runDirectory);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter((name) => name.startsWith('.lock-preparation-')).sort();
}

function assertBusy(acquisition) {
  assert.equal(acquisition.passed, false);
  assert.equal(acquisition.result?.status, 'blocked');
  assert.equal(acquisition.result?.diagnostics?.[0]?.code, 'RUN_BUSY_OR_STALE_LOCK');
  assert.equal(acquisition.result?.state_modified, false);
}

function entrySnapshot(target) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) return { kind: 'symlink', target: fs.readlinkSync(target) };
  if (stat.isDirectory()) return { kind: 'directory', entries: fs.readdirSync(target).sort() };
  return { kind: 'file', bytes: fs.readFileSync(target).toString('base64') };
}

try {
  test('T-HARDLINK-CAPABILITY-PREFLIGHT', 'same-container hard-link publication is available and no-clobber', () => {
    const directory = fs.mkdtempSync(path.join(TEMP, 'hardlink-capability-'));
    const source = path.join(directory, 'source.tmp');
    const destination = path.join(directory, 'lock.json');
    fs.writeFileSync(source, 'complete-lock-metadata\n', { flag: 'wx' });
    fs.linkSync(source, destination);
    const before = fs.readFileSync(destination);
    assert.throws(() => fs.linkSync(source, destination), (error) => error?.code === 'EEXIST');
    assert.equal(fs.readFileSync(destination).equals(before), true);
  });

  test('T-LOCK-PUBLICATION-CRASH-MATRIX', 'final lock metadata is absent before link and complete after link', () => {
    for (const point of ['before_lock_temporary_write', 'after_lock_temporary_write', 'before_lock_final_link']) {
      const value = initializeManualRun(TEMP, `publication-crash-${point}`);
      const beforeCurrent = fs.readFileSync(path.join(value.runDirectory, 'CURRENT.json'));
      const crashed = crashCli(['emit-batch', value.runDirectory], point);
      assert.equal(crashed.status, 97, crashed.stderr || crashed.stdout);
      assert.equal(fs.existsSync(lockFile(value.runDirectory)), false);
      assert.equal(fs.readFileSync(path.join(value.runDirectory, 'CURRENT.json')).equals(beforeCurrent), true);
      if (point === 'before_lock_temporary_write') assert.deepEqual(preparationNames(value.runDirectory), []);
      else assert.equal(preparationNames(value.runDirectory).length >= 1, true);
      const retry = emitRunBatch({ runDirectory: value.runDirectory });
      assert.equal(retry.passed, true, JSON.stringify(retry.diagnostics));
      assert.equal(activeRun(value.runDirectory).current.generation, 2);
    }

    const value = initializeManualRun(TEMP, 'publication-crash-after-link');
    const beforeCurrent = fs.readFileSync(path.join(value.runDirectory, 'CURRENT.json'));
    const crashed = crashCli(['emit-batch', value.runDirectory], 'after_lock_final_link');
    assert.equal(crashed.status, 97, crashed.stderr || crashed.stdout);
    assert.equal(fs.readFileSync(path.join(value.runDirectory, 'CURRENT.json')).equals(beforeCurrent), true);
    const metadata = readJson(lockFile(value.runDirectory));
    assert.deepEqual(Object.keys(metadata).sort(), [
      'created_at',
      'lock_id',
      'operation',
      'process_id',
      'process_start_token',
      'schema'
    ]);
    assert.equal(inspectRecordedOwnerLiveness(metadata).state, 'dead');
    assert.equal(preparationNames(value.runDirectory).length, 1);
    const recovery = recoverRunLock({ runDirectory: value.runDirectory });
    assert.equal(recovery.passed, true, JSON.stringify(recovery.diagnostics));
    assert.equal(recovery.result.temporary_paths_removed.some((ref) => ref.startsWith('.mutation-lock/.lock-preparation-')), true);
    assert.equal(fs.existsSync(lockFile(value.runDirectory)), false);
    assert.deepEqual(preparationNames(value.runDirectory), []);
    const retry = emitRunBatch({ runDirectory: value.runDirectory });
    assert.equal(retry.passed, true, JSON.stringify(retry.diagnostics));
    assert.equal(activeRun(value.runDirectory).current.generation, 2);
  });

  test('T-LOCK-TARGET-NO-CLOBBER-MATRIX', 'every existing final target type is preserved without State loading', () => {
    const seed = initializeManualRun(TEMP, 'no-clobber-valid-seed');
    const seedHandle = acquireRunLock(seed.runDirectory, 'valid-seed');
    assert.equal(seedHandle.passed, true);
    const validBytes = fs.readFileSync(lockFile(seed.runDirectory));
    assert.equal(releaseRunLock(seedHandle).released, true);

    const cases = [
      {
        name: 'valid-file',
        setup(target) { fs.writeFileSync(target, validBytes, { flag: 'wx' }); }
      },
      {
        name: 'malformed-file',
        setup(target) { fs.writeFileSync(target, '{"schema":', { flag: 'wx' }); }
      },
      {
        name: 'empty-file',
        setup(target) { fs.writeFileSync(target, '', { flag: 'wx' }); }
      },
      {
        name: 'directory',
        setup(target) { fs.mkdirSync(target); }
      }
    ];

    const symlinkProbe = path.join(TEMP, 'symlink-probe');
    try {
      fs.writeFileSync(symlinkProbe, 'foreign-target');
      const probeLink = `${symlinkProbe}.link`;
      fs.symlinkSync(symlinkProbe, probeLink);
      fs.rmSync(probeLink, { force: true });
      cases.push({
        name: 'symlink',
        setup(target, runDirectory) {
          const foreign = path.join(runDirectory, 'foreign-lock-target');
          fs.writeFileSync(foreign, 'foreign-target');
          fs.symlinkSync(foreign, target);
        }
      });
    } catch {
      // Symlink case is conditional on platform support.
    }

    for (const fixture of cases) {
      const value = initializeManualRun(TEMP, `no-clobber-${fixture.name}`);
      const directory = lockDirectory(value.runDirectory);
      fs.mkdirSync(directory, { recursive: true });
      const target = lockFile(value.runDirectory);
      fixture.setup(target, value.runDirectory);
      const beforeTarget = entrySnapshot(target);
      const beforeCurrent = fs.readFileSync(path.join(value.runDirectory, 'CURRENT.json'));
      const acquisition = acquireRunLock(value.runDirectory, `no-clobber-${fixture.name}`);
      assertBusy(acquisition);
      assert.deepEqual(entrySnapshot(target), beforeTarget);
      assert.equal(fs.readFileSync(path.join(value.runDirectory, 'CURRENT.json')).equals(beforeCurrent), true);
    }
  });

  test('T-EMPTY-CONTAINER-IS-NOT-A-LOCK', 'empty container permits complete final lock publication', () => {
    const value = initializeManualRun(TEMP, 'empty-container');
    fs.mkdirSync(lockDirectory(value.runDirectory), { recursive: true });
    const handle = acquireRunLock(value.runDirectory, 'empty-container-acquisition');
    assert.equal(handle.passed, true);
    assert.equal(fs.lstatSync(lockFile(value.runDirectory)).isFile(), true);
    assert.equal(releaseRunLock(handle).released, true);
  });

  test('T-LEGACY-ACTIVE-LOCK-COMPATIBILITY', 'existing directory-plus-lock.json remains active authority', () => {
    const seed = initializeManualRun(TEMP, 'legacy-active-seed');
    const seedHandle = acquireRunLock(seed.runDirectory, 'legacy-active-seed');
    assert.equal(seedHandle.passed, true);
    const legacyBytes = fs.readFileSync(lockFile(seed.runDirectory));
    assert.equal(releaseRunLock(seedHandle).released, true);

    const value = initializeManualRun(TEMP, 'legacy-active-lock');
    fs.mkdirSync(lockDirectory(value.runDirectory), { recursive: true });
    fs.writeFileSync(lockFile(value.runDirectory), legacyBytes, { flag: 'wx' });
    const before = fs.readFileSync(lockFile(value.runDirectory));
    assertBusy(acquireRunLock(value.runDirectory, 'legacy-contender'));
    assert.equal(fs.readFileSync(lockFile(value.runDirectory)).equals(before), true);
    const recovery = recoverRunLock({ runDirectory: value.runDirectory });
    assert.equal(recovery.passed, false);
    assert.equal(recovery.diagnostics[0].code, 'RUN-LOCK-RECOVERY-LIVE-OWNER');
    assert.equal(fs.readFileSync(lockFile(value.runDirectory)).equals(before), true);
  });

  test('T-TEMP-DEBRIS-INERTNESS', 'foreign preparation and claim debris neither authorize nor block acquisition', () => {
    const value = initializeManualRun(TEMP, 'foreign-debris');
    const directory = lockDirectory(value.runDirectory);
    fs.mkdirSync(directory, { recursive: true });
    const preparation = path.join(directory, '.lock-preparation-foreign.json');
    const claim = path.join(directory, '.lock-claim-foreign.json');
    fs.writeFileSync(preparation, '{"foreign":true}\n');
    fs.writeFileSync(claim, 'foreign-claim\n');
    const preparationBefore = fs.readFileSync(preparation);
    const claimBefore = fs.readFileSync(claim);
    const handle = acquireRunLock(value.runDirectory, 'foreign-debris-acquisition');
    assert.equal(handle.passed, true);
    assert.equal(fs.readFileSync(preparation).equals(preparationBefore), true);
    assert.equal(fs.readFileSync(claim).equals(claimBefore), true);
    assert.equal(releaseRunLock(handle).released, true);
    assert.equal(fs.readFileSync(preparation).equals(preparationBefore), true);
    assert.equal(fs.readFileSync(claim).equals(claimBefore), true);
  });

  test('T-PUBLICATION-METHOD-CONFORMANCE', 'publication uses hard-link no-clobber with no alternate authority', () => {
    const source = fs.readFileSync(LOCK_SOURCE, 'utf8');
    assert.match(source, /fs\.linkSync\(temporaryFile, finalFile\)/);
    assert.doesNotMatch(source, /writeJson\(metadataFile\(/);
    assert.doesNotMatch(source, /writeFileSync\(metadataFile\(/);
    assert.doesNotMatch(source, /copyFileSync|symlinkSync/);
    assert.match(source, /function metadataFile\(directory\)[\s\S]*lock\.json/);
    assert.match(source, /RUN-LOCK-PUBLICATION-UNAVAILABLE/);

    const value = initializeManualRun(TEMP, 'invalid-container');
    fs.writeFileSync(lockDirectory(value.runDirectory), 'not-a-directory');
    const beforeCurrent = fs.readFileSync(path.join(value.runDirectory, 'CURRENT.json'));
    const acquisition = acquireRunLock(value.runDirectory, 'invalid-container');
    assert.equal(acquisition.passed, false);
    assert.equal(acquisition.result?.diagnostics?.[0]?.code, 'RUN-LOCK-PUBLICATION-UNAVAILABLE');
    assert.equal(fs.readFileSync(path.join(value.runDirectory, 'CURRENT.json')).equals(beforeCurrent), true);
  });
} finally {
  fs.rmSync(TEMP, { recursive: true, force: true });
}

if (failures.length) {
  console.error('Nested lock publication tests failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  console.error(`Passed ${count - failures.length}/${count} tests.`);
  process.exit(1);
}

console.log(`Nested lock publication tests passed: ${count}/${count}.`);
