# Learning Guide

This guide moves from local parsing to live HE.net planning. Do not run live
mutation commands until you understand the safety model in
[Known limitations](04_KNOWN_LIMITATIONS.md).

## 1. Install Dependencies

```bash
npm install
```

Expected output:

```text
added ... packages
```

Run the local validation suite:

```bash
npm run validate
```

Expected output:

```text
# node --test output with all tests passing
```

## 2. Parse A Zone Capture

Use a preserved raw zone capture as an immutable input.

```bash
node bin/he-net.js zone parse \
  --origin example.com. \
  --input test/fixtures/sample-zone.txt \
  --records-json records/example.com.json \
  --zone-file zones/example.com.zone
```

Expected output:

```text
# No output on success when --records-json or --zone-file is supplied.
```

The JSON output can be reviewed and committed if it does not contain secrets.

## 3. Generate Desired Records

Generate a simple website desired-state file:

```bash
node bin/he-net.js workflow website \
  --zone example.com \
  --apex-a 203.0.113.10 \
  --www-cname example.net \
  --output records/example.com.website.json
```

Generate Google Workspace records:

```bash
node bin/he-net.js workflow google-workspace \
  --zone example.com \
  --output records/example.com.google-workspace.json
```

Expected output:

```text
# No output on success. The requested JSON file is created.
```

## 4. Compare Records Locally

In Node.js, use the core library without touching HE.net:

```bash
node - <<'NODE'
const { dns } = require('./src');
const desired = [{ owner: 'www.example.com.', type: 'A', ttl: 300, rdata: '203.0.113.10' }];
const actual = [{ name: 'www.example.com', type: 'A', ttl: '300', priority: '0', content: '203.0.113.10' }];
console.log(JSON.stringify(dns.compareRecords(desired, actual), null, 2));
NODE
```

Expected output:

```json
{
  "missing": [],
  "ttlDifferences": []
}
```

The actual output also includes `comparisons`, `extras`, and
`providerManaged`.

## 5. Configure HE.net Credentials

Use environment variables:

```bash
export HE_NET_USERNAME='your_username_here'
export HE_NET_PASSWORD='your_password_here'
```

Or use a local ignored credential file:

```bash
cat > he-net-creds.txt <<'EOF'
username=your_username_here
password=your_password_here
EOF
```

> [!CAUTION]
> Do not commit `he-net-creds.txt`, Playwright profile directories, raw session
> HTML, or unredacted screenshots.

## 6. Inspect A Live Zone

```bash
node bin/he-net.js he inspect-zone \
  --zone example.com \
  --report reports/example.com-inspect.md
```

Expected output:

```text
# No output unless --json is supplied. The report file is written.
```

## 7. Plan A Change

```bash
node bin/he-net.js he plan-records \
  --zone example.com \
  --desired records/example.com.website.json \
  --report reports/example.com-plan.md
```

Expected output:

```text
# Exit code 0 when no add/delete differences are found.
# Exit code 2 when missing or extra records are found.
```

## 8. Apply Only After Review

```bash
node bin/he-net.js he apply-records \
  --zone example.com \
  --desired records/example.com.website.json \
  --execute \
  --confirm-zone example.com \
  --confirm-apply APPLY_RECORDS
```

Expected output:

```json
{
  "operations": [
    {
      "action": "add"
    }
  ],
  "zone": "example.com"
}
```

## 9. Verify Authoritative DNS

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

