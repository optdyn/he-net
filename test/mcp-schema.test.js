'use strict';

const assert = require('assert/strict');
const test = require('node:test');
const { TOOLS } = require('../src/mcp/server');

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
