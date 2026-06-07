# Validation Checklist

Use this checklist before trusting a change, before a release, and after
documentation updates.

## Automated Validation

| Check | Command | Expected result |
| --- | --- | --- |
| JavaScript syntax | `npm run check` | Exit code `0`. |
| Unit tests | `npm test` | All `node:test` tests pass. |
| Full validation | `npm run validate` | Syntax checks and tests pass. |
| Python syntax | `python3 -m py_compile ansible_collections/optdyn/he_net/plugins/modules/he_net_record.py ansible_collections/optdyn/he_net/plugins/modules/he_net_zone.py` | Exit code `0`. |
| CLI help | `node bin/he-net.js --help` | Usage text is printed. |
| MCP tool list | `node bin/he-net-mcp.js` | JSON tool list is printed when interactive. |

## Documentation Validation

1.  Confirm every numbered file exists:

    ```bash
    ls docs/0*_*.md docs/10_FINAL_REPORT.md
    ```

2.  Confirm internal links point to existing docs:

    ```bash
    node - <<'NODE'
    const fs = require('fs');
    const path = require('path');
    let failed = false;
    for (const file of fs.readdirSync('docs').filter((name) => name.endsWith('.md'))) {
      const text = fs.readFileSync(path.join('docs', file), 'utf8');
      for (const match of text.matchAll(/\[[^\]]+\]\(([^)#][^)]+\.md)(?:#[^)]+)?\)/g)) {
        const target = path.join('docs', match[1]);
        if (!fs.existsSync(target)) {
          console.error(`${file}: missing ${match[1]}`);
          failed = true;
        }
      }
    }
    process.exit(failed ? 1 : 0);
    NODE
    ```

3.  Confirm docs do not contain obvious credential placeholders with real
    values:

    ```bash
    rg -n "password=|HE_NET_PASSWORD|cookie|session" docs
    ```

    Expected result:

    ```text
    # Only placeholder or safety-instruction lines are shown.
    ```

## Local Non-Live Functional Checks

Parse a fixture:

```bash
node bin/he-net.js zone parse \
  --origin example.com. \
  --input test/fixtures/sample-zone.txt
```

Expected output:

```json
{
  "origin": "example.com.",
  "records": []
}
```

The actual output includes parsed records, header, and analysis details.

Generate workflow records:

```bash
node bin/he-net.js workflow website \
  --zone example.com \
  --apex-a 203.0.113.10 \
  --www-cname example.net \
  --output /tmp/example.website.json
```

Expected output:

```text
# Exit code 0 and /tmp/example.website.json exists.
```

## Live Read-Only Checks

> [!IMPORTANT]
> These commands require HE.net credentials and network access. They do not
> mutate DNS state.

List zones:

```bash
node bin/he-net.js he list-zones --json
```

Inspect an exact zone:

```bash
node bin/he-net.js he inspect-zone \
  --zone example.com \
  --report reports/example.com-inspect.md
```

Plan desired records:

```bash
node bin/he-net.js he plan-records \
  --zone example.com \
  --desired records/example.com.json \
  --report reports/example.com-plan.md
```

## Live Mutation Checklist

Do not mutate DNS unless all items are true:

* The desired records are reviewed in a local structured file.
* The target zone name is exact.
* The plan report was reviewed.
* The operation is approved for the concrete zone.
* The command includes the required confirmation token.
* A verification command is ready to run immediately afterward.

Apply missing records:

```bash
node bin/he-net.js he apply-records \
  --zone example.com \
  --desired records/example.com.json \
  --execute \
  --confirm-zone example.com \
  --confirm-apply APPLY_RECORDS
```

Verify authoritative answers:

```bash
node bin/he-net.js dns verify \
  --records records/example.com.json
```

