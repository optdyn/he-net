# Execution Guide

This guide lists the commands needed to install, run, test, and operate the
toolkit.

## Requirements

| Requirement | Purpose |
| --- | --- |
| Node.js | Runs the CLI, library, tests, and MCP server. |
| npm | Installs dependencies and runs scripts. |
| Playwright browser runtime | Automates `dns.he.net`. |
| `dig` | Performs authoritative DNS verification. |
| Python and Ansible | Optional; runs Ansible modules and syntax checks. |

## Install

```bash
npm install
```

Install Playwright browser dependencies if needed:

```bash
npx playwright install chromium
```

Expected output:

```text
# npm installs dependencies and Playwright downloads Chromium if absent.
```

## Validate

```bash
npm run validate
```

Equivalent expanded commands:

```bash
npm run check
npm test
```

Expected output:

```text
# JavaScript syntax checks complete.
# node --test reports all tests passing.
```

Run opt-in read-only live integration tests against domains in
`./test-domains.txt`:

```bash
HE_NET_LIVE_READ_TESTS=1 npm test
```

> [!IMPORTANT]
> The live integration test is read-only. Mutation integration tests are not run
> automatically because DNS mutations require explicit concrete approval.

Run guarded live mutation rollback tests against domains in
`./test-domains.txt`:

```bash
HE_NET_LIVE_MUTATION_TESTS=1 \
HE_NET_CONFIRM_LIVE_MUTATION=ROLLBACK_TEST_DOMAINS \
npm test
```

The mutation test snapshots each configured zone, adds a temporary TXT record,
and rolls the zone back to the original snapshot in a `finally` block.

## CLI Help

```bash
node bin/he-net.js --help
```

Expected output:

```text
Usage:
  he-net zone parse --origin ZONE. --input raw.txt --records-json records.json [--zone-file zone.txt]
  ...
```

## Parse Zone Capture

```bash
node bin/he-net.js zone parse \
  --origin example.com. \
  --input test/fixtures/sample-zone.txt \
  --records-json records/example.com.json \
  --zone-file zones/example.com.zone \
  --sorted
```

## Generate Workflow Records

```bash
node bin/he-net.js workflow website \
  --zone example.com \
  --apex-a 203.0.113.10 \
  --www-cname example.net \
  --output records/example.com.website.json
```

```bash
node bin/he-net.js workflow google-workspace \
  --zone example.com \
  --dmarc-policy none \
  --dmarc-rua dmarc@example.com \
  --output records/example.com.google.json
```

```bash
node bin/he-net.js workflow github-pages \
  --zone example.com \
  --github-user example-user \
  --github-verification github-pages-placeholder \
  --output records/example.com.github-pages.json
```

## Credentials

Environment variable form:

```bash
export HE_NET_USERNAME='your_username_here'
export HE_NET_PASSWORD='your_password_here'
```

Credential file form:

```bash
export HE_NET_CREDS="$PWD/he-net-creds.txt"
```

Supported credential file formats:

```text
username=your_username_here
password=your_password_here
```

```json
{
  "username": "your_username_here",
  "password": "your_password_here"
}
```

## HE.net Read Commands

```bash
node bin/he-net.js he list-zones --json
```

```bash
node bin/he-net.js he inspect-zone \
  --zone example.com \
  --report reports/example.com-inspect.md \
  --json
```

```bash
node bin/he-net.js he plan-records \
  --zone example.com \
  --desired records/example.com.website.json \
  --report reports/example.com-plan.md \
  --json
```

## HE.net Mutation Commands

> [!CAUTION]
> Replace `example.com` only with the exact intended zone. Do not use these
> commands with wildcard or partial zone names.

```bash
node bin/he-net.js he apply-records \
  --zone example.com \
  --desired records/example.com.website.json \
  --execute \
  --confirm-zone example.com \
  --confirm-apply APPLY_RECORDS
```

Successful mutation commands write local snapshots and operation logs under
`.local/he-net-archives` unless `--archive-dir` is supplied.

List snapshots:

```bash
node bin/he-net.js archive list --zone example.com
```

Show a snapshot:

```bash
node bin/he-net.js archive show \
  --zone example.com \
  --snapshot SNAPSHOT_ID
```

List operation history:

```bash
node bin/he-net.js archive operations --zone example.com
```

Show one operation:

```bash
node bin/he-net.js archive operation \
  --zone example.com \
  --operation OPERATION_ID
```

Plan rollback to a snapshot:

```bash
node bin/he-net.js he rollback-plan \
  --zone example.com \
  --snapshot SNAPSHOT_ID \
  --report reports/example.com-rollback.md
```

Apply rollback:

```bash
node bin/he-net.js he rollback-records \
  --zone example.com \
  --snapshot SNAPSHOT_ID \
  --execute \
  --confirm-zone example.com \
  --confirm-rollback ROLLBACK_RECORDS
```

```bash
node bin/he-net.js he convert-slave \
  --zone example.com \
  --execute \
  --confirm-zone example.com \
  --confirm-convert CONVERT
```

## Authoritative Verification

```bash
node bin/he-net.js dns verify \
  --records records/example.com.website.json \
  --nameserver ns1.he.net \
  --nameserver ns2.he.net
```

Expected output:

```text
ok ns1.he.net www.example.com. A answers=1
ok ns2.he.net www.example.com. A answers=1
```

## MCP Server

```bash
node bin/he-net-mcp.js
```

When run interactively, expected output includes the tool list:

```json
{
  "tools": [
    {
      "name": "parse_zone"
    }
  ]
}
```

## Ansible Syntax Checks

Run Python syntax checks:

```bash
python3 -m py_compile \
  ansible_collections/optdyn/he_net/plugins/modules/he_net_record.py \
  ansible_collections/optdyn/he_net/plugins/modules/he_net_zone.py
```

Run Ansible module syntax checks when Ansible is installed:

```bash
ansible-doc -t module optdyn.he_net.he_net_record
ansible-doc -t module optdyn.he_net.he_net_zone
```
