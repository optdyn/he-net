#!/usr/bin/env node
'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SERVER_NAME = 'heNetDns';

function usage() {
  return `Usage:
  node scripts/install-vscode-mcp.js [options]

Options:
  --scope user|workspace       Write user config or workspace .vscode/mcp.json. Default: user.
  --config PATH                Override target mcp.json path.
  --server-name NAME           MCP server key. Default: heNetDns.
  --creds-path PATH            Add HE_NET_CREDS to the VS Code MCP server env.
  --skip-npm-install           Do not run npm install/npm ci.
  --skip-playwright-install    Do not run npx playwright install chromium.
  --install-browser-deps       Also run npx playwright install-deps chromium.
  --dry-run                    Print planned changes without writing or installing.
  --help                       Show this help.`;
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    installBrowserDeps: false,
    scope: 'user',
    serverName: SERVER_NAME,
    skipNpmInstall: false,
    skipPlaywrightInstall: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const [rawKey, inlineValue] = token.startsWith('--') ? token.slice(2).split(/=(.*)/s) : [token, undefined];
    const value = inlineValue !== undefined ? inlineValue : argv[index + 1];
    if (token === '--help') args.help = true;
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--install-browser-deps') args.installBrowserDeps = true;
    else if (token === '--skip-npm-install') args.skipNpmInstall = true;
    else if (token === '--skip-playwright-install') args.skipPlaywrightInstall = true;
    else if (rawKey === 'scope') {
      args.scope = value;
      if (inlineValue === undefined) index += 1;
    } else if (rawKey === 'config') {
      args.config = value;
      if (inlineValue === undefined) index += 1;
    } else if (rawKey === 'server-name') {
      args.serverName = value;
      if (inlineValue === undefined) index += 1;
    } else if (rawKey === 'creds-path') {
      args.credsPath = value;
      if (inlineValue === undefined) index += 1;
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }
  if (!['user', 'workspace'].includes(args.scope)) throw new Error(`Unsupported --scope: ${args.scope}`);
  if (!/^[A-Za-z0-9_.-]+$/.test(args.serverName)) throw new Error(`Invalid --server-name: ${args.serverName}`);
  return args;
}

function repoRoot() {
  return path.resolve(__dirname, '..');
}

function defaultUserConfigPath(env = process.env) {
  const configHome = env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'Code', 'User', 'mcp.json');
}

function defaultConfigPath(args, root = repoRoot(), env = process.env) {
  if (args.config) return path.resolve(args.config);
  if (args.scope === 'workspace') return path.join(root, '.vscode', 'mcp.json');
  return defaultUserConfigPath(env);
}

function serverConfig(root, args, nodePath = process.execPath) {
  const config = {
    type: 'stdio',
    command: nodePath,
    args: [path.join(root, 'bin', 'he-net-mcp.js')],
    cwd: root,
  };
  if (args.credsPath) config.env = { HE_NET_CREDS: path.resolve(args.credsPath) };
  return config;
}

function mergeMcpConfig(existing, name, server) {
  const config = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  const servers = config.servers && typeof config.servers === 'object' && !Array.isArray(config.servers)
    ? { ...config.servers }
    : {};
  servers[name] = server;
  return { ...config, servers };
}

async function readJsonIfExists(file) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON in ${file}: ${error.message}`);
    throw error;
  }
}

function run(command, args, options = {}) {
  const display = [command, ...args].join(' ');
  if (options.dryRun) {
    console.log(`dry-run: ${display}`);
    return;
  }
  const result = spawnSync(command, args, { cwd: options.cwd, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Command failed: ${display}`);
}

async function writeConfig(file, value, options = {}) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (options.dryRun) {
    console.log(`dry-run: write ${file}`);
    console.log(text);
    return;
  }
  await fsp.mkdir(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    await fsp.copyFile(file, `${file}.bak`);
  }
  await fsp.writeFile(file, text, { mode: 0o600 });
}

async function install(args, options = {}) {
  const root = options.root || repoRoot();
  const configPath = defaultConfigPath(args, root, options.env || process.env);
  const packageLock = path.join(root, 'package-lock.json');
  const npmArgs = fs.existsSync(packageLock) ? ['ci'] : ['install'];

  if (!args.skipNpmInstall) run('npm', npmArgs, { cwd: root, dryRun: args.dryRun });
  if (!args.skipPlaywrightInstall) run('npx', ['playwright', 'install', 'chromium'], { cwd: root, dryRun: args.dryRun });
  if (args.installBrowserDeps) {
    run('npx', ['playwright', 'install-deps', 'chromium'], { cwd: root, dryRun: args.dryRun });
  }

  const existing = await readJsonIfExists(configPath);
  const next = mergeMcpConfig(existing, args.serverName, serverConfig(root, args, options.nodePath));
  await writeConfig(configPath, next, { dryRun: args.dryRun });

  return { configPath, root, serverName: args.serverName };
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return;
  }
  const result = await install(args);
  console.log(`Installed VS Code MCP server '${result.serverName}' in ${result.configPath}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  defaultConfigPath,
  install,
  mergeMcpConfig,
  parseArgs,
  serverConfig,
};
