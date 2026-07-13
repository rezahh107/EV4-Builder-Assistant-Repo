#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

export function readText(filePath) {
  return fs.readFileSync(path.resolve(filePath), 'utf8');
}

export function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\[\s*\]$/.test(value)) return [];
  if (/^\{\s*\}$/.test(value)) return {};
  if (/^-?\d+$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.startsWith('"') ? JSON.parse(value) : value.slice(1, -1);
  }
  return value;
}

function toLogicalLines(yamlText) {
  return yamlText
    .split(/\r?\n/)
    .map((raw, lineNumber) => ({
      raw,
      lineNumber: lineNumber + 1,
      indent: raw.match(/^ */)[0].length,
      text: raw.trim()
    }))
    .filter((line) => line.text.length > 0 && !line.text.startsWith('#'));
}

function findMappingSeparator(text) {
  const match = /:(?=\s|$)/.exec(text);
  return match ? match.index : -1;
}

function splitKeyValue(text, lineNumber) {
  const separator = findMappingSeparator(text);
  if (separator === -1) throw new Error(`Line ${lineNumber}: expected key/value pair.`);
  const key = text.slice(0, separator).trim();
  const value = text.slice(separator + 1).trim();
  if (!key) throw new Error(`Line ${lineNumber}: empty key is not allowed.`);
  return [key, value];
}

export function parseYamlSubset(yamlText) {
  const lines = toLogicalLines(yamlText);

  function parseBlock(index, indent) {
    if (index >= lines.length || lines[index].indent < indent) return [null, index];
    if (lines[index].indent !== indent) {
      throw new Error(`Line ${lines[index].lineNumber}: expected indentation ${indent}, got ${lines[index].indent}.`);
    }
    return lines[index].text.startsWith('- ') ? parseArray(index, indent) : parseMap(index, indent);
  }

  function parseArray(index, indent) {
    const result = [];
    while (index < lines.length && lines[index].indent === indent && lines[index].text.startsWith('- ')) {
      const line = lines[index];
      const rest = line.text.slice(2).trim();

      if (rest === '') {
        const parsed = parseBlock(index + 1, indent + 2);
        result.push(parsed[0]);
        index = parsed[1];
        continue;
      }

      if (findMappingSeparator(rest) !== -1) {
        const [key, rawValue] = splitKeyValue(rest, line.lineNumber);
        const item = {};
        index += 1;

        if (rawValue === '') {
          const parsed = parseBlock(index, indent + 4);
          item[key] = parsed[0];
          index = parsed[1];
        } else {
          item[key] = parseScalar(rawValue);
        }

        if (index < lines.length && lines[index].indent === indent + 2 && !lines[index].text.startsWith('- ')) {
          const parsed = parseMap(index, indent + 2);
          Object.assign(item, parsed[0]);
          index = parsed[1];
        }

        result.push(item);
        continue;
      }

      result.push(parseScalar(rest));
      index += 1;
    }
    return [result, index];
  }

  function parseMap(index, indent) {
    const result = {};
    while (index < lines.length && lines[index].indent === indent && !lines[index].text.startsWith('- ')) {
      const line = lines[index];
      const [key, rawValue] = splitKeyValue(line.text, line.lineNumber);
      index += 1;

      if (rawValue === '') {
        if (index < lines.length && lines[index].indent > indent) {
          const parsed = parseBlock(index, lines[index].indent);
          result[key] = parsed[0];
          index = parsed[1];
        } else {
          result[key] = null;
        }
      } else {
        result[key] = parseScalar(rawValue);
      }
    }
    return [result, index];
  }

  const [document, nextIndex] = parseBlock(0, 0);
  if (nextIndex !== lines.length) {
    throw new Error(`Line ${lines[nextIndex].lineNumber}: could not parse trailing YAML content.`);
  }
  return document;
}

export function readYaml(filePath) {
  return parseYamlSubset(readText(filePath));
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function matchesType(value, expected) {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  return actual === expected;
}

export function validateSchema(rootSchema, value, location = '$') {
  const errors = [];

  function validateNode(nodeSchema, nodeValue, nodeLocation) {
    if (nodeSchema === false) {
      errors.push(`${nodeLocation}: property is explicitly forbidden by schema.`);
      return;
    }
    if (!nodeSchema || typeof nodeSchema !== 'object') return;

    if (Object.prototype.hasOwnProperty.call(nodeSchema, 'const') && nodeValue !== nodeSchema.const) {
      errors.push(`${nodeLocation}: expected const ${JSON.stringify(nodeSchema.const)}, received ${JSON.stringify(nodeValue)}.`);
    }
    if (nodeSchema.enum && !nodeSchema.enum.includes(nodeValue)) {
      errors.push(`${nodeLocation}: expected one of ${JSON.stringify(nodeSchema.enum)}, received ${JSON.stringify(nodeValue)}.`);
    }
    if (nodeSchema.type) {
      const expectedTypes = Array.isArray(nodeSchema.type) ? nodeSchema.type : [nodeSchema.type];
      if (!expectedTypes.some((expected) => matchesType(nodeValue, expected))) {
        errors.push(`${nodeLocation}: expected type ${expectedTypes.join('|')}, received ${typeOf(nodeValue)}.`);
        return;
      }
    }
    if (typeof nodeValue === 'string') {
      if (nodeSchema.minLength !== undefined && nodeValue.length < nodeSchema.minLength) {
        errors.push(`${nodeLocation}: string is shorter than minLength ${nodeSchema.minLength}.`);
      }
      if (nodeSchema.pattern && !(new RegExp(nodeSchema.pattern).test(nodeValue))) {
        errors.push(`${nodeLocation}: string does not match pattern ${nodeSchema.pattern}.`);
      }
    }
    if (typeof nodeValue === 'number' && nodeSchema.minimum !== undefined && nodeValue < nodeSchema.minimum) {
      errors.push(`${nodeLocation}: value is below minimum ${nodeSchema.minimum}.`);
    }
    if (Array.isArray(nodeValue)) {
      if (nodeSchema.minItems !== undefined && nodeValue.length < nodeSchema.minItems) {
        errors.push(`${nodeLocation}: array has fewer than minItems ${nodeSchema.minItems}.`);
      }
      if (nodeSchema.uniqueItems) {
        const seen = new Set(nodeValue.map((item) => JSON.stringify(item)));
        if (seen.size !== nodeValue.length) errors.push(`${nodeLocation}: array items must be unique.`);
      }
      if (nodeSchema.items) {
        nodeValue.forEach((item, index) => validateNode(nodeSchema.items, item, `${nodeLocation}[${index}]`));
      }
    }
    if (nodeValue && typeof nodeValue === 'object' && !Array.isArray(nodeValue)) {
      for (const key of nodeSchema.required || []) {
        if (!Object.prototype.hasOwnProperty.call(nodeValue, key)) {
          errors.push(`${nodeLocation}.${key}: required property is missing.`);
        }
      }
      const properties = nodeSchema.properties || {};
      if (nodeSchema.additionalProperties === false) {
        for (const key of Object.keys(nodeValue)) {
          if (!Object.prototype.hasOwnProperty.call(properties, key)) {
            errors.push(`${nodeLocation}.${key}: additional property is not allowed.`);
          }
        }
      }
      for (const [key, nestedSchema] of Object.entries(properties)) {
        if (Object.prototype.hasOwnProperty.call(nodeValue, key)) {
          validateNode(nestedSchema, nodeValue[key], `${nodeLocation}.${key}`);
        }
      }
    }
  }

  validateNode(rootSchema, value, location);
  return errors;
}

export function unique(values) {
  return [...new Set(values)];
}

export function setEquals(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every((item) => b.has(item));
}

export function setDifference(left, right) {
  const rightSet = new Set(right);
  return unique(left).filter((item) => !rightSet.has(item)).sort();
}

export function findForbiddenKeys(value, forbiddenKeys, location = '$', findings = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenKeys(item, forbiddenKeys, `${location}[${index}]`, findings));
    return findings;
  }
  if (!value || typeof value !== 'object') return findings;
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenKeys.includes(key)) findings.push(`${location}.${key}`);
    findForbiddenKeys(nested, forbiddenKeys, `${location}.${key}`, findings);
  }
  return findings;
}

export function printFailure(title, errors) {
  console.error(title);
  for (const error of errors) console.error(`- ${error}`);
}
