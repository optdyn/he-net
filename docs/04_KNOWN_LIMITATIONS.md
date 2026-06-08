# Known Limitations

This project is useful but intentionally conservative. The current limitations
are operationally important because DNS changes can affect production traffic.

## HE.net Web UI Dependency

The HE.net adapter uses Playwright against `dns.he.net`.

Impact:

* HE.net page markup changes can break selectors.
* Browser automation requires an installed browser runtime.
* Login flows can fail because of MFA, rate limiting, account policy changes,
  or site availability.

Mitigation:

* Keep desired state in local structured files.
* Use `plan-records` before every mutation.
* Treat UI inspection output as an adapter result, not as source control.

## Mutation And Rollback Coverage

`he-net he apply-records` currently adds missing records only. Rollback is the
full reconcile path and can add records, delete extra records, and replace
records with TTL differences by deleting and re-adding them.

Normal apply does not currently:

* delete extra records from the CLI,
* update TTL values in place,
* reconcile locked records,
* apply a full transactional diff,
* roll back after a partial HE.net form failure.

> [!WARNING]
> Extra records and TTL differences appear in plans and reports, but an apply
> run does not automatically remove or update them.

Rollback is not transactional. If HE.net accepts some form submissions and then
rejects a later one, the operation log and pre-rollback snapshot remain the
source for recovery planning.

## Authoritative Verification Is Presence-Oriented

`dns verify` checks whether authoritative queries return answers for each
unique owner/type pair.

It does not currently:

* compare every returned answer to every desired `rdata`,
* validate DNSSEC,
* validate propagation outside HE.net authoritative nameservers,
* guarantee recursive resolver cache behavior.

## Limited DNS Record Semantics

The parser handles common BIND-style records and special parsing fields for
`MX`, `SRV`, and `AFSDB`.

Known gaps:

* No exhaustive RFC-aware validation for every record type.
* No semantic validation for provider-specific constraints beyond selected HE.net
  TTL dropdown values.
* No automatic DKIM generator for Google Workspace.

## MCP Mutation Scope

The MCP server exposes guarded mutation tools for apply, delete, rollback, and
slave conversion. These tools are dry-run by default and require exact zone
confirmation plus operation-specific confirmation tokens before they mutate
HE.net state.

Known gaps:

* `apply_records` adds missing desired records only; it reports extras and TTL
  differences but does not automatically reconcile them.
* Direct `delete_records` requires exact record matches from the inspected zone
  and does not perform fuzzy matching.
* Browser automation still depends on HE.net markup and login behavior.

## Test Domain Restrictions

Live test domains come from local `./test-domains.txt` configuration. The file
may also be a symlink to a private domain list.

Do not run live mutation commands against any configured test domain without a
specific operator request and the normal confirmation gates.

## Credentials And Local Profiles

Credential files, cookies, Playwright profiles, raw session HTML, and
unredacted screenshots must remain outside commits.

Recommended local paths:

```text
he-net-creds.txt
.local/he-net-profile/
```
