import crypto from 'node:crypto';

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

export function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function computePackageDigest(value) {
  return sha256Text(sortedCanonicalJson(packageWithoutDigest(value)));
}

export function computeCanonicalDigest(value) {
  return sha256Text(sortedCanonicalJson(value));
}
