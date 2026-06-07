'use strict';

const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { parseTestDomains, readTestDomains } = require('../src/core/domain-list');

test('parses configured test domains from text', () => {
  assert.deepEqual(parseTestDomains(`
# local test zones
Example.COM.
www.example.net
example.com
`), ['example.com', 'www.example.net']);
});

test('rejects invalid test domain entries', () => {
  assert.throws(() => parseTestDomains('not a domain'), /Invalid test domain/);
});

test('reads test domains from a configured file', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'he-net-test-domains-'));
  t.after(() => fs.rm(dir, { force: true, recursive: true }));
  const file = path.join(dir, 'domains.txt');
  await fs.writeFile(file, 'alpha.example\nbeta.example.\n');

  assert.deepEqual(await readTestDomains({ path: file }), ['alpha.example', 'beta.example']);
});

test('missing test domain file is allowed by default', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'he-net-test-domains-'));
  t.after(() => fs.rm(dir, { force: true, recursive: true }));

  assert.deepEqual(await readTestDomains({ path: path.join(dir, 'missing.txt') }), []);
});
