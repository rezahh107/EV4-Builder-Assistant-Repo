#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { emitRunBatch } from './lib/runtime/canonical-run-runtime.mjs';
import {
  activeRun,
  initializeManualRun,
  readJson
} from './lib/runtime/runtime-test-fixtures.mjs';

function writeOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value).replace(/[\r\n]+/g, ' ')}\n`);
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ev4-debug-aux-conflict-'));
try {
  const value = initializeManualRun(temp, 'aux-conflict-debug');
  const injected = emitRunBatch({
    runDirectory: value.runDirectory,
    failureInjection: 'after_successor_temp_write'
  });

  const transitionRoot = path.join(value.runDirectory, 'transitions', 'emit-batch');
  const transitionDirectories = fs.existsSync(transitionRoot)
    ? fs.readdirSync(transitionRoot).filter((name) => fs.statSync(path.join(transitionRoot, name)).isDirectory())
    : [];
  const resultFile = transitionDirectories.length === 1
    ? path.join(transitionRoot, transitionDirectories[0], 'emit-batch-result.json')
    : null;
  const resultFileExistsBeforeMutation = Boolean(resultFile && fs.existsSync(resultFile));

  if (resultFileExistsBeforeMutation) {
    const result = readJson(resultFile);
    result.status = 'blocked';
    fs.writeFileSync(resultFile, `${JSON.stringify(result, null, 2)}\n`);
  }

  const retry = emitRunBatch({ runDirectory: value.runDirectory });
  const active = activeRun(value.runDirectory);
  const codes = (retry.diagnostics || []).map((entry) => entry.code).join(',') || 'none';

  writeOutput('injected_passed', injected.passed);
  writeOutput('injected_stage', injected.failure_stage || 'none');
  writeOutput('transition_count', transitionDirectories.length);
  writeOutput('result_exists', resultFileExistsBeforeMutation);
  writeOutput('retry_passed', retry.passed);
  writeOutput('retry_codes', codes);
  writeOutput('retry_expected_code', retry.expected_diagnostic_code || 'none');
  writeOutput('retry_state_modified', retry.state_modified);
  writeOutput('active_generation', active.current.generation);

  console.log(JSON.stringify({
    injected_passed: injected.passed,
    injected_stage: injected.failure_stage || null,
    transition_count: transitionDirectories.length,
    result_exists: resultFileExistsBeforeMutation,
    retry_passed: retry.passed,
    retry_codes: codes,
    retry_expected_code: retry.expected_diagnostic_code || null,
    retry_state_modified: retry.state_modified,
    active_generation: active.current.generation
  }, null, 2));
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
