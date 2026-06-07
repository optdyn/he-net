'use strict';

module.exports = {
  archive: require('./core/archive'),
  dns: require('./core/dns'),
  recordTypes: require('./core/record-types'),
  testDomains: require('./core/domain-list'),
  zoneParser: require('./core/zone-parser'),
  workflows: require('./workflows/presets'),
};
