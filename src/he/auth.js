'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_CREDS_PATH = path.resolve(process.cwd(), 'he-net-creds.txt');

function parseKeyValue(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z0-9_.-]+)\s*[:=]\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function parseNetrc(text) {
  const tokens = text.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  const unquote = (value) => String(value || '').replace(/^["']|["']$/g, '');
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index] !== 'machine') continue;
    const machine = tokens[index + 1];
    if (!['dns.he.net', 'he.net'].includes(machine)) continue;
    let username = null;
    let password = null;
    for (let inner = index + 2; inner < tokens.length; inner += 2) {
      if (tokens[inner] === 'machine') break;
      if (tokens[inner] === 'login' || tokens[inner] === 'user') username = unquote(tokens[inner + 1]);
      if (tokens[inner] === 'password' || tokens[inner] === 'pass') password = unquote(tokens[inner + 1]);
    }
    if (username && password) return { username, password };
  }
  return null;
}

function readCredentials(credsPath = process.env.HE_NET_CREDS || DEFAULT_CREDS_PATH) {
  if (process.env.HE_NET_USERNAME && process.env.HE_NET_PASSWORD) {
    return { username: process.env.HE_NET_USERNAME, password: process.env.HE_NET_PASSWORD };
  }
  if (!fs.existsSync(credsPath)) throw new Error(`HE.net credentials file not found: ${credsPath}`);
  const text = fs.readFileSync(credsPath, 'utf8').trim();
  if (!text) throw new Error(`HE.net credentials file is empty: ${credsPath}`);
  try {
    const parsed = JSON.parse(text);
    const username = parsed.username || parsed.user || parsed.email || parsed.login || parsed.HE_NET_USERNAME;
    const password = parsed.password || parsed.pass || parsed.HE_NET_PASSWORD;
    if (username && password) return { username, password };
  } catch {
    // Continue with other credential formats.
  }
  const keyValue = parseKeyValue(text);
  const username =
    keyValue.he_net_username || keyValue.username || keyValue.user || keyValue.email || keyValue.login;
  const password = keyValue.he_net_password || keyValue.password || keyValue.pass;
  if (username && password) return { username, password };
  const netrc = parseNetrc(text);
  if (netrc) return netrc;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  if (lines.length === 1 && lines[0].includes(':')) {
    const separator = lines[0].indexOf(':');
    return { username: lines[0].slice(0, separator), password: lines[0].slice(separator + 1) };
  }
  if (lines.length >= 2) return { username: lines[0], password: lines[1] };
  throw new Error('Unsupported HE.net credentials format.');
}

async function isLoggedIn(page) {
  return page.locator('text=Logout').first().isVisible({ timeout: 3000 }).catch(() => false);
}

async function loginIfNeeded(page, options = {}) {
  await page.goto('https://dns.he.net/', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  if (await isLoggedIn(page)) return { action: 'reused-session', loggedIn: true };
  const { username, password } = readCredentials(options.credsPath);
  await page.locator('input[name="email"]').fill(username);
  await page.locator('input[name="pass"]').fill(password);
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
    page.locator('#_loginbutton, input[type="submit"][value="Login!"]').first().click(),
  ]);
  if (!(await isLoggedIn(page))) throw new Error('HE.net login did not reach an authenticated page.');
  return { action: 'credential-login', loggedIn: true };
}

module.exports = {
  DEFAULT_CREDS_PATH,
  isLoggedIn,
  loginIfNeeded,
  readCredentials,
};
