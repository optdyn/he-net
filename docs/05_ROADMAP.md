# Roadmap

The roadmap is organized by implementation maturity and operational risk.

## Completed

| Capability | Evidence |
| --- | --- |
| Core zone parsing | `src/core/zone-parser.js`, `test/core.test.js` |
| Record normalization and comparison | `src/core/dns.js`, `test/core.test.js` |
| Workflow record generators | `src/workflows/presets.js` |
| CLI command router | `src/cli/main.js` |
| HE.net login and zone inspection | `src/he/auth.js`, `src/he/client.js` |
| Guarded add-record apply path | `HeNetClient.addRecord()` and `he-net he apply-records` |
| Slave conversion inspection and conversion path | `inspectSlaveConversion()` and `convertSlave()` |
| Authoritative verification | `verifyAuthoritative()` |
| MCP server with guarded operation tools | `src/mcp/server.js` |
| Ansible collection scaffold | `ansible_collections/optdyn/he_net` |

## Near-Term

1.  Add fixture-backed tests for CLI workflow output.
2.  Add tests for credential parsing formats.
3.  Add tests for MCP `tools/list` and `tools/call` JSON-RPC behavior.
4.  Improve `dns verify` to compare expected RDATA against authoritative
    answers.
5.  Add report sections for TTL differences and provider-managed records.

## Medium-Term

1.  Implement guarded TTL update behavior.
2.  Implement guarded delete behavior through the CLI with
    `DELETE_RECORD`-style confirmation.
3.  Add a complete reconcile plan format that separates add, update, delete,
    skipped, and provider-managed actions.
4.  Add local JSON schema validation for desired record files.
5.  Add generated Ansible documentation examples.

## Longer-Term

1.  Add browser-selector contract tests with saved redacted HE.net fixtures.
2.  Add import workflows for preserved raw zone captures.
3.  Add release automation for npm package, Ansible collection, and GitHub
    release artifacts.
4.  Add multi-zone planning with exact per-zone confirmation tokens.

## Out Of Scope For Now

* Wildcard or fuzzy zone selection.
* Mutations without local desired-state files.
* Storing credentials or browser state in repository files.
* Treating HE.net UI pages as canonical desired state.
