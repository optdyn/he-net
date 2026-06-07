# Development Log

This log records the current architecture and major design decisions visible in
the repository. It is not a Git history replacement.

## 2026-06-07

### Documentation Suite Generated

Added the UDAS `00_` through `10_` documentation suite under `docs/`.

Rationale:

* The project has multiple operator surfaces: CLI, library, Ansible, and MCP.
* DNS automation needs explicit safety documentation.
* Future contributors need a searchable inventory of modules and commands.

Validation target:

```bash
npm run validate
```

Expected output:

```text
> @optdyn/he-net@0.1.0 validate
> npm run check && npm test
```

### Exact Zone Matching

The HE.net adapter uses exact normalized FQDN equality through
`assertExactZone()` and `findExactZone()`.

Decision:

* Zone selection must require exactly one normalized match.
* Destructive workflows must not use wildcard, substring, prefix, suffix, or
  fuzzy matching.

### Dry-Run By Default

`plan-records` is the normal planning path. `apply-records` requires:

```bash
--execute --confirm-zone example.com --confirm-apply APPLY_RECORDS
```

`convert-slave` requires:

```bash
--execute --confirm-zone example.com --confirm-convert CONVERT
```

Decision:

* Live DNS mutations must be deliberate.
* Confirmation tokens must be explicit and command-specific.

### Web UI As Adapter

The project models HE.net Free DNS as a web automation boundary, not as the
source of desired state.

Decision:

* Desired state is local JSON records.
* HE.net UI state is read and compared.
* Reports and verification are generated locally.

### Authoritative Verification

`verifyAuthoritative()` calls `dig` against authoritative nameservers instead
of relying on recursive resolver caches.

Decision:

* Verification should query HE.net nameservers directly.
* `SOA` records are skipped by verification loops.

### Ansible Integration

The Ansible collection wraps the CLI rather than duplicating browser automation.

Decision:

* CLI behavior remains the source of truth.
* Ansible modules pass credentials through environment variables and mark
  credential paths as `no_log`.

