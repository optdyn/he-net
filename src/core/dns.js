'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');
const { PRIORITY_RECORD_TYPES, normalizeRecordType } = require('./record-types');

const execFileAsync = promisify(execFile);
const HE_NAMESERVERS = ['ns1.he.net', 'ns2.he.net', 'ns3.he.net', 'ns4.he.net', 'ns5.he.net'];
const PROVIDER_MANAGED_TYPES = new Set(['SOA']);

function normalizeName(value) {
  const lowered = String(value || '').trim().toLowerCase();
  return lowered.endsWith('.') ? lowered.slice(0, -1) : lowered;
}

function fqdn(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return trimmed;
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}

function assertExactZone(actual, expected) {
  const actualNorm = normalizeName(actual);
  const expectedNorm = normalizeName(expected);
  if (!actualNorm || actualNorm !== expectedNorm) {
    throw new Error(`Exact zone mismatch: expected ${expectedNorm}, got ${actualNorm || '[empty]'}`);
  }
}

function normalizeContent(value) {
  let normalized = String(value || '').trim().replace(/\s+/g, ' ');
  const quotedSegments = [...normalized.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
  if (quotedSegments.length) {
    const remainder = normalized.replace(/"[^"]*"/g, '').trim();
    if (!remainder) normalized = quotedSegments.join('');
  }
  if (normalized.startsWith('"') && normalized.endsWith('"')) normalized = normalized.slice(1, -1);
  return normalized.toLowerCase().replace(/\.$/, '');
}

function unquoteTxt(tokens) {
  return tokens.map((token) => {
    const trimmed = String(token || '').trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
    return trimmed.replace(/^"|"$/g, '');
  }).join('');
}

function recordParts(record) {
  const type = normalizeRecordType(record.type);
  if (record.content !== undefined) {
    return {
      content: record.content,
      priority: record.priority !== undefined && record.priority !== '' ? String(record.priority) : '-',
    };
  }
  const tokens = record.rdata_tokens || String(record.rdata || '').split(/\s+/).filter(Boolean);
  if (type === 'MX') {
    return {
      content: record.fields?.exchange || tokens[1],
      priority: String(record.fields?.preference || tokens[0]),
    };
  }
  if (type === 'SRV') {
    return {
      content: [
        record.fields?.weight || tokens[1],
        record.fields?.port || tokens[2],
        record.fields?.target || tokens[3],
      ].join(' '),
      priority: String(record.fields?.priority || tokens[0]),
    };
  }
  if (type === 'TXT') {
    return { content: Array.isArray(record.rdata_tokens) ? unquoteTxt(record.rdata_tokens) : record.rdata, priority: '-' };
  }
  return { content: record.rdata, priority: '-' };
}

function keyFromParts(name, type, priority, content) {
  const upperType = normalizeRecordType(type);
  const normalizedPriority = PRIORITY_RECORD_TYPES.has(upperType) ? String(priority || '-') : '-';
  return `${normalizeName(name)}|${upperType}|${normalizedPriority}|${normalizeContent(content)}`;
}

function recordKey(record) {
  const parts = recordParts(record);
  return keyFromParts(record.owner || record.name, record.type, parts.priority, parts.content);
}

function uiRecordKey(record) {
  return keyFromParts(record.name || record.owner, record.type, record.priority, record.content || record.rdata);
}

function compareRecords(desiredRecords, actualRecords, options = {}) {
  const providerManaged = options.providerManaged || PROVIDER_MANAGED_TYPES;
  const actualByKey = new Map(actualRecords.map((record) => [uiRecordKey(record), record]));
  const desiredByKey = new Map(desiredRecords.map((record) => [recordKey(record), record]));
  const comparisons = desiredRecords.map((record) => {
    const key = recordKey(record);
    const actual = actualByKey.get(key) || null;
    const type = String(record.type || '').toUpperCase();
    return {
      actualTtl: actual?.ttl || null,
      contentMatch: Boolean(actual),
      expectedTtl: String(record.ttl || ''),
      key,
      providerManaged: providerManaged.has(type),
      record,
      ttlExact: Boolean(actual) && String(record.ttl || '') === String(actual.ttl || ''),
      type,
    };
  });
  return {
    comparisons,
    extras: actualRecords.filter((record) => !desiredByKey.has(uiRecordKey(record))),
    missing: comparisons.filter((comparison) => !comparison.contentMatch && !comparison.providerManaged),
    providerManaged: comparisons.filter((comparison) => !comparison.contentMatch && comparison.providerManaged),
    ttlDifferences: comparisons.filter((comparison) => comparison.contentMatch && !comparison.ttlExact),
  };
}

async function dig(server, owner, qtype, options = {}) {
  const args = [
    `@${server}`,
    owner,
    qtype,
    '+norecurse',
    '+noall',
    '+answer',
    `+time=${options.time || 3}`,
    `+tries=${options.tries || 1}`,
  ];
  try {
    const { stdout, stderr } = await execFileAsync('dig', args, { timeout: (options.timeoutSeconds || 10) * 1000 });
    return { answers: stdout.trim().split(/\r?\n/).filter(Boolean), ok: true, owner, qtype, server, stderr };
  } catch (error) {
    return {
      answers: String(error.stdout || '').trim().split(/\r?\n/).filter(Boolean),
      ok: false,
      owner,
      qtype,
      server,
      stderr: error.stderr || error.message,
    };
  }
}

async function verifyAuthoritative(records, nameservers = HE_NAMESERVERS) {
  const seen = new Set();
  const queries = [];
  for (const record of records) {
    const qtype = normalizeRecordType(record.type);
    if (qtype === 'SOA') continue;
    const key = `${normalizeName(record.owner)}|${qtype}`;
    if (seen.has(key)) continue;
    seen.add(key);
    queries.push({ owner: record.owner, qtype });
  }
  const results = [];
  for (const server of nameservers) {
    for (const query of queries) results.push(await dig(server, query.owner, query.qtype));
  }
  return results;
}

module.exports = {
  HE_NAMESERVERS,
  PRIORITY_RECORD_TYPES,
  PROVIDER_MANAGED_TYPES,
  assertExactZone,
  compareRecords,
  dig,
  fqdn,
  keyFromParts,
  normalizeContent,
  normalizeName,
  recordKey,
  recordParts,
  uiRecordKey,
  verifyAuthoritative,
};
