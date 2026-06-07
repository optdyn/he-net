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
- `plan_records`
- `inspect_zone`
- `verify_records`

`apply_records` is intentionally gated and requires confirmation arguments.

## Testing Domain

The repository may use `lnux.online` as a test domain when explicitly requested. No live mutation is performed by tests.
