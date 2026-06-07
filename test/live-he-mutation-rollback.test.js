'use strict';

const assert = require('assert');
const crypto = require('crypto');
const test = require('node:test');
const archive = require('../src/core/archive');
const { readTestDomains } = require('../src/core/domain-list');
const { HeNetClient } = require('../src/he/client');

const liveMutationEnabled =
  process.env.HE_NET_LIVE_MUTATION_TESTS === '1' &&
  process.env.HE_NET_CONFIRM_LIVE_MUTATION === 'ROLLBACK_TEST_DOMAINS';

async function rollbackToSnapshot(client, zone, snapshot) {
  const inspected = await client.inspectZone(zone);
  const plan = archive.rollbackPlan(snapshot, inspected.records);
  for (const record of plan.delete) {
    await client.deleteRecord(inspected.zoneId, record, { confirmDelete: 'DELETE_RECORD' });
  }
  for (const replacement of plan.ttlReplacements) {
    await client.deleteRecord(inspected.zoneId, replacement.actual, { confirmDelete: 'DELETE_RECORD' });
    await client.addRecord(inspected.zoneId, replacement.desired);
  }
  for (const item of plan.add) {
    await client.addRecord(inspected.zoneId, item.record);
  }
  return archive.rollbackPlan(snapshot, (await client.inspectZone(zone)).records);
}

test('live HE.net mutation tests roll back configured test domains', {
  skip: liveMutationEnabled
    ? false
    : 'Set HE_NET_LIVE_MUTATION_TESTS=1 and HE_NET_CONFIRM_LIVE_MUTATION=ROLLBACK_TEST_DOMAINS to mutate and roll back test domains.',
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
      const before = await client.inspectZone(domain);
      const snapshot = archive.buildSnapshot(domain, 'pre-live-mutation-test', before.records, {
        command: 'HE_NET_LIVE_MUTATION_TESTS=1 npm test',
      });
      const token = crypto.randomBytes(6).toString('hex');
      const testRecord = {
        class: 'IN',
        owner: `_he-net-rollback-test-${token}.${domain}.`,
        rdata: `"he-net rollback integration ${token}"`,
        rdata_tokens: [`"he-net rollback integration ${token}"`],
        ttl: 300,
        type: 'TXT',
      };

      try {
        await client.addRecord(before.zoneId, testRecord);
        const mutated = await client.inspectZone(domain);
        assert.ok(
          mutated.records.some((record) =>
            record.name === testRecord.owner.replace(/\.$/, '') &&
            record.type === 'TXT' &&
            record.content.includes(token)
          ),
          `${domain} should contain the temporary rollback test TXT record`
        );
      } finally {
        const remaining = await rollbackToSnapshot(client, domain, snapshot);
        assert.equal(remaining.add.length, 0, `${domain} rollback should leave no missing records`);
        assert.equal(remaining.delete.length, 0, `${domain} rollback should leave no extra records`);
        assert.equal(remaining.ttlReplacements.length, 0, `${domain} rollback should leave no TTL replacements`);
      }
    }
  } finally {
    await client.close();
  }
});
