'use strict';

const fs = require('fs/promises');
const archive = require('../core/archive');
const { parseZoneText } = require('../core/zone-parser');
const { compareRecords, recordKey, uiRecordKey, verifyAuthoritative } = require('../core/dns');
const { HeNetClient } = require('../he/client');
const presets = require('../workflows/presets');

const DNS_RECORD_SCHEMA = {
  type: 'object',
  properties: {
    content: { type: 'string' },
    fields: { type: 'object' },
    name: { type: 'string' },
    owner: { type: 'string' },
    priority: { type: ['string', 'number'] },
    rdata: { type: 'string' },
    rdata_tokens: { type: 'array', items: { type: 'string' } },
    ttl: { type: ['string', 'number'] },
    type: { type: 'string' },
  },
  required: ['type'],
};

const CLIENT_OPTIONS_SCHEMA = {
  archiveDir: { type: 'string' },
  credsPath: { type: 'string' },
  headless: { type: 'boolean' },
  profileDir: { type: 'string' },
};

const EXECUTE_CONFIRM_SCHEMA = {
  confirmZone: { type: 'string' },
  execute: { type: 'boolean' },
};

const TOOLS = [
  {
    name: 'parse_zone',
    description: 'Parse HE.net raw AXFR or BIND-style zone text into structured records.',
    inputSchema: {
      type: 'object',
      properties: { origin: { type: 'string' }, text: { type: 'string' } },
      required: ['text'],
    },
  },
  {
    name: 'workflow_records',
    description: 'Generate DNS records for common workflows such as google-workspace, website, or github-pages.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow: { type: 'string' },
        zone: { type: 'string' },
        options: { type: 'object' },
      },
      required: ['workflow', 'zone'],
    },
  },
  {
    name: 'compare_records',
    description: 'Compare desired records with actual records already supplied by the caller.',
    inputSchema: {
      type: 'object',
      properties: {
        desired: { type: 'array', items: DNS_RECORD_SCHEMA },
        actual: { type: 'array', items: DNS_RECORD_SCHEMA },
      },
      required: ['desired', 'actual'],
    },
  },
  {
    name: 'verify_records',
    description: 'Verify DNS records by querying authoritative nameservers directly.',
    inputSchema: {
      type: 'object',
      properties: {
        records: { type: 'array', items: DNS_RECORD_SCHEMA },
        nameservers: { type: 'array', items: { type: 'string' } },
      },
      required: ['records'],
    },
  },
  {
    name: 'list_zones',
    description: 'List active and slave zones from HE.net using the Playwright web adapter.',
    inputSchema: {
      type: 'object',
      properties: {
        ...CLIENT_OPTIONS_SCHEMA,
      },
    },
  },
  {
    name: 'inspect_zone',
    description: 'Inspect an exact HE.net active/master zone using the Playwright web adapter.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        ...CLIENT_OPTIONS_SCHEMA,
      },
      required: ['zone'],
    },
  },
  {
    name: 'plan_records',
    description: 'Plan changes for an exact HE.net active/master zone.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        desired: { type: 'array', items: DNS_RECORD_SCHEMA },
        ...CLIENT_OPTIONS_SCHEMA,
      },
      required: ['zone', 'desired'],
    },
  },
  {
    name: 'apply_records',
    description: 'Apply missing desired records to an exact HE.net active/master zone. Dry-run unless execute=true and confirmation tokens are provided.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        desired: { type: 'array', items: DNS_RECORD_SCHEMA },
        confirmApply: { type: 'string' },
        ...EXECUTE_CONFIRM_SCHEMA,
        ...CLIENT_OPTIONS_SCHEMA,
      },
      required: ['zone', 'desired'],
    },
  },
  {
    name: 'delete_records',
    description: 'Delete exact matching records from an HE.net active/master zone. Dry-run unless execute=true and confirmation tokens are provided.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        records: { type: 'array', items: DNS_RECORD_SCHEMA },
        confirmDelete: { type: 'string' },
        ...EXECUTE_CONFIRM_SCHEMA,
        ...CLIENT_OPTIONS_SCHEMA,
      },
      required: ['zone', 'records'],
    },
  },
  {
    name: 'rollback_plan',
    description: 'Build a rollback plan from an archived snapshot against the current exact HE.net active/master zone.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        snapshot: { type: 'string' },
        ...CLIENT_OPTIONS_SCHEMA,
      },
      required: ['zone', 'snapshot'],
    },
  },
  {
    name: 'rollback_records',
    description: 'Roll an exact HE.net active/master zone back to an archived snapshot. Dry-run unless execute=true and confirmation tokens are provided.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        snapshot: { type: 'string' },
        confirmRollback: { type: 'string' },
        ...EXECUTE_CONFIRM_SCHEMA,
        ...CLIENT_OPTIONS_SCHEMA,
      },
      required: ['zone', 'snapshot'],
    },
  },
  {
    name: 'inspect_slave_conversion',
    description: 'Inspect whether an exact HE.net slave zone can be converted to an active/master zone.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        ...CLIENT_OPTIONS_SCHEMA,
      },
      required: ['zone'],
    },
  },
  {
    name: 'convert_slave',
    description: 'Convert an exact HE.net slave zone to active/master. Requires execute=true and confirmation tokens.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        confirmConvert: { type: 'string' },
        ...EXECUTE_CONFIRM_SCHEMA,
        ...CLIENT_OPTIONS_SCHEMA,
      },
      required: ['zone'],
    },
  },
  {
    name: 'archive_list_snapshots',
    description: 'List archived snapshots for a zone.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        archiveDir: { type: 'string' },
      },
      required: ['zone'],
    },
  },
  {
    name: 'archive_show_snapshot',
    description: 'Read an archived zone snapshot.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        snapshot: { type: 'string' },
        archiveDir: { type: 'string' },
      },
      required: ['zone', 'snapshot'],
    },
  },
  {
    name: 'archive_list_operations',
    description: 'List archived mutation operations for a zone.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        archiveDir: { type: 'string' },
      },
      required: ['zone'],
    },
  },
  {
    name: 'archive_show_operation',
    description: 'Read an archived mutation operation.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        operation: { type: 'string' },
        archiveDir: { type: 'string' },
      },
      required: ['zone', 'operation'],
    },
  },
];

function response(id, result) {
  return JSON.stringify({ id, jsonrpc: '2.0', result });
}

function errorResponse(id, error) {
  return JSON.stringify({
    error: { code: -32000, message: error.message },
    id,
    jsonrpc: '2.0',
  });
}

function content(value) {
  return {
    content: [{ text: typeof value === 'string' ? value : JSON.stringify(value, null, 2), type: 'text' }],
  };
}

function requireArg(args, name) {
  if (args[name] === undefined || args[name] === null || args[name] === '') {
    throw new Error(`Missing required argument: ${name}`);
  }
  return args[name];
}

function archiveOptions(args) {
  return { archiveDir: args.archiveDir };
}

function mutationSummary(plan) {
  return {
    add: plan.add?.length || 0,
    delete: plan.delete?.length || 0,
    missing: plan.comparison?.missing?.length || 0,
    extras: plan.comparison?.extras?.length || 0,
    ttlDifferences: plan.comparison?.ttlDifferences?.length || plan.ttlReplacements?.length || 0,
  };
}

async function withClient(args, fn) {
  const client = new HeNetClient({
    credsPath: args.credsPath,
    headless: args.headless === false ? false : true,
    profileDir: args.profileDir,
  });
  await client.open();
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function createArchiveSnapshot(zone, source, records, args, metadata = {}) {
  return archive.createSnapshot(zone, source, records, metadata, archiveOptions(args));
}

async function applyRecords(args) {
  const zone = requireArg(args, 'zone');
  const desired = requireArg(args, 'desired');
  return withClient(args, async (client) => {
    const plan = await client.planRecords(zone, desired);
    if (!args.execute) {
      return {
        dryRun: true,
        message: 'apply_records is dry-run by default; pass execute=true, confirmZone=<zone>, and confirmApply=APPLY_RECORDS to mutate HE.net.',
        planned: {
          extras: plan.comparison.extras.length,
          missing: plan.comparison.missing.length,
          ttlDifferences: plan.comparison.ttlDifferences.length,
        },
        zone,
        zoneId: plan.zoneId,
      };
    }
    if (args.confirmZone !== zone || args.confirmApply !== 'APPLY_RECORDS') {
      throw new Error(`Missing confirmZone=${zone} and confirmApply=APPLY_RECORDS.`);
    }
    const before = await createArchiveSnapshot(zone, 'pre-apply-records', plan.actual, args, {
      command: 'mcp apply_records',
      desiredCount: desired.length,
    });
    const operations = [];
    for (const missing of plan.comparison.missing) {
      const result = await client.addRecord(plan.zoneId, missing.record);
      operations.push({ action: 'add', key: missing.key, result });
    }
    const after = await client.inspectZone(zone);
    const afterSnapshot = await createArchiveSnapshot(zone, 'post-apply-records', after.records, args, {
      beforeSnapshotId: before.id,
      command: 'mcp apply_records',
    });
    const operation = await archive.writeOperation(zone, 'apply-records', {
      afterSnapshotId: afterSnapshot.id,
      beforeSnapshotId: before.id,
      desired,
      operations,
      planned: {
        extras: plan.comparison.extras.length,
        missing: plan.comparison.missing.length,
        ttlDifferences: plan.comparison.ttlDifferences.length,
      },
    }, archiveOptions(args));
    return {
      afterSnapshotId: afterSnapshot.id,
      beforeSnapshotId: before.id,
      operationId: operation.id,
      operations,
      zone,
    };
  });
}

async function deleteRecords(args) {
  const zone = requireArg(args, 'zone');
  const records = requireArg(args, 'records');
  return withClient(args, async (client) => {
    const inspected = await client.inspectZone(zone);
    const requestedKeys = new Set(records.map(recordKey));
    const recordsToDelete = inspected.records.filter((record) => requestedKeys.has(uiRecordKey(record)));
    if (!args.execute) {
      return {
        dryRun: true,
        message: 'delete_records is dry-run by default; pass execute=true, confirmZone=<zone>, and confirmDelete=DELETE_RECORDS to mutate HE.net.',
        requested: records.length,
        toDelete: recordsToDelete.map((record) => ({ key: uiRecordKey(record), record })),
        zone,
        zoneId: inspected.zoneId,
      };
    }
    if (args.confirmZone !== zone || args.confirmDelete !== 'DELETE_RECORDS') {
      throw new Error(`Missing confirmZone=${zone} and confirmDelete=DELETE_RECORDS.`);
    }
    const before = await createArchiveSnapshot(zone, 'pre-delete-records', inspected.records, args, {
      command: 'mcp delete_records',
      requestedCount: records.length,
    });
    const operations = [];
    for (const record of recordsToDelete) {
      const result = await client.deleteRecord(inspected.zoneId, record, { confirmDelete: 'DELETE_RECORD' });
      operations.push({ action: 'delete', key: uiRecordKey(record), result });
    }
    const after = await client.inspectZone(zone);
    const afterSnapshot = await createArchiveSnapshot(zone, 'post-delete-records', after.records, args, {
      beforeSnapshotId: before.id,
      command: 'mcp delete_records',
    });
    const operation = await archive.writeOperation(zone, 'delete-records', {
      afterSnapshotId: afterSnapshot.id,
      beforeSnapshotId: before.id,
      operations,
      requested: records,
    }, archiveOptions(args));
    return {
      afterSnapshotId: afterSnapshot.id,
      beforeSnapshotId: before.id,
      operationId: operation.id,
      operations,
      zone,
    };
  });
}

async function rollbackPlan(args) {
  const zone = requireArg(args, 'zone');
  const snapshot = await archive.readSnapshot(zone, requireArg(args, 'snapshot'), archiveOptions(args));
  return withClient(args, async (client) => {
    const inspected = await client.inspectZone(zone);
    const plan = archive.rollbackPlan(snapshot, inspected.records);
    return {
      plan,
      summary: archive.summarizeRollbackPlan(plan),
      zone,
      zoneId: inspected.zoneId,
    };
  });
}

async function rollbackRecords(args) {
  const zone = requireArg(args, 'zone');
  const snapshot = await archive.readSnapshot(zone, requireArg(args, 'snapshot'), archiveOptions(args));
  return withClient(args, async (client) => {
    const inspected = await client.inspectZone(zone);
    const plan = archive.rollbackPlan(snapshot, inspected.records);
    if (!args.execute) {
      return {
        dryRun: true,
        message: 'rollback_records is dry-run by default; pass execute=true, confirmZone=<zone>, and confirmRollback=ROLLBACK_RECORDS to mutate HE.net.',
        plan,
        summary: mutationSummary(plan),
        zone,
        zoneId: inspected.zoneId,
      };
    }
    if (args.confirmZone !== zone || args.confirmRollback !== 'ROLLBACK_RECORDS') {
      throw new Error(`Missing confirmZone=${zone} and confirmRollback=ROLLBACK_RECORDS.`);
    }
    const before = await createArchiveSnapshot(zone, 'pre-rollback-records', inspected.records, args, {
      command: 'mcp rollback_records',
      targetSnapshotId: snapshot.id,
    });
    const operations = [];
    for (const record of plan.delete) {
      const result = await client.deleteRecord(inspected.zoneId, record, { confirmDelete: 'DELETE_RECORD' });
      operations.push({ action: 'delete', key: uiRecordKey(record), result });
    }
    for (const replacement of plan.ttlReplacements) {
      const deleted = await client.deleteRecord(inspected.zoneId, replacement.actual, { confirmDelete: 'DELETE_RECORD' });
      operations.push({ action: 'delete-for-ttl-replacement', key: replacement.key, result: deleted });
      const added = await client.addRecord(inspected.zoneId, replacement.desired);
      operations.push({ action: 'add-for-ttl-replacement', key: replacement.key, result: added });
    }
    for (const item of plan.add) {
      const result = await client.addRecord(inspected.zoneId, item.record);
      operations.push({ action: 'add', key: item.key, result });
    }
    const after = await client.inspectZone(zone);
    const afterSnapshot = await createArchiveSnapshot(zone, 'post-rollback-records', after.records, args, {
      beforeSnapshotId: before.id,
      command: 'mcp rollback_records',
      targetSnapshotId: snapshot.id,
    });
    const operation = await archive.writeOperation(zone, 'rollback-records', {
      afterSnapshotId: afterSnapshot.id,
      beforeSnapshotId: before.id,
      operations,
      targetSnapshotId: snapshot.id,
    }, archiveOptions(args));
    return {
      afterSnapshotId: afterSnapshot.id,
      beforeSnapshotId: before.id,
      operationId: operation.id,
      operations,
      targetSnapshotId: snapshot.id,
      zone,
    };
  });
}

async function convertSlave(args) {
  const zone = requireArg(args, 'zone');
  return withClient(args, async (client) => {
    const conversion = await client.inspectSlaveConversion(zone);
    if (!args.execute) {
      return {
        conversion,
        dryRun: true,
        message: 'convert_slave is dry-run by default; pass execute=true, confirmZone=<zone>, and confirmConvert=CONVERT to mutate HE.net.',
        zone,
      };
    }
    const before = await createArchiveSnapshot(zone, 'pre-convert-slave', [], args, {
      command: 'mcp convert_slave',
      conversion,
    });
    const result = await client.convertSlave(zone, {
      confirmConvert: args.confirmConvert,
      confirmZone: args.confirmZone,
    });
    const operation = await archive.writeOperation(zone, 'convert-slave', {
      beforeSnapshotId: before.id,
      result,
    }, archiveOptions(args));
    return { beforeSnapshotId: before.id, operationId: operation.id, result, zone };
  });
}

async function callTool(name, args) {
  if (name === 'parse_zone') return content(parseZoneText(args.text, { origin: args.origin }));
  if (name === 'workflow_records') {
    if (args.workflow === 'google-workspace') return content(presets.googleWorkspace(args.zone, args.options || {}));
    if (args.workflow === 'website') return content(presets.website(args.zone, args.options || {}));
    if (args.workflow === 'github-pages') return content(presets.githubPages(args.zone, args.options || {}));
    throw new Error(`Unknown workflow: ${args.workflow}`);
  }
  if (name === 'compare_records') return content(compareRecords(args.desired, args.actual));
  if (name === 'verify_records') return content(await verifyAuthoritative(args.records, args.nameservers));
  if (name === 'list_zones') return content(await withClient(args, (client) => client.listZones()));
  if (name === 'inspect_zone') {
    return content(await withClient(args, (client) => client.inspectZone(args.zone)));
  }
  if (name === 'plan_records') {
    return content(await withClient(args, (client) => client.planRecords(args.zone, args.desired)));
  }
  if (name === 'apply_records') return content(await applyRecords(args));
  if (name === 'delete_records') return content(await deleteRecords(args));
  if (name === 'rollback_plan') return content(await rollbackPlan(args));
  if (name === 'rollback_records') return content(await rollbackRecords(args));
  if (name === 'inspect_slave_conversion') {
    return content(await withClient(args, (client) => client.inspectSlaveConversion(args.zone)));
  }
  if (name === 'convert_slave') return content(await convertSlave(args));
  if (name === 'archive_list_snapshots') {
    return content(await archive.listSnapshots(requireArg(args, 'zone'), archiveOptions(args)));
  }
  if (name === 'archive_show_snapshot') {
    return content(await archive.readSnapshot(requireArg(args, 'zone'), requireArg(args, 'snapshot'), archiveOptions(args)));
  }
  if (name === 'archive_list_operations') {
    return content(await archive.listOperations(requireArg(args, 'zone'), archiveOptions(args)));
  }
  if (name === 'archive_show_operation') {
    return content(await archive.readOperation(requireArg(args, 'zone'), requireArg(args, 'operation'), archiveOptions(args)));
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function handle(message) {
  if (message.method === 'initialize') {
    return {
      capabilities: { tools: {} },
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'he-net-mcp', version: require('../../package.json').version },
    };
  }
  if (message.method === 'tools/list') return { tools: TOOLS };
  if (message.method === 'tools/call') {
    const { name, arguments: args } = message.params || {};
    return callTool(name, args || {});
  }
  return {};
}

async function main() {
  process.stdin.setEncoding('utf8');
  let buffer = '';
  process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
        const result = await handle(message);
        process.stdout.write(`${response(message.id, result)}\n`);
      } catch (error) {
        process.stdout.write(`${errorResponse(message?.id || null, error)}\n`);
      }
    }
  });
  if (process.stdin.isTTY) {
    process.stdout.write(`${JSON.stringify({ tools: TOOLS }, null, 2)}\n`);
  } else {
    const handle = await fs.open('/dev/null', 'r').catch(() => null);
    if (handle) await handle.close();
  }
}

module.exports = { TOOLS, callTool, main };
