'use strict';

const fs = require('fs/promises');
const path = require('path');
const archive = require('../core/archive');
const { compareRecords, HE_NAMESERVERS, verifyAuthoritative } = require('../core/dns');
const { readTestDomains } = require('../core/domain-list');
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
  he-net he rollback-plan --zone example.com --snapshot SNAPSHOT_ID [--report report.md]
  he-net he rollback-records --zone example.com --snapshot SNAPSHOT_ID --execute --confirm-zone example.com --confirm-rollback ROLLBACK_RECORDS
  he-net he inspect-convert --zone example.com
  he-net he convert-slave --zone example.com --execute --confirm-zone example.com --confirm-convert CONVERT
  he-net archive list --zone example.com
  he-net archive show --zone example.com --snapshot SNAPSHOT_ID
  he-net archive operations --zone example.com
  he-net archive operation --zone example.com --operation OPERATION_ID
  he-net test-domains list [--path test-domains.txt] [--json]`;
}

async function readRecords(file) {
  const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
  return Array.isArray(parsed) ? parsed : parsed.records;
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function archiveSnapshot(zone, source, records, args, metadata = {}) {
  return archive.createSnapshot(zone, source, records, metadata, { archiveDir: args.archiveDir });
}

async function writeRollbackReport(reportPath, zone, plan) {
  await writeReport(reportPath, `HE.net Rollback Plan - ${zone}`, [
    {
      lines: [
        `- Zone: ${zone}`,
        `- Snapshot: ${plan.snapshot.id}`,
        `- Snapshot captured: ${plan.snapshot.capturedAt}`,
        `- Snapshot records: ${plan.snapshot.recordCount}`,
        `- Add: ${plan.add.length}`,
        `- Delete: ${plan.delete.length}`,
        `- TTL replacements: ${plan.ttlReplacements.length}`,
      ],
    },
    { title: 'Add', lines: plan.add.map((item) => `- ${item.key}`) },
    { title: 'Delete', lines: plan.delete.map(recordLine) },
    { title: 'TTL Replacements', lines: plan.ttlReplacements.map((item) => `- ${item.key}`) },
  ]);
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
      const before = await archiveSnapshot(zone, 'pre-apply-records', plan.actual, args, {
        command: 'he apply-records',
        desiredCount: desired.length,
      });
      const operations = [];
      for (const missing of plan.comparison.missing) {
        const result = await client.addRecord(plan.zoneId, missing.record);
        operations.push({ action: 'add', key: missing.key, result });
      }
      const after = await client.inspectZone(zone);
      const afterSnapshot = await archiveSnapshot(zone, 'post-apply-records', after.records, args, {
        beforeSnapshotId: before.id,
        command: 'he apply-records',
      });
      const operation = await archive.writeOperation(zone, 'apply-records', {
        afterSnapshotId: afterSnapshot.id,
        beforeSnapshotId: before.id,
        desired,
        operations,
        planned: {
          extras: plan.comparison.extras.length,
          missing: plan.comparison.missing.length,
          ttlDifferences: plan.comparison.ttlDifferences.length,
        },
      }, { archiveDir: args.archiveDir });
      console.log(JSON.stringify({
        afterSnapshotId: afterSnapshot.id,
        beforeSnapshotId: before.id,
        operationId: operation.id,
        operations,
        zone,
      }, null, 2));
    });
  }
  if (sub === 'rollback-plan') {
    const zone = required(args, 'zone');
    const snapshot = await archive.readSnapshot(zone, required(args, 'snapshot'), { archiveDir: args.archiveDir });
    return withClient(args, async (client) => {
      const inspected = await client.inspectZone(zone);
      const plan = archive.rollbackPlan(snapshot, inspected.records);
      if (args.json) console.log(JSON.stringify(plan, null, 2));
      else console.log(JSON.stringify(archive.summarizeRollbackPlan(plan), null, 2));
      await writeRollbackReport(args.report, zone, plan);
      if (plan.add.length || plan.delete.length || plan.ttlReplacements.length) process.exitCode = 2;
    });
  }
  if (sub === 'rollback-records') {
    const zone = required(args, 'zone');
    if (!args.execute) throw new Error('rollback-records is dry-run by default; use rollback-plan or pass --execute with confirmations.');
    if (args.confirmZone !== zone || args.confirmRollback !== 'ROLLBACK_RECORDS') {
      throw new Error(`Missing --confirm-zone ${zone} --confirm-rollback ROLLBACK_RECORDS`);
    }
    const snapshot = await archive.readSnapshot(zone, required(args, 'snapshot'), { archiveDir: args.archiveDir });
    return withClient(args, async (client) => {
      const inspected = await client.inspectZone(zone);
      const before = await archiveSnapshot(zone, 'pre-rollback-records', inspected.records, args, {
        command: 'he rollback-records',
        targetSnapshotId: snapshot.id,
      });
      const plan = archive.rollbackPlan(snapshot, inspected.records);
      const operations = [];
      for (const record of plan.delete) {
        const result = await client.deleteRecord(inspected.zoneId, record, { confirmDelete: 'DELETE_RECORD' });
        operations.push({ action: 'delete', key: recordLine(record), result });
      }
      for (const replacement of plan.ttlReplacements) {
        const deleted = await client.deleteRecord(inspected.zoneId, replacement.actual, { confirmDelete: 'DELETE_RECORD' });
        operations.push({ action: 'delete-for-ttl-replacement', key: replacement.key, result: deleted });
        const added = await client.addRecord(inspected.zoneId, replacement.desired);
        operations.push({ action: 'add-for-ttl-replacement', key: replacement.key, result: added });
      }
      for (const item of plan.add) {
        const result = await client.addRecord(inspected.zoneId, item.record);
        operations.push({ action: 'add', key: item.key, result });
      }
      const after = await client.inspectZone(zone);
      const afterSnapshot = await archiveSnapshot(zone, 'post-rollback-records', after.records, args, {
        beforeSnapshotId: before.id,
        command: 'he rollback-records',
        targetSnapshotId: snapshot.id,
      });
      const operation = await archive.writeOperation(zone, 'rollback-records', {
        afterSnapshotId: afterSnapshot.id,
        beforeSnapshotId: before.id,
        operations,
        targetSnapshotId: snapshot.id,
      }, { archiveDir: args.archiveDir });
      console.log(JSON.stringify({
        afterSnapshotId: afterSnapshot.id,
        beforeSnapshotId: before.id,
        operationId: operation.id,
        operations,
        targetSnapshotId: snapshot.id,
        zone,
      }, null, 2));
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
      const beforeConversion = await client.inspectSlaveConversion(zone);
      const before = await archive.createSnapshot(zone, 'pre-convert-slave', [], {
        command: 'he convert-slave',
        conversion: beforeConversion,
      }, { archiveDir: args.archiveDir });
      const result = await client.convertSlave(zone, {
        confirmConvert: args.confirmConvert,
        confirmZone: args.confirmZone,
      });
      const operation = await archive.writeOperation(zone, 'convert-slave', {
        beforeSnapshotId: before.id,
        result,
      }, { archiveDir: args.archiveDir });
      console.log(JSON.stringify({ beforeSnapshotId: before.id, operationId: operation.id, result }, null, 2));
    });
  }
  throw new Error(usage());
}

async function commandArchive(args) {
  const sub = args._[1];
  const zone = required(args, 'zone');
  if (sub === 'list') {
    const snapshots = await archive.listSnapshots(zone, { archiveDir: args.archiveDir });
    if (args.json) console.log(JSON.stringify(snapshots, null, 2));
    else {
      for (const snapshot of snapshots) {
        console.log(`${snapshot.id} ${snapshot.capturedAt} records=${snapshot.recordCount} source=${snapshot.source}`);
      }
    }
    return;
  }
  if (sub === 'show') {
    const snapshot = await archive.readSnapshot(zone, required(args, 'snapshot'), { archiveDir: args.archiveDir });
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  if (sub === 'operations') {
    const operations = await archive.listOperations(zone, { archiveDir: args.archiveDir });
    if (args.json) console.log(JSON.stringify(operations, null, 2));
    else {
      for (const operation of operations) {
        console.log(`${operation.id} ${operation.recordedAt} action=${operation.action} before=${operation.beforeSnapshotId || '-'}`);
      }
    }
    return;
  }
  if (sub === 'operation') {
    const operation = await archive.readOperation(zone, required(args, 'operation'), { archiveDir: args.archiveDir });
    console.log(JSON.stringify(operation, null, 2));
    return;
  }
  throw new Error(usage());
}

async function commandTestDomains(args) {
  const sub = args._[1];
  if (sub !== 'list') throw new Error(usage());
  const domains = await readTestDomains({ path: args.path });
  if (args.json) console.log(JSON.stringify(domains, null, 2));
  else {
    for (const domain of domains) console.log(domain);
  }
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
  if (command === 'archive') return commandArchive(args);
  if (command === 'test-domains') return commandTestDomains(args);
  throw new Error(usage());
}

module.exports = { main, usage };
