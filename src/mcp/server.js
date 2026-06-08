'use strict';

const fs = require('fs/promises');
const { parseZoneText } = require('../core/zone-parser');
const { compareRecords, verifyAuthoritative } = require('../core/dns');
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
    name: 'inspect_zone',
    description: 'Inspect an exact HE.net active/master zone using the Playwright web adapter.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string' },
        profileDir: { type: 'string' },
        credsPath: { type: 'string' },
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
        profileDir: { type: 'string' },
        credsPath: { type: 'string' },
      },
      required: ['zone', 'desired'],
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
  if (name === 'inspect_zone') {
    const client = new HeNetClient({ credsPath: args.credsPath, profileDir: args.profileDir });
    await client.open();
    try {
      return content(await client.inspectZone(args.zone));
    } finally {
      await client.close();
    }
  }
  if (name === 'plan_records') {
    const client = new HeNetClient({ credsPath: args.credsPath, profileDir: args.profileDir });
    await client.open();
    try {
      return content(await client.planRecords(args.zone, args.desired));
    } finally {
      await client.close();
    }
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

module.exports = { TOOLS, main };
