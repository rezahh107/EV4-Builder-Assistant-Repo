import crypto from 'node:crypto';

export const BUILDER_CONTEXT_SCHEMA_ID = 'ev4-builder-context-package@1.0.0';
export const BUILDER_INSPECTOR_ID = 'builder-inspector@1.0.0';

export function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function sortedCanonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(sortedCanonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${sortedCanonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function packageWithoutDigest(value) {
  const cloned = JSON.parse(JSON.stringify(value));
  if (cloned.input_authorization?.package_digest) delete cloned.input_authorization.package_digest;
  return cloned;
}

export function computePackageDigest(value) {
  return sha256Bytes(Buffer.from(sortedCanonicalJson(packageWithoutDigest(value)), 'utf8'));
}
