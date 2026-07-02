import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CE_BUILDER_TRANSFORMATION_REGISTRY_PATH = path.resolve(
  __dirname,
  '..',
  'data',
  'ce-builder-transformation-registry.v1.json'
);

let cachedRegistry = null;
let cachedMappingsById = null;

export function readCeBuilderTransformationRegistry() {
  if (!cachedRegistry) {
    cachedRegistry = JSON.parse(fs.readFileSync(CE_BUILDER_TRANSFORMATION_REGISTRY_PATH, 'utf8'));
  }
  return cachedRegistry;
}

export function ceBuilderTransformationMappingsById() {
  if (!cachedMappingsById) {
    const registry = readCeBuilderTransformationRegistry();
    cachedMappingsById = new Map((registry.mappings || []).map((mapping) => [mapping.id, mapping]));
  }
  return cachedMappingsById;
}

export function assertDeclaredTransform(mappingId, implementedBy) {
  const mapping = ceBuilderTransformationMappingsById().get(mappingId);
  if (!mapping) throw new Error(`Undeclared CE→Builder transform mapping: ${mappingId}`);
  if (implementedBy && mapping.implemented_by !== implementedBy) {
    throw new Error(`Transform ${mappingId} is declared for ${mapping.implemented_by}, not ${implementedBy}.`);
  }
  if (!mapping.loss_policy || mapping.loss_policy === 'implicit') {
    throw new Error(`Transform ${mappingId} does not declare an explicit loss_policy.`);
  }
  if (typeof mapping.data_loss !== 'string' || mapping.data_loss.trim().length === 0) {
    throw new Error(`Transform ${mappingId} does not declare data_loss behavior.`);
  }
  return mapping;
}

export function assertAllTransformsDeclared(mappingIds, implementedBy) {
  for (const mappingId of mappingIds) assertDeclaredTransform(mappingId, implementedBy);
}
