'use strict';

const { fqdn } = require('../core/dns');

function googleWorkspace(zone, options = {}) {
  const ttl = options.ttl || 3600;
  const owner = fqdn(zone);
  return [
    { owner, ttl, class: 'IN', type: 'MX', rdata: '1 ASPMX.L.GOOGLE.com.', rdata_tokens: ['1', 'ASPMX.L.GOOGLE.com.'], fields: { preference: '1', exchange: 'ASPMX.L.GOOGLE.com.' } },
    { owner, ttl, class: 'IN', type: 'MX', rdata: '5 ALT1.ASPMX.L.GOOGLE.com.', rdata_tokens: ['5', 'ALT1.ASPMX.L.GOOGLE.com.'], fields: { preference: '5', exchange: 'ALT1.ASPMX.L.GOOGLE.com.' } },
    { owner, ttl, class: 'IN', type: 'MX', rdata: '5 ALT2.ASPMX.L.GOOGLE.com.', rdata_tokens: ['5', 'ALT2.ASPMX.L.GOOGLE.com.'], fields: { preference: '5', exchange: 'ALT2.ASPMX.L.GOOGLE.com.' } },
    { owner, ttl, class: 'IN', type: 'MX', rdata: '10 ASPMX2.GOOGLEMAIL.com.', rdata_tokens: ['10', 'ASPMX2.GOOGLEMAIL.com.'], fields: { preference: '10', exchange: 'ASPMX2.GOOGLEMAIL.com.' } },
    { owner, ttl, class: 'IN', type: 'MX', rdata: '10 ASPMX3.GOOGLEMAIL.com.', rdata_tokens: ['10', 'ASPMX3.GOOGLEMAIL.com.'], fields: { preference: '10', exchange: 'ASPMX3.GOOGLEMAIL.com.' } },
    { owner, ttl, class: 'IN', type: 'TXT', rdata: '"v=spf1 include:_spf.google.com ~all"', rdata_tokens: ['"v=spf1 include:_spf.google.com ~all"'] },
    { owner: fqdn(`_dmarc.${zone}`), ttl, class: 'IN', type: 'TXT', rdata: `"v=DMARC1; p=${options.dmarcPolicy || 'none'}; rua=mailto:${options.dmarcRua || `dmarc@${zone}`}"`, rdata_tokens: [`"v=DMARC1; p=${options.dmarcPolicy || 'none'}; rua=mailto:${options.dmarcRua || `dmarc@${zone}`}"`] },
  ];
}

function website(zone, options = {}) {
  const ttl = options.ttl || 300;
  const records = [];
  if (options.apexA) {
    for (const address of [].concat(options.apexA)) {
      records.push({ owner: fqdn(zone), ttl, class: 'IN', type: 'A', rdata: address, rdata_tokens: [address] });
    }
  }
  if (options.apexAAAA) {
    for (const address of [].concat(options.apexAAAA)) {
      records.push({ owner: fqdn(zone), ttl, class: 'IN', type: 'AAAA', rdata: address, rdata_tokens: [address] });
    }
  }
  if (options.wwwCname) {
    records.push({ owner: fqdn(`www.${zone}`), ttl, class: 'IN', type: 'CNAME', rdata: fqdn(options.wwwCname), rdata_tokens: [fqdn(options.wwwCname)] });
  }
  return records;
}

function githubPages(zone, options = {}) {
  return [
    ...website(zone, {
      apexA: ['185.199.108.153', '185.199.109.153', '185.199.110.153', '185.199.111.153'],
      ttl: options.ttl || 3600,
      wwwCname: options.wwwCname || `${options.githubUser || 'example'}.github.io`,
    }),
    { owner: fqdn(zone), ttl: options.ttl || 3600, class: 'IN', type: 'TXT', rdata: `"${options.githubVerification || 'github-pages-placeholder'}"`, rdata_tokens: [`"${options.githubVerification || 'github-pages-placeholder'}"`] },
  ];
}

module.exports = {
  githubPages,
  googleWorkspace,
  website,
};
