'use strict';

const fs = require('fs/promises');
const path = require('path');
const { normalizeName } = require('./dns');

const DEFAULT_TEST_DOMAINS_PATH = path.resolve(process.cwd(), 'test-domains.txt');

function parseTestDomains(text) {
  const domains = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const domain = normalizeName(trimmed);
    if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) || !domain.includes('.')) {
      throw new Error(`Invalid test domain: ${trimmed}`);
    }
    domains.push(domain);
  }
  return [...new Set(domains)];
}

async function readTestDomains(options = {}) {
  const file = path.resolve(options.path || DEFAULT_TEST_DOMAINS_PATH);
  try {
    return parseTestDomains(await fs.readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && !options.required) return [];
    throw error;
  }
}

module.exports = {
  DEFAULT_TEST_DOMAINS_PATH,
  parseTestDomains,
  readTestDomains,
};
