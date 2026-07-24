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

  if (resultFile && fs.existsSync(resultFile)) {
    const result = readJson(resultFile);
    result.status = 'blocked';
    fs.writeFileSync(resultFile, `${JSON.stringify(result, null, 2)}\n`);
  }

  const retry = emitRunBatch({ runDirectory: value.runDirectory });
  const active = activeRun(value.runDirectory);

  console.log(JSON.stringify({
    injected: {
      passed: injected.passed,
      failure_stage: injected.failure_stage,
      diagnostics: injected.diagnostics
    },
    transition_directories: transitionDirectories,
    result_file: resultFile,
    result_file_exists: Boolean(resultFile && fs.existsSync(resultFile)),
    retry: {
      passed: retry.passed,
      state_modified: retry.state_modified,
      diagnostics: retry.diagnostics,
      expected_diagnostic_code: retry.expected_diagnostic_code,
      active_generation_after_failure: retry.active_generation_after_failure
    },
    active_generation: active.current.generation
  }, null, 2));

  process.exit(1);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
