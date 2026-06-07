'use strict';

const assert = require('assert');
const test = require('node:test');
const { readTestDomains } = require('../src/core/domain-list');
const { HeNetClient } = require('../src/he/client');

const liveEnabled = process.env.HE_NET_LIVE_READ_TESTS === '1';

test('live read-only HE.net inspection for configured test domains', {
  skip: liveEnabled ? false : 'Set HE_NET_LIVE_READ_TESTS=1 to run read-only HE.net integration tests.',
}, async () => {
  const domains = await readTestDomains({ required: true });
  assert.ok(domains.length > 0, 'test-domains.txt must contain at least one domain');

  const client = new HeNetClient({
    credsPath: process.env.HE_NET_CREDS,
    headless: process.env.HE_NET_HEADFUL === '1' ? false : true,
    profileDir: process.env.HE_NET_PROFILE,
  });
  await client.open();
  try {
    for (const domain of domains) {
      const inspected = await client.inspectZone(domain);
      assert.equal(inspected.row.zone, domain);
      assert.ok(inspected.records.length > 0, `${domain} should have DNS records`);
    }
  } finally {
    await client.close();
  }
});
