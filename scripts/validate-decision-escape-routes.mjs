#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SCHEMA_PATH = 'planning/decision-escape-routes.schema.json';
const DEFAULT_STATE_PATH = 'planning/DECISION_ESCAPE_ROUTES.yml';

const [schemaPath = DEFAULT_SCHEMA_PATH, statePath = DEFAULT_STATE_PATH] = process.argv.slice(2);

function readText(filePath) {
  return fs.readFileSync(path.resolve(filePath), 'utf8');
}

function parseScalar(raw) {
  const value = raw.trim();
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
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

function splitKeyValue(text, lineNumber) {
  const separator = text.indexOf(':');
  if (separator === -1) throw new Error(`Line ${lineNumber}: expected key/value pair.`);
  const key = text.slice(0, separator).trim();
  const value = text.slice(separator + 1).trim();
  if (!key) throw new Error(`Line ${lineNumber}: empty key is not allowed.`);
  return [key, value];
}

function parseYamlSubset(yamlText) {
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

      if (rest.includes(':')) {
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

function resolveRef(schema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Only local JSON Schema refs are supported: ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .reduce((node, key) => node?.[key], schema);
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

function validateNode(rootSchema, nodeSchema, value, location, errors) {
  if (nodeSchema === false) {
    errors.push(`${location}: property is explicitly forbidden by schema.`);
    return;
  }

  if (nodeSchema?.$ref) nodeSchema = resolveRef(rootSchema, nodeSchema.$ref);
  if (!nodeSchema || typeof nodeSchema !== 'object') return;

  if (nodeSchema.allOf) {
    for (const nestedSchema of nodeSchema.allOf) validateNode(rootSchema, nestedSchema, value, location, errors);
  }

  if (nodeSchema.not?.anyOf) {
    for (const forbidden of nodeSchema.not.anyOf) {
      if (forbidden.required?.every((key) => Object.prototype.hasOwnProperty.call(value ?? {}, key))) {
        errors.push(`${location}: must not include forbidden required set ${forbidden.required.join(', ')}.`);
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(nodeSchema, 'const') && value !== nodeSchema.const) {
    errors.push(`${location}: expected const ${JSON.stringify(nodeSchema.const)}, received ${JSON.stringify(value)}.`);
  }

  if (nodeSchema.enum && !nodeSchema.enum.includes(value)) {
    errors.push(`${location}: expected one of ${JSON.stringify(nodeSchema.enum)}, received ${JSON.stringify(value)}.`);
  }

  if (nodeSchema.type) {
    const expectedTypes = Array.isArray(nodeSchema.type) ? nodeSchema.type : [nodeSchema.type];
    if (!expectedTypes.some((expected) => matchesType(value, expected))) {
      errors.push(`${location}: expected type ${expectedTypes.join('|')}, received ${typeOf(value)}.`);
      return;
    }
  }

  if (typeof value === 'string') {
    if (nodeSchema.minLength !== undefined && value.length < nodeSchema.minLength) {
      errors.push(`${location}: string is shorter than minLength ${nodeSchema.minLength}.`);
    }
    if (nodeSchema.pattern && !(new RegExp(nodeSchema.pattern).test(value))) {
      errors.push(`${location}: string does not match pattern ${nodeSchema.pattern}.`);
    }
  }

  if (typeof value === 'number' && nodeSchema.minimum !== undefined && value < nodeSchema.minimum) {
    errors.push(`${location}: value is below minimum ${nodeSchema.minimum}.`);
  }

  if (Array.isArray(value)) {
    if (nodeSchema.minItems !== undefined && value.length < nodeSchema.minItems) {
      errors.push(`${location}: array has fewer than minItems ${nodeSchema.minItems}.`);
    }
    if (nodeSchema.uniqueItems) {
      const seen = new Set(value.map((item) => JSON.stringify(item)));
      if (seen.size !== value.length) errors.push(`${location}: array items must be unique.`);
    }
    if (nodeSchema.contains) {
      const matched = value.some((item, index) => {
        const nestedErrors = [];
        validateNode(rootSchema, nodeSchema.contains, item, `${location}[${index}]`, nestedErrors);
        return nestedErrors.length === 0;
      });
      if (!matched) errors.push(`${location}: array does not contain required schema match.`);
    }
    if (nodeSchema.items) {
      value.forEach((item, index) => validateNode(rootSchema, nodeSchema.items, item, `${location}[${index}]`, errors));
    }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of nodeSchema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${location}.${key}: required property is missing.`);
    }

    const allowedProperties = nodeSchema.properties || {};
    if (nodeSchema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(allowedProperties, key)) {
          errors.push(`${location}.${key}: additional property is not allowed.`);
        }
      }
    }

    for (const [key, nestedSchema] of Object.entries(allowedProperties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        validateNode(rootSchema, nestedSchema, value[key], `${location}.${key}`, errors);
      }
    }
  }
}

const schema = JSON.parse(readText(schemaPath));
const state = parseYamlSubset(readText(statePath));
const errors = [];
validateNode(schema, schema, state, '$', errors);

if (errors.length > 0) {
  console.error(`Decision escape routes validation failed for ${statePath}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Decision escape routes validation passed: ${statePath}`);
