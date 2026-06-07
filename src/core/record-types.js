'use strict';

const HE_SUPPORTED_RECORD_TYPES = new Set([
  'A',
  'AAAA',
  'AFSDB',
  'ALIAS',
  'CAA',
  'CNAME',
  'HINFO',
  'LOC',
  'MX',
  'NAPTR',
  'NS',
  'PTR',
  'RP',
  'SPF',
  'SRV',
  'SSHFP',
  'TXT',
]);

const PRIORITY_RECORD_TYPES = new Set(['MX', 'SRV']);

function normalizeRecordType(type) {
  return String(type || '').trim().toUpperCase();
}

function isHeSupportedRecordType(type) {
  return HE_SUPPORTED_RECORD_TYPES.has(normalizeRecordType(type));
}

function assertHeSupportedRecordType(type) {
  const normalized = normalizeRecordType(type);
  if (!isHeSupportedRecordType(normalized)) {
    throw new Error(`Unsupported HE.net record type: ${type || '[empty]'}`);
  }
  return normalized;
}

module.exports = {
  HE_SUPPORTED_RECORD_TYPES,
  PRIORITY_RECORD_TYPES,
  assertHeSupportedRecordType,
  isHeSupportedRecordType,
  normalizeRecordType,
};
