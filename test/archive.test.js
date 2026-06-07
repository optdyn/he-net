'use strict';

const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const test = require('node:test');
const archive = require('../src/core/archive');

async function tempArchive() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'he-net-archive-test-'));
}

test('creates and lists immutable zone snapshots', async (t) => {
  const archiveDir = await tempArchive();
  t.after(() => fs.rm(archiveDir, { force: true, recursive: true }));

  const snapshot = await archive.createSnapshot('Example.COM.', 'test', [
    {
      content: '203.0.113.10',
      name: 'www.example.com',
      priority: '0',
      ttl: '300',
      type: 'A',
    },
  ], { note: 'unit-test' }, { archiveDir });

  assert.equal(snapshot.zone, 'example.com');
  assert.equal(snapshot.records.length, 1);
  assert.equal(snapshot.records[0].owner, 'www.example.com.');
  assert.equal(snapshot.records[0].rdata, '203.0.113.10');
  assert.equal(snapshot.records[0].ttl, 300);

  const snapshots = await archive.listSnapshots('example.com', { archiveDir });
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].id, snapshot.id);
  assert.equal(snapshots[0].recordCount, 1);

  await assert.rejects(
    archive.saveSnapshot(snapshot, { archiveDir }),
    /EEXIST|file already exists/i
  );
});

test('converts priority UI records into desired records', () => {
  const mx = archive.uiRecordToDesired({
    content: 'ASPMX.L.GOOGLE.com.',
    name: 'example.com',
    priority: '1',
    ttl: '3600',
    type: 'MX',
  });

  assert.deepEqual(mx.fields, { exchange: 'ASPMX.L.GOOGLE.com.', preference: '1' });
  assert.equal(mx.owner, 'example.com.');
  assert.equal(mx.rdata, '1 ASPMX.L.GOOGLE.com.');
  assert.deepEqual(mx.rdata_tokens, ['1', 'ASPMX.L.GOOGLE.com.']);
});

test('builds rollback plan from historical snapshot to current UI records', async (t) => {
  const archiveDir = await tempArchive();
  t.after(() => fs.rm(archiveDir, { force: true, recursive: true }));

  const snapshot = await archive.createSnapshot('example.com', 'pre-change', [
    {
      content: '203.0.113.10',
      name: 'www.example.com',
      priority: '0',
      ttl: '300',
      type: 'A',
    },
    {
      content: 'v=spf1 include:_spf.example.net ~all',
      name: 'example.com',
      priority: '0',
      ttl: '3600',
      type: 'TXT',
    },
  ], {}, { archiveDir });

  const plan = archive.rollbackPlan(snapshot, [
    {
      content: '203.0.113.20',
      locked: false,
      name: 'api.example.com',
      priority: '0',
      recordId: '100',
      ttl: '300',
      type: 'A',
    },
    {
      content: '203.0.113.10',
      locked: false,
      name: 'www.example.com',
      priority: '0',
      recordId: '101',
      ttl: '900',
      type: 'A',
    },
  ]);

  assert.equal(plan.add.length, 1);
  assert.match(plan.add[0].key, /example\.com\|TXT/);
  assert.equal(plan.delete.length, 1);
  assert.equal(plan.delete[0].name, 'api.example.com');
  assert.equal(plan.ttlReplacements.length, 1);
  assert.equal(plan.ttlReplacements[0].actual.recordId, '101');
  assert.equal(plan.ttlReplacements[0].desired.ttl, 300);
  assert.deepEqual(archive.summarizeRollbackPlan(plan), {
    add: 1,
    delete: 1,
    snapshotId: snapshot.id,
    ttlReplacements: 1,
    zone: 'example.com',
  });
});

test('rollback plan ignores provider-managed SOA serial changes', async (t) => {
  const archiveDir = await tempArchive();
  t.after(() => fs.rm(archiveDir, { force: true, recursive: true }));

  const snapshot = await archive.createSnapshot('example.com', 'pre-change', [
    {
      content: 'ns1.he.net. hostmaster.he.net. 2026010101 86400 7200 3600000 172800',
      locked: true,
      name: 'example.com',
      priority: '0',
      ttl: '172800',
      type: 'SOA',
    },
  ], {}, { archiveDir });

  const plan = archive.rollbackPlan(snapshot, [
    {
      content: 'ns1.he.net. hostmaster.he.net. 2026010102 86400 7200 3600000 172800',
      locked: true,
      name: 'example.com',
      priority: '0',
      recordId: '1',
      ttl: '172800',
      type: 'SOA',
    },
  ]);

  assert.equal(plan.add.length, 0);
  assert.equal(plan.delete.length, 0);
  assert.equal(plan.ttlReplacements.length, 0);
});


test('writes operation logs with snapshot references', async (t) => {
  const archiveDir = await tempArchive();
  t.after(() => fs.rm(archiveDir, { force: true, recursive: true }));

  const operation = await archive.writeOperation('example.com', 'apply-records', {
    afterSnapshotId: 'after-id',
    beforeSnapshotId: 'before-id',
    operations: [{ action: 'add', key: 'www.example.com|A|-|203.0.113.10' }],
  }, { archiveDir });

  assert.equal(operation.action, 'apply-records');
  assert.equal(operation.beforeSnapshotId, 'before-id');
  assert.equal(operation.afterSnapshotId, 'after-id');

  const saved = JSON.parse(await fs.readFile(operation.path, 'utf8'));
  assert.equal(saved.id, operation.id);
  assert.deepEqual(saved.operations, operation.operations);

  const operations = await archive.listOperations('example.com', { archiveDir });
  assert.equal(operations.length, 1);
  assert.equal(operations[0].id, operation.id);
  assert.equal(operations[0].action, 'apply-records');

  const read = await archive.readOperation('example.com', operation.id, { archiveDir });
  assert.equal(read.id, operation.id);
  assert.equal(read.beforeSnapshotId, 'before-id');
});
