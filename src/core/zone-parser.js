'use strict';

const fs = require('fs/promises');
const { normalizeRecordType } = require('./record-types');

const KNOWN_CLASSES = new Set(['IN', 'CH', 'HS']);
const TYPE_FIELDS = {
  AFSDB: ['subtype', 'hostname'],
  MX: ['preference', 'exchange'],
  SRV: ['priority', 'weight', 'port', 'target'],
};

function stripComment(line) {
  let inQuote = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (char === ';' && !inQuote) return line.slice(0, index);
  }
  return line;
}

function parenDelta(line) {
  let inQuote = false;
  let escaped = false;
  let delta = 0;
  for (const char of line) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && char === '(') delta += 1;
    if (!inQuote && char === ')') delta -= 1;
  }
  return delta;
}

function tokenize(text) {
  const tokens = [];
  let token = '';
  let inQuote = false;
  let escaped = false;
  for (const char of text) {
    if (inQuote) {
      token += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') {
        tokens.push(token);
        token = '';
        inQuote = false;
      }
      continue;
    }
    if (/\s/.test(char)) {
      if (token) {
        tokens.push(token);
        token = '';
      }
      continue;
    }
    if (char === '(' || char === ')') {
      if (token) {
        tokens.push(token);
        token = '';
      }
      tokens.push(char);
      continue;
    }
    if (char === '"') {
      if (token) {
        tokens.push(token);
        token = '';
      }
      token = char;
      inQuote = true;
      continue;
    }
    token += char;
  }
  if (token) tokens.push(token);
  return tokens;
}

function logicalRecords(text) {
  const output = [];
  const header = [];
  let current = [];
  let currentLine = 0;
  let depth = 0;
  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const stripped = rawLine.trim();
    if (!stripped) return;
    if (stripped === 'Raw AXFR output' || stripped.startsWith(';')) {
      header.push(rawLine);
      return;
    }
    const clean = stripComment(rawLine).trim();
    if (!clean) return;
    if (!current.length) currentLine = lineNumber;
    current.push(clean);
    depth += parenDelta(clean);
    if (depth === 0) {
      output.push({ line: currentLine, text: current.join(' ') });
      current = [];
    }
  });
  if (current.length) throw new Error(`Unterminated parenthesized record starting at line ${currentLine}`);
  return { header, records: output };
}

function parseZoneText(text, options = {}) {
  const logical = logicalRecords(text);
  const records = logical.records.map(({ line, text: recordText }) => {
    const tokens = tokenize(recordText).filter((token) => token !== '(' && token !== ')');
    if (tokens.length < 5) throw new Error(`Line ${line}: too few DNS tokens: ${recordText}`);
    const owner = tokens[0];
    let index = 1;
    let ttl = null;
    let dnsClass = 'IN';
    if (/^\d+$/.test(tokens[index] || '')) {
      ttl = Number(tokens[index]);
      index += 1;
    }
    if (KNOWN_CLASSES.has(String(tokens[index] || '').toUpperCase())) {
      dnsClass = tokens[index].toUpperCase();
      index += 1;
    }
    if (ttl === null && /^\d+$/.test(tokens[index] || '')) {
      ttl = Number(tokens[index]);
      index += 1;
    }
    if (ttl === null) throw new Error(`Line ${line}: no TTL found: ${recordText}`);
    const type = normalizeRecordType(tokens[index]);
    const rdataTokens = tokens.slice(index + 1);
    if (!type || !rdataTokens.length) throw new Error(`Line ${line}: missing type or RDATA: ${recordText}`);
    const fields = TYPE_FIELDS[type]
      ? Object.fromEntries(TYPE_FIELDS[type].map((name, fieldIndex) => [name, rdataTokens[fieldIndex]]).filter((entry) => entry[1]))
      : undefined;
    return {
      class: dnsClass,
      fields,
      owner,
      rdata: rdataTokens.join(' '),
      rdata_tokens: rdataTokens,
      source_line: line,
      ttl,
      type,
    };
  });
  return {
    analysis: analyzeRecords(records, options),
    header: logical.header,
    origin: options.origin || inferOrigin(records),
    records,
  };
}

function inferOrigin(records) {
  const soa = records.find((record) => record.type === 'SOA');
  return soa?.owner || '';
}

function analyzeRecords(records, options = {}) {
  const typeCounts = {};
  const owners = new Map();
  const staleNsReferences = [];
  const staleNameservers = new Set((options.staleNameservers || []).map((name) => String(name).toLowerCase()));
  for (const record of records) {
    typeCounts[record.type] = (typeCounts[record.type] || 0) + 1;
    if (!owners.has(record.owner)) owners.set(record.owner, new Set());
    owners.get(record.owner).add(record.type);
    if (record.type === 'NS' && staleNameservers.has(String(record.rdata).toLowerCase())) {
      staleNsReferences.push(record);
    }
  }
  const cnameConflicts = [...owners.entries()]
    .filter(([, types]) => types.has('CNAME') && types.size > 1)
    .map(([owner, types]) => ({ owner, types: [...types].sort() }));
  return {
    cname_conflicts: cnameConflicts,
    owner_count: owners.size,
    record_count: records.length,
    stale_ns_references: staleNsReferences,
    type_counts: typeCounts,
  };
}

function formatRecord(record) {
  if (record.type === 'SOA' && record.rdata_tokens.length >= 7) {
    const [mname, rname, serial, refresh, retry, expire, minimum] = record.rdata_tokens;
    return `${record.owner}\t${record.ttl}\t${record.class}\tSOA\t${mname} ${rname} ( ${serial} ${refresh} ${retry} ${expire} ${minimum} )`;
  }
  return `${record.owner}\t${record.ttl}\t${record.class}\t${record.type}\t${record.rdata}`;
}

function toZoneFile(parsed, options = {}) {
  const records = options.sorted
    ? [...parsed.records].sort((a, b) => `${a.owner}|${a.type}|${a.rdata}`.localeCompare(`${b.owner}|${b.type}|${b.rdata}`))
    : parsed.records;
  return [
    '; Generated by he-net. Preserve original capture separately.',
    parsed.origin ? `; Origin: ${parsed.origin}` : null,
    '',
    ...records.map(formatRecord),
    '',
  ].filter((line) => line !== null).join('\n');
}

async function parseZoneFile(path, options = {}) {
  return parseZoneText(await fs.readFile(path, 'utf8'), options);
}

module.exports = {
  analyzeRecords,
  formatRecord,
  logicalRecords,
  parseZoneFile,
  parseZoneText,
  stripComment,
  toZoneFile,
  tokenize,
};
