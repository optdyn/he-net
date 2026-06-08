'use strict';

const assert = require('assert');
const fs = require('fs');
const test = require('node:test');
const { compareRecords, normalizeContent, recordKey } = require('../src/core/dns');
const { parseZoneText, toZoneFile } = require('../src/core/zone-parser');
const presets = require('../src/workflows/presets');

test('parses HE.net raw AXFR output', () => {
  const text = fs.readFileSync('test/fixtures/sample-zone.txt', 'utf8');
  const parsed = parseZoneText(text, { origin: 'example.com.' });
  assert.equal(parsed.records.length, 6);
  assert.equal(parsed.analysis.type_counts.A, 1);
  assert.equal(parsed.analysis.type_counts.SRV, 1);
  assert.match(toZoneFile(parsed), /www\.example\.com\./);
});

test('normalizes TXT quoted chunks', () => {
  assert.equal(normalizeContent('"a" "b"'), 'ab');
  assert.equal(normalizeContent('"v=DMARC1; p=none"'), 'v=dmarc1; p=none');
});

test('compares TXT records using rdata when tokenization is lossy', () => {
  const desired = [{
    owner: 'example.com.',
    type: 'TXT',
    ttl: 300,
    rdata: '"v=spf1 include:_spf.example.net -all"',
    rdata_tokens: ['"v=spf1', 'include:_spf.example.net', '-all"'],
  }];
  const actual = [{
    name: 'example.com',
    type: 'TXT',
    ttl: '300',
    priority: '0',
    content: '"v=spf1 include:_spf.example.net -all"',
  }];
  assert.equal(compareRecords(desired, actual).missing.length, 0);
});

test('record keys normalize non-priority records', () => {
  const key = recordKey({ owner: 'WWW.EXAMPLE.COM.', type: 'CNAME', ttl: 300, rdata: 'example.com.' });
  assert.equal(key, 'www.example.com|CNAME|-|example.com');
});

test('compares desired and actual records', () => {
  const desired = [{ owner: 'www.example.com.', type: 'A', ttl: 300, rdata: '203.0.113.10' }];
  const actual = [{ name: 'www.example.com', type: 'A', ttl: '300', priority: '0', content: '203.0.113.10' }];
  const comparison = compareRecords(desired, actual);
  assert.equal(comparison.missing.length, 0);
  assert.equal(comparison.ttlDifferences.length, 0);
});

test('generates workflow records', () => {
  assert.ok(presets.googleWorkspace('example.com').some((record) => record.type === 'MX'));
  assert.ok(presets.website('example.com', { apexA: '203.0.113.10' }).some((record) => record.type === 'A'));
});
