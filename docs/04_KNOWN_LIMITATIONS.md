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

## Partial Mutation Coverage

`he-net he apply-records` currently adds missing records only.

It does not currently:

* delete extra records from the CLI,
* update TTL values in place,
* reconcile locked records,
* apply a full transactional diff,
* roll back after a partial HE.net form failure.

> [!WARNING]
> Extra records and TTL differences appear in plans and reports, but an apply
> run does not automatically remove or update them.

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

## MCP Mutation Not Exposed

The MCP server exposes parse, workflow, compare, inspect, plan, and verify
tools. It does not expose apply or delete tools.

Rationale:

* Agent-facing mutation requires a stronger confirmation model.
* The CLI remains the mutation surface.

## Test Domain Restrictions

`lnux.online` may be used for live testing only after explicit approval for a
concrete operation.

Do not run live mutation commands against this domain without that approval.

## Credentials And Local Profiles

Credential files, cookies, Playwright profiles, raw session HTML, and
unredacted screenshots must remain outside commits.

Recommended local paths:

```text
he-net-creds.txt
.local/he-net-profile/
```

