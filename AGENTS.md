# AGENTS.md - HE.net Automation Project

## Mission

Build reusable automation for HE.net Free DNS, including a core library, CLI, Ansible collection, MCP server, and agent-friendly workflows.

## Rules

- Treat DNS as production infrastructure.
- Use exact FQDN equality for zone selection. Never use wildcard, substring, prefix, suffix, or fuzzy matching for destructive operations.
- Keep all mutation commands dry-run by default.
- Require explicit confirmation tokens for apply/delete/convert operations.
- Do not commit credentials, cookies, browser profiles, raw session HTML with secrets, or unredacted screenshots.
- Use HE.net web automation only as an adapter. Desired state must come from local structured records and diffs.
- Query authoritative nameservers directly for verification.
- Preserve raw zone captures as immutable inputs.

## Release Process

When asked to release:

1. Run `npm run validate`.
2. Run Ansible module syntax checks if Python is available.
3. Commit changes.
4. Tag a semantic version.
5. Push branch and tag.
6. Create a GitHub release.

## Test Domain

`lnux.online` may be used for live testing only when the user explicitly approves a concrete operation.
