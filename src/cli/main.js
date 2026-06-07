'use strict';

const fs = require('fs/promises');
const path = require('path');
const { compareRecords, HE_NAMESERVERS, verifyAuthoritative } = require('../core/dns');
const { parseZoneFile, toZoneFile } = require('../core/zone-parser');
const { HeNetClient } = require('../he/client');
const presets = require('../workflows/presets');
const { parseArgs, required } = require('./args');
const { recordLine, writeReport } = require('./reports');

function usage() {
  return `Usage:
  he-net zone parse --origin ZONE. --input raw.txt --records-json records.json [--zone-file zone.txt]
  he-net workflow google-workspace --zone example.com --output records.json
  he-net workflow website --zone example.com --apex-a 203.0.113.10 --www-cname host.example.net --output records.json
  he-net workflow github-pages --zone example.com --github-user user --output records.json
  he-net dns verify --records records.json [--nameserver ns1.he.net]
  he-net he list-zones [--json]
  he-net he inspect-zone --zone example.com [--report report.md] [--json]
  he-net he plan-records --zone example.com --desired records.json [--report report.md]
  he-net he apply-records --zone example.com --desired records.json --execute --confirm-zone example.com --confirm-apply APPLY_RECORDS
  he-net he inspect-convert --zone example.com
  he-net he convert-slave --zone example.com --execute --confirm-zone example.com --confirm-convert CONVERT`;
}

async function readRecords(file) {
  const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
  return Array.isArray(parsed) ? parsed : parsed.records;
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function withClient(args, fn) {
  const client = new HeNetClient({
    credsPath: args.creds,
    headless: args.headful ? false : true,
    profileDir: args.profile,
  });
  await client.open();
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

async function commandZone(args) {
  const sub = args._[1];
  if (sub !== 'parse') throw new Error(usage());
  const input = required(args, 'input');
  const origin = required(args, 'origin');
  const parsed = await parseZoneFile(input, { origin });
  if (args.recordsJson) await writeJson(args.recordsJson, parsed);
  if (args.zoneFile) {
    await fs.mkdir(path.dirname(args.zoneFile), { recursive: true });
    await fs.writeFile(args.zoneFile, toZoneFile(parsed, { sorted: Boolean(args.sorted) }));
  }
  if (!args.recordsJson && !args.zoneFile) console.log(JSON.stringify(parsed, null, 2));
}

async function commandWorkflow(args) {
  const sub = args._[1];
  const zone = required(args, 'zone');
  let records;
  if (sub === 'google-workspace') {
    records = presets.googleWorkspace(zone, {
      dmarcPolicy: args.dmarcPolicy,
      dmarcRua: args.dmarcRua,
      ttl: args.ttl ? Number(args.ttl) : undefined,
    });
  } else if (sub === 'website') {
    records = presets.website(zone, {
      apexA: args.apexA,
      apexAAAA: args.apexAaaa,
      ttl: args.ttl ? Number(args.ttl) : undefined,
      wwwCname: args.wwwCname,
    });
  } else if (sub === 'github-pages') {
    records = presets.githubPages(zone, {
      githubUser: args.githubUser,
      githubVerification: args.githubVerification,
      ttl: args.ttl ? Number(args.ttl) : undefined,
    });
  } else {
    throw new Error(usage());
  }
  const output = required(args, 'output');
  await writeJson(output, { origin: `${zone}.`, records });
}

async function commandDns(args) {
  const sub = args._[1];
  if (sub !== 'verify') throw new Error(usage());
  const records = await readRecords(required(args, 'records'));
  const nameservers = args.nameserver ? [].concat(args.nameserver) : HE_NAMESERVERS;
  const results = await verifyAuthoritative(records, nameservers);
  if (args.json) console.log(JSON.stringify(results, null, 2));
  else {
    for (const result of results) {
      console.log(`${result.ok ? 'ok' : 'fail'} ${result.server} ${result.owner} ${result.qtype} answers=${result.answers.length}`);
    }
  }
  if (results.some((result) => !result.ok)) process.exitCode = 2;
}

async function commandHe(args) {
  const sub = args._[1];
  if (sub === 'list-zones') {
    return withClient(args, async (client) => {
      const zones = await client.listZones();
      if (args.json) console.log(JSON.stringify(zones, null, 2));
      else {
        for (const row of zones.active) console.log(`active ${row.zone} zoneid=${row.zoneid}`);
        for (const row of zones.slave) console.log(`slave ${row.zone} domid=${row.domid}`);
      }
    });
  }
  if (sub === 'inspect-zone') {
    const zone = required(args, 'zone');
    return withClient(args, async (client) => {
      const inspected = await client.inspectZone(zone);
      if (args.json) console.log(JSON.stringify(inspected, null, 2));
      await writeReport(args.report, `HE.net Zone Inspection - ${zone}`, [
        { lines: [`- Zone: ${zone}`, `- Zone ID: ${inspected.zoneId}`, `- Records: ${inspected.records.length}`] },
        { title: 'Records', lines: inspected.records.map(recordLine) },
      ]);
    });
  }
  if (sub === 'plan-records') {
    const zone = required(args, 'zone');
    const desired = await readRecords(required(args, 'desired'));
    return withClient(args, async (client) => {
      const plan = await client.planRecords(zone, desired);
      if (args.json) console.log(JSON.stringify(plan, null, 2));
      await writeReport(args.report, `HE.net Record Plan - ${zone}`, [
        {
          lines: [
            `- Zone: ${zone}`,
            `- Desired records: ${desired.length}`,
            `- Actual records: ${plan.actual.length}`,
            `- Missing: ${plan.comparison.missing.length}`,
            `- Extra: ${plan.comparison.extras.length}`,
            `- TTL differences: ${plan.comparison.ttlDifferences.length}`,
          ],
        },
        { title: 'Missing', lines: plan.comparison.missing.map((item) => `- ${item.key}`) },
        { title: 'Extra', lines: plan.comparison.extras.map(recordLine) },
      ]);
      if (plan.comparison.missing.length || plan.comparison.extras.length) process.exitCode = 2;
    });
  }
  if (sub === 'apply-records') {
    const zone = required(args, 'zone');
    if (!args.execute) throw new Error('apply-records is dry-run by default; use plan-records or pass --execute with confirmations.');
    if (args.confirmZone !== zone || args.confirmApply !== 'APPLY_RECORDS') {
      throw new Error(`Missing --confirm-zone ${zone} --confirm-apply APPLY_RECORDS`);
    }
    const desired = await readRecords(required(args, 'desired'));
    return withClient(args, async (client) => {
      const plan = await client.planRecords(zone, desired);
      const operations = [];
      for (const missing of plan.comparison.missing) {
        const result = await client.addRecord(plan.zoneId, missing.record);
        operations.push({ action: 'add', key: missing.key, result });
      }
      console.log(JSON.stringify({ operations, zone }, null, 2));
    });
  }
  if (sub === 'inspect-convert') {
    const zone = required(args, 'zone');
    return withClient(args, async (client) => {
      const result = await client.inspectSlaveConversion(zone);
      console.log(JSON.stringify(result, null, 2));
    });
  }
  if (sub === 'convert-slave') {
    const zone = required(args, 'zone');
    if (!args.execute) throw new Error('convert-slave requires --execute and confirmations.');
    return withClient(args, async (client) => {
      const result = await client.convertSlave(zone, {
        confirmConvert: args.confirmConvert,
        confirmZone: args.confirmZone,
      });
      console.log(JSON.stringify(result, null, 2));
    });
  }
  throw new Error(usage());
}

async function main(argv) {
  const args = parseArgs(argv);
  const command = args._[0];
  if (!command || args.help) {
    console.log(usage());
    return;
  }
  if (command === 'zone') return commandZone(args);
  if (command === 'workflow') return commandWorkflow(args);
  if (command === 'dns') return commandDns(args);
  if (command === 'he') return commandHe(args);
  throw new Error(usage());
}

module.exports = { main, usage };
