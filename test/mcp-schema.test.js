'use strict';

const assert = require('assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const test = require('node:test');
const archive = require('../src/core/archive');
const { TOOLS, callTool } = require('../src/mcp/server');

function findArraySchemas(schema, path = []) {
  const found = [];
  if (!schema || typeof schema !== 'object') return found;
  if (schema.type === 'array') found.push({ path, schema });
  for (const [key, value] of Object.entries(schema.properties || {})) {
    found.push(...findArraySchemas(value, path.concat(key)));
  }
  if (schema.items) found.push(...findArraySchemas(schema.items, path.concat('items')));
  return found;
}

test('MCP tool array schemas declare item types', () => {
  for (const tool of TOOLS) {
    const arrays = findArraySchemas(tool.inputSchema);
    for (const entry of arrays) {
      assert.ok(
        entry.schema.items,
        `${tool.name}.${entry.path.join('.')} must declare items`
      );
    }
  }
});

test('MCP exposes HE.net operation parity tools', () => {
  const names = new Set(TOOLS.map((tool) => tool.name));
  for (const name of [
    'list_zones',
    'inspect_zone',
    'plan_records',
    'apply_records',
    'delete_records',
    'rollback_plan',
    'rollback_records',
    'inspect_slave_conversion',
    'convert_slave',
    'archive_list_snapshots',
    'archive_show_snapshot',
    'archive_list_operations',
    'archive_show_operation',
  ]) {
    assert.ok(names.has(name), `missing MCP tool ${name}`);
  }
});

test('MCP archive tools read snapshots and operations', async () => {
  const archiveDir = await fs.mkdtemp(path.join(os.tmpdir(), 'he-net-mcp-archive-test-'));
  const zone = 'example.com';
  const snapshot = await archive.createSnapshot(zone, 'test', [{
    content: '203.0.113.10',
    name: 'www.example.com',
    priority: '-',
    ttl: '300',
    type: 'A',
  }], {}, { archiveDir });
  const operation = await archive.writeOperation(zone, 'test-operation', {
    beforeSnapshotId: snapshot.id,
  }, { archiveDir });

  const snapshots = JSON.parse((await callTool('archive_list_snapshots', { archiveDir, zone })).content[0].text);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].id, snapshot.id);

  const shownSnapshot = JSON.parse((await callTool('archive_show_snapshot', {
    archiveDir,
    snapshot: snapshot.id,
    zone,
  })).content[0].text);
  assert.equal(shownSnapshot.id, snapshot.id);

  const operations = JSON.parse((await callTool('archive_list_operations', { archiveDir, zone })).content[0].text);
  assert.equal(operations.length, 1);
  assert.equal(operations[0].id, operation.id);

  const shownOperation = JSON.parse((await callTool('archive_show_operation', {
    archiveDir,
    operation: operation.id,
    zone,
  })).content[0].text);
  assert.equal(shownOperation.id, operation.id);
});
