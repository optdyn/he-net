'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { compareRecords, fqdn, normalizeName, uiRecordKey, PROVIDER_MANAGED_TYPES } = require('./dns');
const { normalizeRecordType } = require('./record-types');

const DEFAULT_ARCHIVE_DIR = path.resolve(process.cwd(), '.local/he-net-archives');
const ARCHIVE_VERSION = 1;

function archiveRoot(options = {}) {
  return path.resolve(options.archiveDir || DEFAULT_ARCHIVE_DIR);
}

function safeZoneDir(zone) {
  const normalized = normalizeName(zone);
  if (!normalized || !/^[a-z0-9_.-]+$/.test(normalized)) {
    throw new Error(`Invalid archive zone name: ${zone || '[empty]'}`);
  }
  return normalized;
}

function safeArchiveId(id, label = 'archive id') {
  const value = String(id || '');
  if (!value || !/^[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value || '[empty]'}`);
  }
  return value;
}

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function shortHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12);
}

function snapshotId(zone, capturedAt, records) {
  return `${timestamp(capturedAt)}-${shortHash({ records, zone })}`;
}

function operationId(zone, action, startedAt, payload) {
  return `${timestamp(startedAt)}-${safeArchiveId(action, 'operation action')}-${shortHash({ payload, zone })}`;
}

function zoneArchivePath(zone, options = {}) {
  return path.join(archiveRoot(options), safeZoneDir(zone));
}

function snapshotPath(zone, id, options = {}) {
  return path.join(zoneArchivePath(zone, options), 'snapshots', `${safeArchiveId(id, 'snapshot id')}.json`);
}

function operationPath(zone, id, options = {}) {
  return path.join(zoneArchivePath(zone, options), 'operations', `${safeArchiveId(id, 'operation id')}.json`);
}

async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  try {
    await fs.link(tmp, file);
  } finally {
    await fs.unlink(tmp).catch(() => {});
  }
}

function uiRecordToDesired(record) {
  const type = String(record.type || '').toUpperCase();
  const name = fqdn(record.name || record.owner);
  const ttl = Number(record.ttl || 0) || record.ttl || '';
  const priority = String(record.priority || '').trim();
  const content = String(record.content || record.rdata || '').trim();
  const rdata = ['MX', 'SRV'].includes(type) && priority && priority !== '-'
    ? `${priority} ${content}`
    : content;
  const rdataTokens = type === 'TXT' ? [rdata] : rdata.split(/\s+/).filter(Boolean);
  const desired = {
    class: record.class || 'IN',
    owner: name,
    rdata,
    rdata_tokens: rdataTokens,
    ttl,
    type,
  };
  if (type === 'MX' && rdataTokens.length >= 2) {
    desired.fields = { exchange: rdataTokens[1], preference: rdataTokens[0] };
  }
  if (type === 'SRV' && rdataTokens.length >= 4) {
    desired.fields = {
      port: rdataTokens[2],
      priority: rdataTokens[0],
      target: rdataTokens[3],
      weight: rdataTokens[1],
    };
  }
  return desired;
}

function snapshotRecords(records) {
  return records.map(uiRecordToDesired);
}

function buildSnapshot(zone, source, records, metadata = {}, date = new Date()) {
  const capturedAt = date.toISOString();
  const desiredRecords = snapshotRecords(records);
  const id = snapshotId(zone, date, desiredRecords);
  return {
    archiveVersion: ARCHIVE_VERSION,
    capturedAt,
    id,
    metadata,
    records: desiredRecords,
    source,
    zone: safeZoneDir(zone),
  };
}

async function saveSnapshot(snapshot, options = {}) {
  const file = snapshotPath(snapshot.zone, snapshot.id, options);
  await writeJsonAtomic(file, snapshot);
  return { ...snapshot, path: file };
}

async function createSnapshot(zone, source, records, metadata = {}, options = {}) {
  return saveSnapshot(buildSnapshot(zone, source, records, metadata), options);
}

async function readSnapshot(zone, id, options = {}) {
  return JSON.parse(await fs.readFile(snapshotPath(zone, id, options), 'utf8'));
}

async function listSnapshots(zone, options = {}) {
  const dir = path.join(zoneArchivePath(zone, options), 'snapshots');
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const snapshots = [];
  for (const entry of entries.filter((name) => name.endsWith('.json')).sort()) {
    const snapshot = JSON.parse(await fs.readFile(path.join(dir, entry), 'utf8'));
    snapshots.push({
      capturedAt: snapshot.capturedAt,
      id: snapshot.id,
      path: path.join(dir, entry),
      recordCount: snapshot.records.length,
      source: snapshot.source,
      zone: snapshot.zone,
    });
  }
  return snapshots;
}

async function writeOperation(zone, action, payload, options = {}) {
  const startedAt = payload.startedAt ? new Date(payload.startedAt) : new Date();
  const id = operationId(zone, action, startedAt, payload);
  const operation = {
    action,
    archiveVersion: ARCHIVE_VERSION,
    id,
    recordedAt: startedAt.toISOString(),
    zone: safeZoneDir(zone),
    ...payload,
  };
  const file = operationPath(zone, id, options);
  await writeJsonAtomic(file, operation);
  return { ...operation, path: file };
}

async function readOperation(zone, id, options = {}) {
  return JSON.parse(await fs.readFile(operationPath(zone, id, options), 'utf8'));
}

async function listOperations(zone, options = {}) {
  const dir = path.join(zoneArchivePath(zone, options), 'operations');
  let entries;
  try {
    entries = await fs.readdir(dir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const operations = [];
  for (const entry of entries.filter((name) => name.endsWith('.json')).sort()) {
    const operation = JSON.parse(await fs.readFile(path.join(dir, entry), 'utf8'));
    operations.push({
      action: operation.action,
      afterSnapshotId: operation.afterSnapshotId,
      beforeSnapshotId: operation.beforeSnapshotId,
      id: operation.id,
      path: path.join(dir, entry),
      recordedAt: operation.recordedAt,
      targetSnapshotId: operation.targetSnapshotId,
      zone: operation.zone,
    });
  }
  return operations;
}

function rollbackPlan(snapshot, actualRecords) {
  const desiredRecords = snapshot.records.filter((record) => !PROVIDER_MANAGED_TYPES.has(normalizeRecordType(record.type)));
  const comparableActualRecords = actualRecords.filter((record) =>
    !PROVIDER_MANAGED_TYPES.has(normalizeRecordType(record.type))
  );
  const comparison = compareRecords(desiredRecords, comparableActualRecords);
  const actualByKey = new Map(comparableActualRecords.map((record) => [uiRecordKey(record), record]));
  const ttlReplacements = comparison.ttlDifferences.map((difference) => ({
    actual: actualByKey.get(difference.key),
    desired: difference.record,
    key: difference.key,
  }));
  return {
    add: comparison.missing.map((item) => ({ key: item.key, record: item.record })),
    comparison,
    delete: comparison.extras,
    snapshot: {
      capturedAt: snapshot.capturedAt,
      id: snapshot.id,
      recordCount: snapshot.records.length,
      source: snapshot.source,
      zone: snapshot.zone,
    },
    ttlReplacements,
  };
}

function summarizeRollbackPlan(plan) {
  return {
    add: plan.add.length,
    delete: plan.delete.length,
    snapshotId: plan.snapshot.id,
    ttlReplacements: plan.ttlReplacements.length,
    zone: plan.snapshot.zone,
  };
}

module.exports = {
  ARCHIVE_VERSION,
  DEFAULT_ARCHIVE_DIR,
  buildSnapshot,
  createSnapshot,
  listOperations,
  listSnapshots,
  readOperation,
  readSnapshot,
  rollbackPlan,
  safeArchiveId,
  safeZoneDir,
  saveSnapshot,
  summarizeRollbackPlan,
  uiRecordToDesired,
  writeOperation,
};
