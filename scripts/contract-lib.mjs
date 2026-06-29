import fs from 'node:fs';
import path from 'node:path';

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

export function finish(name, filePath, errors) {
  if (errors.length) {
    console.error(`${name} validation failed for ${filePath}:`);
    for (const e of errors) console.error(`- ${e.id}: ${e.message}`);
    process.exit(1);
  }
  console.log(`${name} validation passed: ${filePath}`);
}

export function hasEvidence(item, allowed = []) {
  const evidence = item.evidence || item.evidence_sources || item.evidence_refs || [];
  return Array.isArray(evidence) && evidence.some((e) => allowed.length === 0 || allowed.includes(typeof e === 'string' ? e : e?.type));
}

export function textIncludesAny(text, terms) {
  const value = String(text || '').toLowerCase();
  return terms.some((term) => value.includes(term.toLowerCase()));
}
