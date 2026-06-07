'use strict';

const assert = require('assert');
const test = require('node:test');
const { compareRecords, recordKey, recordParts } = require('../src/core/dns');
const {
  HE_SUPPORTED_RECORD_TYPES,
  assertHeSupportedRecordType,
  isHeSupportedRecordType,
} = require('../src/core/record-types');
const { HeNetClient } = require('../src/he/client');

const EXAMPLES = {
  A: '203.0.113.10',
  AAAA: '2001:db8::10',
  AFSDB: '1 afsdb.example.com.',
  ALIAS: 'target.example.net.',
  CAA: '0 issue "letsencrypt.org"',
  CNAME: 'target.example.com.',
  HINFO: '"x86_64" "Linux"',
  LOC: '37 47 0.000 N 122 24 0.000 W 10.00m 1m 10000m 10m',
  MX: '10 mail.example.com.',
  NAPTR: '100 10 "U" "E2U+sip" "!^.*$!sip:info@example.com!" .',
  NS: 'ns1.he.net.',
  PTR: 'host.example.com.',
  RP: 'hostmaster.example.com. admin.example.com.',
  SPF: '"v=spf1 include:_spf.example.net ~all"',
  SRV: '10 20 5060 sip.example.com.',
  SSHFP: '1 1 123456789abcdef67890123456789abcdef67890',
  TXT: '"verification-token"',
};

test('declares the HE.net supported record type set', () => {
  assert.deepEqual([...HE_SUPPORTED_RECORD_TYPES].sort(), Object.keys(EXAMPLES).sort());
});

test('record key generation supports every HE.net record type', () => {
  for (const [type, rdata] of Object.entries(EXAMPLES)) {
    const key = recordKey({
      owner: `${type.toLowerCase()}.example.com.`,
      rdata,
      rdata_tokens: rdata.match(/"[^"]*"|\S+/g),
      ttl: 300,
      type,
    });
    assert.match(key, new RegExp(`\\|${type}\\|`));
  }
});

test('desired records compare cleanly against HE.net-style UI records for every supported type', () => {
  const desired = Object.entries(EXAMPLES).map(([type, rdata]) => ({
    owner: `${type.toLowerCase()}.example.com.`,
    rdata,
    rdata_tokens: rdata.match(/"[^"]*"|\S+/g),
    ttl: 300,
    type,
  }));
  const actual = desired.map((record) => {
    const parts = recordParts(record);
    return {
      content: parts.content,
      name: record.owner.replace(/\.$/, ''),
      priority: parts.priority,
      ttl: '300',
      type: record.type,
    };
  });

  const comparison = compareRecords(desired, actual);
  assert.equal(comparison.missing.length, 0);
  assert.equal(comparison.extras.length, 0);
  assert.equal(comparison.ttlDifferences.length, 0);
});

test('priority records split priority from HE.net form content', () => {
  assert.deepEqual(recordParts({
    fields: { exchange: 'mail.example.com.', preference: '10' },
    rdata: '10 mail.example.com.',
    type: 'MX',
  }), { content: 'mail.example.com.', priority: '10' });

  assert.deepEqual(recordParts({
    fields: { port: '5060', priority: '10', target: 'sip.example.com.', weight: '20' },
    rdata: '10 20 5060 sip.example.com.',
    type: 'SRV',
  }), { content: '20 5060 sip.example.com.', priority: '10' });
});

test('explicit content and priority fields override rdata splitting', () => {
  assert.deepEqual(recordParts({
    content: 'mail.example.com.',
    priority: '5',
    rdata: '10 other.example.com.',
    type: 'MX',
  }), { content: 'mail.example.com.', priority: '5' });
});

test('rejects unsupported HE.net record types', () => {
  assert.equal(isHeSupportedRecordType('HTTPS'), false);
  assert.throws(() => assertHeSupportedRecordType('HTTPS'), /Unsupported HE\.net record type/);
});

test('HE.net client rejects unsupported record types before browser submission', async () => {
  const client = new HeNetClient();
  await assert.rejects(
    client.addRecord('123', { owner: 'https.example.com.', rdata: 'svc.example.com.', ttl: 300, type: 'HTTPS' }),
    /Unsupported HE\.net record type/
  );
});
