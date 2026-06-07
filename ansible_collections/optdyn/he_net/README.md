# optdyn.he_net

Ansible collection for HE.net Free DNS automation.

The modules delegate to the `he-net` CLI so parsing, exact-zone matching, dry-run
behavior, and Playwright form automation stay in one tested implementation.

## Modules

- `he_net_zone`: inspect, parse, or plan zone workflows.
- `he_net_record`: plan or apply record state.

Live mutation requires `execute: true` plus explicit confirmation values.
