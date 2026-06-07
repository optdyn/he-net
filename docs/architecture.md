# Architecture

## Components

- `src/core`: DNS parsing, normalization, comparison, and authoritative verification.
- `src/he`: HE.net web adapter built on Playwright.
- `src/cli`: operator command-line interface.
- `src/workflows`: reusable desired-state record templates.
- `src/mcp`: MCP server for agent workflows.
- `ansible_collections/optdyn/he_net`: Ansible modules and roles.

## HE.net Boundary

HE.net Free DNS has useful web UI features and dynamic DNS update support, but
does not expose a documented full CRUD API for arbitrary zone management. The
adapter therefore automates reviewed form behavior while keeping all desired
state and validation outside the UI.

## Mutation Flow

1. Build desired records.
2. Inspect exact target zone.
3. Compare desired and actual records.
4. Write a plan/report.
5. Apply only with `--execute` and exact confirmation strings.
6. Verify authoritative answers directly.

## Exact Matching

All live operations must use exact normalized FQDN equality. The implementation
must never operate on broad selectors that could match similar domains such as
`example.co` and `example.com`.
