#!/usr/bin/env node
import fs from 'node:fs';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function requireMatch(label, content, pattern) {
  const match = content.match(pattern);
  if (!match) throw new Error(`Could not read ${label}.`);
  return match[1];
}

const packageVersion = JSON.parse(read('package.json')).version;

const observed = {
  'package.json': packageVersion,
  'PROJECT_INSTRUCTIONS.md': requireMatch('PROJECT_INSTRUCTIONS.md Version', read('PROJECT_INSTRUCTIONS.md'), /^Version:\s*([0-9]+\.[0-9]+\.[0-9]+)$/m),
  'core/MASTER_PROMPT.md': requireMatch('core/MASTER_PROMPT.md Version', read('core/MASTER_PROMPT.md'), /^Version:\s*([0-9]+\.[0-9]+\.[0-9]+)$/m),
  'docs/REPOSITORY_GUIDE.md': requireMatch('docs/REPOSITORY_GUIDE.md Version', read('docs/REPOSITORY_GUIDE.md'), /^Version:\s*([0-9]+\.[0-9]+\.[0-9]+)$/m),
  'STATUS.md': requireMatch('STATUS.md Version', read('STATUS.md'), /^Version:\s*([0-9]+\.[0-9]+\.[0-9]+)$/m),
  'README.md Current Status': requireMatch('README.md Current Status version', read('README.md'), /^\s*version:\s*([0-9]+\.[0-9]+\.[0-9]+)$/m),
  'CHANGELOG.md latest': requireMatch('CHANGELOG.md latest version', read('CHANGELOG.md'), /^## v([0-9]+\.[0-9]+\.[0-9]+)\s/m)
};

const mismatches = Object.entries(observed).filter(([, version]) => version !== packageVersion);

if (mismatches.length > 0) {
  console.error('Version consistency validation failed:');
  for (const [source, version] of Object.entries(observed)) {
    console.error(`- ${source}: ${version}`);
  }
  process.exit(1);
}

console.log(`Version consistency validation passed: ${packageVersion}`);
