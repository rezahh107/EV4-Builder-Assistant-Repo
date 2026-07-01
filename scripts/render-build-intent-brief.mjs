#!/usr/bin/env node
import crypto from 'node:crypto';
import { readJson } from './contract-lib.mjs';

export const ALLOWED_TOKENS = ['primary_anchor_label','left_region_label','right_region_label','connector_behavior','repeated_unit_label','phase_label'];
export function hashText(text){return 'sha256:' + crypto.createHash('sha256').update(text,'utf8').digest('hex');}
export function renderTemplate(template, tokens, outputMaxChars){
  const seen = [...template.matchAll(/\{([^}]+)\}/g)].map((m)=>m[1]);
  for (const token of seen) if (!ALLOWED_TOKENS.includes(token)) throw new Error(`unknown token: ${token}`);
  for (const token of seen) if (!(token in tokens)) throw new Error(`missing token: ${token}`);
  for (const token of Object.keys(tokens)) if (!ALLOWED_TOKENS.includes(token)) throw new Error(`unknown provided token: ${token}`);
  const rendered = template.replace(/\{([^}]+)\}/g, (_, token)=>String(tokens[token]));
  if (rendered.length > outputMaxChars) throw new Error(`rendered output exceeds ${outputMaxChars} chars`);
  return { rendered_text: rendered, rendered_brief_hash: hashText(rendered) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [registryFile, briefFile] = process.argv.slice(2);
  if(!registryFile || !briefFile){console.error('Usage: node scripts/render-build-intent-brief.mjs <template-registry> <brief>');process.exit(2)}
  const registry = readJson(registryFile);
  const brief = readJson(briefFile)?.build_intent_brief;
  if(!registry || !Array.isArray(registry.templates) || !brief){console.error('Invalid registry or brief format');process.exit(1)}
  const template = registry.templates.find((t)=>t.template_id===brief.template_id && t.template_version===brief.template_version_used);
  if(!template){console.error('Template not found');process.exit(1)}
  console.log(JSON.stringify(renderTemplate(template.template, brief.tokens, template.output_max_chars), null, 2));
}
