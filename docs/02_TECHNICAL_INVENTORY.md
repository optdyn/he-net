# Technical Inventory

This inventory maps repository files to public interfaces, data structures, and
operational commands.

## Package

| Item | Value |
| --- | --- |
| Package name | `@optdyn/he-net` |
| Version | `0.1.0` |
| Runtime module type | CommonJS |
| Main export | `src/index.js` |
| CLI binaries | `he-net`, `he-net-mcp` |
| Runtime dependency | `playwright` |
| Test command | `npm test` |
| Validation command | `npm run validate` |

## Public Node.js Exports

`src/index.js` exports three namespaces:

```js
module.exports = {
  dns: require('./core/dns'),
  zoneParser: require('./core/zone-parser'),
  workflows: require('./workflows/presets'),
};
```

## Core DNS API

| Function or constant | File | Purpose |
| --- | --- | --- |
| `HE_NAMESERVERS` | `src/core/dns.js` | Default HE.net authoritative nameservers. |
| `normalizeName(value)` | `src/core/dns.js` | Lowercase and remove trailing dot. |
| `fqdn(value)` | `src/core/dns.js` | Ensure a trailing dot. |
| `assertExactZone(actual, expected)` | `src/core/dns.js` | Enforce exact normalized zone equality. |
| `normalizeContent(value)` | `src/core/dns.js` | Normalize RDATA for comparison keys. |
| `recordParts(record)` | `src/core/dns.js` | Split MX, SRV, TXT, and generic records into content and priority. |
| `recordKey(record)` | `src/core/dns.js` | Build desired-state comparison keys. |
| `uiRecordKey(record)` | `src/core/dns.js` | Build HE.net UI-state comparison keys. |
| `compareRecords(desired, actual, options)` | `src/core/dns.js` | Return missing, extra, TTL, provider-managed, and per-record comparisons. |
| `dig(server, owner, qtype, options)` | `src/core/dns.js` | Execute `dig` for a single authoritative query. |
| `verifyAuthoritative(records, nameservers)` | `src/core/dns.js` | Query authoritative nameservers for each unique owner/type pair. |

### Compare Records Schema

Input desired record:

```json
{
  "owner": "www.example.com.",
  "type": "A",
  "ttl": 300,
  "class": "IN",
  "rdata": "203.0.113.10",
  "rdata_tokens": ["203.0.113.10"]
}
```

Input actual HE.net UI record:

```json
{
  "name": "www.example.com",
  "type": "A",
  "ttl": "300",
  "priority": "0",
  "content": "203.0.113.10",
  "recordId": "123456",
  "locked": false
}
```

Output shape:

```json
{
  "comparisons": [],
  "extras": [],
  "missing": [],
  "providerManaged": [],
  "ttlDifferences": []
}
```

## Zone Parser API

| Function | File | Purpose |
| --- | --- | --- |
| `stripComment(line)` | `src/core/zone-parser.js` | Remove comments outside quoted strings. |
| `logicalRecords(text)` | `src/core/zone-parser.js` | Combine parenthesized records into logical records. |
| `tokenize(text)` | `src/core/zone-parser.js` | Tokenize DNS records while preserving quoted strings. |
| `parseZoneText(text, options)` | `src/core/zone-parser.js` | Parse zone text into origin, header, records, and analysis. |
| `parseZoneFile(path, options)` | `src/core/zone-parser.js` | Read and parse a zone file from disk. |
| `analyzeRecords(records)` | `src/core/zone-parser.js` | Count records and detect CNAME conflicts and stale NS references. |
| `formatRecord(record)` | `src/core/zone-parser.js` | Format a structured record as zone-file text. |
| `toZoneFile(parsed, options)` | `src/core/zone-parser.js` | Serialize parsed records to a generated zone file. |

## HE.net Adapter API

| Method | File | Purpose |
| --- | --- | --- |
| `open()` | `src/he/client.js` | Start a persistent Playwright context and log in if needed. |
| `close()` | `src/he/client.js` | Close the browser context. |
| `listZones()` | `src/he/client.js` | Read active and slave zones from `dns.he.net`. |
| `findExactZone(zone, kind)` | `src/he/client.js` | Find exactly one active or slave zone by exact normalized name. |
| `openActiveZone(zone)` | `src/he/client.js` | Navigate to the exact active zone editor and verify the page caption. |
| `inspectZone(zone)` | `src/he/client.js` | Return zone metadata and UI records. |
| `readRecords()` | `src/he/client.js` | Extract DNS records from the zone editor table. |
| `planRecords(zone, desired)` | `src/he/client.js` | Inspect and compare desired records with actual UI records. |
| `inspectSlaveConversion(zone)` | `src/he/client.js` | Check whether HE.net exposes the exact slave conversion control. |
| `convertSlave(zone, options)` | `src/he/client.js` | Convert a slave zone with `confirmZone` and `confirmConvert=CONVERT`. |
| `addRecord(zoneId, record)` | `src/he/client.js` | Submit a HE.net record-add form for one missing record. |
| `deleteRecord(zoneId, record, options)` | `src/he/client.js` | Delete a non-locked record with `confirmDelete=DELETE_RECORD`. |

## Credential Loader

`src/he/auth.js` supports these credential sources:

| Source | Example |
| --- | --- |
| Environment | `HE_NET_USERNAME` and `HE_NET_PASSWORD` |
| Explicit path | `HE_NET_CREDS=/path/to/he-net-creds.txt` |
| Default local file | `./he-net-creds.txt` |

Supported file formats include JSON, key/value, netrc, `username:password`, and
two-line username/password text.

## CLI Commands

| Command | Side effect | Purpose |
| --- | --- | --- |
| `he-net zone parse` | File output only | Parse a raw zone capture. |
| `he-net workflow google-workspace` | File output only | Generate Google Workspace MX, SPF, and DMARC records. |
| `he-net workflow website` | File output only | Generate apex A/AAAA and optional `www` CNAME records. |
| `he-net workflow github-pages` | File output only | Generate GitHub Pages records. |
| `he-net dns verify` | Network read | Query authoritative nameservers with `dig`. |
| `he-net he list-zones` | HE.net read | List active and slave zones. |
| `he-net he inspect-zone` | HE.net read | Inspect one exact active zone. |
| `he-net he plan-records` | HE.net read | Compare desired records with actual UI records. |
| `he-net he apply-records` | HE.net mutation | Add missing records only after confirmations. |
| `he-net he inspect-convert` | HE.net read | Inspect slave conversion availability. |
| `he-net he convert-slave` | HE.net mutation | Convert a slave zone after confirmations. |

## MCP Tools

`src/mcp/server.js` exposes JSON-RPC tools over stdin/stdout:

| Tool | Required input | Purpose |
| --- | --- | --- |
| `parse_zone` | `text` | Parse zone text. |
| `workflow_records` | `workflow`, `zone` | Generate workflow records. |
| `compare_records` | `desired`, `actual` | Compare supplied record sets locally. |
| `verify_records` | `records` | Verify records through authoritative queries. |
| `inspect_zone` | `zone` | Inspect an exact HE.net active zone. |
| `plan_records` | `zone`, `desired` | Plan changes for an exact HE.net active zone. |

> [!NOTE]
> The MCP server currently exposes read, parse, compare, workflow, and verify
> tools. It does not expose a mutation tool.

## Ansible Modules

| Module | Purpose |
| --- | --- |
| `optdyn.he_net.he_net_record` | Plan or apply desired records by calling `he-net`. |
| `optdyn.he_net.he_net_zone` | List, inspect, or inspect-convert zones by calling `he-net`. |

