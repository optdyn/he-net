# Troubleshooting

Use this guide to diagnose common setup, login, planning, and verification
failures.

## `HE.net credentials file not found`

Cause:

* No `HE_NET_USERNAME` and `HE_NET_PASSWORD` are set.
* `HE_NET_CREDS` points to a missing file.
* The default `./he-net-creds.txt` file does not exist.

Fix:

```bash
export HE_NET_USERNAME='your_username_here'
export HE_NET_PASSWORD='your_password_here'
```

Or:

```bash
export HE_NET_CREDS="$PWD/he-net-creds.txt"
```

## `Unsupported HE.net credentials format`

Cause:

* The credential file is not JSON, key/value, netrc, `username:password`, or
  two-line username/password text.

Fix:

```text
username=your_username_here
password=your_password_here
```

## `HE.net login did not reach an authenticated page`

Cause:

* Credentials are incorrect.
* HE.net changed the login page.
* The account requires an interaction the adapter does not automate.

Fix:

```bash
node bin/he-net.js he list-zones --headful
```

Expected output:

```text
active example.com zoneid=...
```

If headful login succeeds, reuse the browser profile for later runs.

## `Expected exactly one active zone example.com; found 0`

Cause:

* The zone is not present in the active zone table.
* The zone is a slave zone.
* The supplied name differs from the exact zone in HE.net.

Fix:

```bash
node bin/he-net.js he list-zones --json
```

Then rerun the command with the exact zone name.

## `Exact zone mismatch`

Cause:

* A confirmation token or HE.net row did not exactly match the target zone.

Fix:

```bash
node bin/he-net.js he apply-records \
  --zone example.com \
  --desired records/example.com.json \
  --execute \
  --confirm-zone example.com \
  --confirm-apply APPLY_RECORDS
```

> [!IMPORTANT]
> Do not bypass exact-zone checks. They prevent accidental mutation of a
> different domain.

## `apply-records is dry-run by default`

Cause:

* `apply-records` was run without `--execute`.

Fix:

1.  Run `plan-records`.
2.  Review the report.
3.  Run `apply-records` with `--execute`, `--confirm-zone`, and
    `--confirm-apply APPLY_RECORDS`.

## `TTL ... is not in the known HE.net dropdown values`

Cause:

* The desired record TTL is not one of the known HE.net UI dropdown values.

Known values:

```text
300, 900, 1800, 3600, 7200, 14400, 28800, 38400, 43200, 86400
```

Fix:

* Change the desired record TTL to a supported value.

## `dig` Not Found

Cause:

* The system does not have the DNS lookup tool used by `dns verify`.

Fix on Debian or Ubuntu:

```bash
sudo apt-get update
sudo apt-get install dnsutils
```

Fix on Fedora:

```bash
sudo dnf install bind-utils
```

## `dns verify` Returns `fail`

Cause:

* The authoritative nameserver did not answer within the timeout.
* The record has not propagated to the authoritative server.
* The desired owner/type pair does not exist.

Fix:

```bash
dig @ns1.he.net www.example.com. A +norecurse +noall +answer
dig @ns2.he.net www.example.com. A +norecurse +noall +answer
```

Expected output:

```text
www.example.com. 300 IN A 203.0.113.10
```

## `plan-records` Exits With Code 2

Cause:

* Missing or extra records were found.

Fix:

* Review the report.
* Add missing records only if the plan is expected.
* Handle extra records manually until guarded CLI deletion is implemented.

