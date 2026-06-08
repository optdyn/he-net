# HE.net DNS Automation Toolkit

Automation toolkit for HE.net Free DNS. It provides:

- A reusable Node.js core library for DNS zone parsing, record normalization, diffs, and safety checks.
- A guarded Playwright-backed HE.net web adapter for logged-in `dns.he.net` workflows.
- A CLI for planning, applying, verifying, and reporting DNS changes.
- An Ansible collection scaffold at `optdyn.he_net`.
- An MCP server so agents can inspect, plan, and apply DNS changes with explicit confirmations.

HE.net does not publish a general full CRUD DNS management API for Free DNS. This project treats the web UI as an adapter and keeps desired state, validation, exact-domain matching, and reporting in local code.

## Safety Model

- Dry-run by default.
- Destructive operations require exact zone equality and confirmation tokens.
- No wildcard, substring, prefix, or fuzzy matching for zone selection.
- Credentials are read from environment variables or ignored files and are never written to reports.
- Reports are redacted before persistence.
- Live DNS verification queries authoritative nameservers directly.
- Mutation commands write local archive snapshots and operation history under
  `.local/he-net-archives` by default.

## Supported Record Types

The CLI create path supports the record types published by HE.net Hosted DNS:
`A`, `AAAA`, `AFSDB`, `ALIAS`, `CAA`, `CNAME`, `HINFO`, `LOC`, `MX`,
`NAPTR`, `NS`, `PTR`, `RP`, `SPF`, `SRV`, `SSHFP`, and `TXT`.

Unsupported record types are rejected before a live form submission.

## Credentials

Supported credential sources:

- `HE_NET_USERNAME` and `HE_NET_PASSWORD`
- `HE_NET_CREDS=/path/to/file`
- `./he-net-creds.txt`

Credential files may be JSON, key/value, netrc, `username:password`, or two-line username/password text.

## CLI Examples

Parse a raw HE.net AXFR capture:

```bash
he-net zone parse --origin example.com. --input example-zone.txt --records-json records/example.com.json --zone-file zones/example.com.zone
```

Inspect a zone in the logged-in HE.net account:

```bash
he-net he inspect-zone --zone example.com --report reports/example.com.md
```

Plan a record change:

```bash
he-net he plan-records --zone example.com --desired records/example.com.desired.json --report reports/example.com-plan.md
```

Apply a record change:

```bash
he-net he apply-records --zone example.com --desired records/example.com.desired.json --execute --confirm-zone example.com --confirm-apply APPLY_RECORDS
```

List archived snapshots:

```bash
he-net archive list --zone example.com
```

Plan rollback to a historical snapshot:

```bash
he-net he rollback-plan --zone example.com --snapshot SNAPSHOT_ID --report reports/example.com-rollback.md
```

Apply rollback:

```bash
he-net he rollback-records --zone example.com --snapshot SNAPSHOT_ID --execute --confirm-zone example.com --confirm-rollback ROLLBACK_RECORDS
```

Verify authoritative answers:

```bash
he-net dns verify --records records/example.com.desired.json --nameserver ns1.he.net --nameserver ns2.he.net
```

## Ansible

The collection lives under `ansible_collections/optdyn/he_net`.

Example:

```yaml
- name: Plan HE.net records
  optdyn.he_net.he_net_record:
    zone: example.com
    desired:
      - owner: www.example.com.
        type: A
        ttl: 300
        rdata: 203.0.113.10
    state: present
    execute: false
```

## MCP Server

Run:

```bash
he-net-mcp
```

Tools exposed:

- `parse_zone`
- `workflow_records`
- `compare_records`
- `verify_records`
- `list_zones`
- `inspect_zone`
- `plan_records`
- `apply_records`
- `delete_records`
- `rollback_plan`
- `rollback_records`
- `inspect_slave_conversion`
- `convert_slave`
- `archive_list_snapshots`
- `archive_show_snapshot`
- `archive_list_operations`
- `archive_show_operation`

Mutation tools are dry-run by default and require exact `zone`, `execute=true`,
and operation-specific confirmation tokens such as `APPLY_RECORDS`,
`DELETE_RECORDS`, `ROLLBACK_RECORDS`, or `CONVERT`.

### VS Code MCP Installer

Install the local MCP server into the current Linux user's VS Code MCP
configuration:

```bash
npm run install:vscode-mcp
```

Dry-run first:

```bash
npm run install:vscode-mcp -- --dry-run
```

Install to a workspace-local `.vscode/mcp.json` instead:

```bash
npm run install:vscode-mcp -- --scope workspace
```

Add a credentials file path to the VS Code MCP server environment:

```bash
npm run install:vscode-mcp -- --creds-path "$PWD/he-net-creds.txt"
```

The installer preserves existing MCP server entries, backs up an existing
`mcp.json` to `mcp.json.bak`, installs npm dependencies, installs Playwright
Chromium, and writes a VS Code `servers.heNetDns` stdio entry.

## Test Domains

Live test domains are local operator configuration. Copy
`test-domains.example.txt` to `./test-domains.txt`, or symlink
`./test-domains.txt` to a private file with one domain name per line. Inspect it
with:

```bash
he-net test-domains list
```

No live mutation is performed by automated tests.

Run read-only live integration tests against configured test domains:

```bash
HE_NET_LIVE_READ_TESTS=1 npm test
```

Run guarded live mutation rollback tests against configured test domains:

```bash
HE_NET_LIVE_MUTATION_TESTS=1 \
HE_NET_CONFIRM_LIVE_MUTATION=ROLLBACK_TEST_DOMAINS \
npm test
```

The mutation rollback test snapshots each configured test domain, adds a
temporary TXT record, and rolls the zone back to the original snapshot in a
`finally` block.
