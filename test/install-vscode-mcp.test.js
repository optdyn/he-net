'use strict';

const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const test = require('node:test');
const {
  defaultConfigPath,
  install,
  mergeMcpConfig,
  parseArgs,
  serverConfig,
} = require('../scripts/install-vscode-mcp');

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'he-net-vscode-mcp-test-'));
}

test('parses installer arguments', () => {
  const args = parseArgs([
    '--scope',
    'workspace',
    '--server-name=heDns',
    '--creds-path',
    'he-net-creds.txt',
    '--skip-npm-install',
    '--skip-playwright-install',
    '--dry-run',
  ]);

  assert.equal(args.scope, 'workspace');
  assert.equal(args.serverName, 'heDns');
  assert.equal(args.credsPath, 'he-net-creds.txt');
  assert.equal(args.skipNpmInstall, true);
  assert.equal(args.skipPlaywrightInstall, true);
  assert.equal(args.dryRun, true);
});

test('builds VS Code stdio server config', () => {
  const root = '/opt/he-net';
  assert.deepEqual(serverConfig(root, { credsPath: '/secrets/he-net-creds.txt' }, '/usr/bin/node'), {
    args: ['/opt/he-net/bin/he-net-mcp.js'],
    command: '/usr/bin/node',
    cwd: '/opt/he-net',
    env: { HE_NET_CREDS: '/secrets/he-net-creds.txt' },
    type: 'stdio',
  });
});

test('merges MCP config without dropping existing servers or inputs', () => {
  const merged = mergeMcpConfig({
    inputs: [{ id: 'token', type: 'promptString' }],
    servers: {
      memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
    },
  }, 'heNetDns', { command: 'node', args: ['bin/he-net-mcp.js'], type: 'stdio' });

  assert.deepEqual(Object.keys(merged.servers).sort(), ['heNetDns', 'memory']);
  assert.equal(merged.inputs.length, 1);
  assert.equal(merged.servers.heNetDns.type, 'stdio');
});

test('computes VS Code user and workspace config paths', () => {
  const env = { XDG_CONFIG_HOME: '/home/test/.config' };
  assert.equal(
    defaultConfigPath({ scope: 'user' }, '/repo', env),
    '/home/test/.config/Code/User/mcp.json'
  );
  assert.equal(defaultConfigPath({ scope: 'workspace' }, '/repo', env), '/repo/.vscode/mcp.json');
});

test('installer writes merged config when dependency steps are skipped', async (t) => {
  const root = await tempDir();
  const configDir = await tempDir();
  t.after(() => fs.rm(root, { force: true, recursive: true }));
  t.after(() => fs.rm(configDir, { force: true, recursive: true }));

  await fs.mkdir(path.join(root, 'bin'), { recursive: true });
  await fs.writeFile(path.join(root, 'bin', 'he-net-mcp.js'), '#!/usr/bin/env node\n');
  const config = path.join(configDir, 'mcp.json');
  await fs.writeFile(config, JSON.stringify({ servers: { existing: { command: 'true' } } }));

  await install({
    config,
    dryRun: false,
    scope: 'user',
    serverName: 'heNetDns',
    skipNpmInstall: true,
    skipPlaywrightInstall: true,
  }, { nodePath: '/usr/bin/node', root });

  const written = JSON.parse(await fs.readFile(config, 'utf8'));
  assert.equal(written.servers.existing.command, 'true');
  assert.equal(written.servers.heNetDns.command, '/usr/bin/node');
  assert.equal(written.servers.heNetDns.cwd, root);

  await fs.access(`${config}.bak`);
});
