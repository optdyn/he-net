# HE.net DNS Automation Toolkit Overview

The HE.net DNS Automation Toolkit provides reusable automation for HE.net Free
DNS while treating DNS as production infrastructure. It includes a Node.js core
library, a command-line interface, a Playwright-backed HE.net web adapter, an
Ansible collection scaffold, and an MCP server for agent-assisted workflows.

HE.net Free DNS does not expose a documented full CRUD API for arbitrary zone
management. This project therefore keeps desired state, diffs, exact-zone
matching, and verification in local structured code, and uses web automation
only as a guarded adapter.

> [!IMPORTANT]
> Mutation commands are dry-run by default. Apply, delete, and convert paths
> require explicit confirmation tokens and exact FQDN equality.

## Goals

| Goal | Current implementation |
| --- | --- |
| Parse raw HE.net or BIND-style zone captures | `src/core/zone-parser.js` and `he-net zone parse` |
| Generate common desired-state records | `src/workflows/presets.js` and `he-net workflow ...` |
| Compare desired records with HE.net UI state | `src/core/dns.js` and `HeNetClient.planRecords()` |
| Apply guarded record additions | `he-net he apply-records` with confirmation gates |
| Verify authoritative DNS answers | `dig` through `src/core/dns.js` |
| Integrate with Ansible | `ansible_collections/optdyn/he_net` |
| Expose agent tools | `src/mcp/server.js` and `he-net-mcp` |

## Safety Model

* Use exact normalized FQDN equality for zone selection.
* Never use wildcard, substring, prefix, suffix, or fuzzy matching for
  destructive operations.
* Keep local desired state in structured records.
* Preserve raw zone captures as immutable inputs.
* Query authoritative HE.net nameservers directly for verification.
* Do not commit credentials, cookies, browser profiles, raw session HTML with
  secrets, or unredacted screenshots.

## Documentation Map

* [Architecture](01_ARCHITECTURE.md)
* [Technical inventory](02_TECHNICAL_INVENTORY.md)
* [Development log](03_DEVELOPMENT_LOG.md)
* [Known limitations](04_KNOWN_LIMITATIONS.md)
* [Roadmap](05_ROADMAP.md)
* [Learning guide](06_LEARNING_GUIDE.md)
* [Execution guide](07_EXECUTION_GUIDE.md)
* [Troubleshooting](08_TROUBLESHOOTING.md)
* [Validation checklist](09_VALIDATION_CHECKLIST.md)
* [Final report](10_FINAL_REPORT.md)

