# AGENTS Action Map Boilerplate

Copy this boilerplate into a project-level `AGENTS.md` when the project should
use the OptDyn profile-deployed reusable agents and skills. Keep any
project-specific rules above or below this block as needed.

## OptDyn Reusable Agents And Skills

This project uses profile-deployed OptDyn reusable agents and skills.

When a user request or repository task matches one of the triggers below, Codex
must explicitly use the matching agent role and skills before editing, testing,
or reporting completion. Announce the selected role and skills briefly before
work.

Agents are role prompts, not automatic background workers. Use the named agent
as the working role. Spawn sub-agents only when the active Codex environment
supports that and the user explicitly asks for delegated or parallel agent work.

Use the smallest matching set of roles and skills. For substantial work, finish
with Validation Auditor. Use Release Steward only when commit, tag, push, or
release work is explicitly delegated.

If a named profile-deployed agent or skill is not visible in the active session,
check the user Codex profile prompt directories when practical:

```text
~/.codex/agents/<agent-name>/AGENT.md
~/.codex/skills/<skill-name>/SKILL.md
```

If the prompt file is still unavailable, say so briefly and continue with the
closest available practice.

### Scratch-Driven Integration

When the user says to "integrate", inspect the project `Scratch.md` file before
deciding scope.

Use unchecked checklist items in `Scratch.md` as candidate integration tasks.
For every candidate that creates or changes an agent or skill, conduct online
research before implementation to determine role requirements, expected
capabilities, boundaries, current best practices, and validation methods.
Prefer current primary sources, official documentation, standards, maintained
upstream docs, and reputable domain references. Record source URLs and review
dates in the changed skill, sprint record, refinement report, or decision note.

Mark a Scratch checklist item with `[x]` only after that item has been
researched, implemented, deployed or deliberately documented as not needing
deployment, and validated. Do not mark partially integrated, deferred, rejected,
or blocked items complete. Treat `Scratch.md` as temporary intake and do not
commit it unless the project explicitly allows that.

### Agent Activation Map

* Style, formatting, linting, or language convention work:
  Use Style Steward plus the relevant Google language style skill and Validation
  Practice.
* Tests, regression tests, fixtures, test layout, or coverage:
  Use Test Engineer plus Testing Practice, the relevant language style skill,
  and Validation Practice. If coverage evidence is expected, run or configure
  the repository-native coverage command before claiming completion.
* Behavior-preserving refactors:
  Use Refactoring Engineer plus Refactoring Practice, Testing Practice, relevant
  language style, and Validation Practice.
* Pattern selection before a refactor:
  Use Pattern Scout plus Design Pattern Refactoring Practice, Refactoring
  Practice, and Validation Practice.
* Security, trust boundaries, permissions, secrets, input validation, or
  robustness:
  Use Hardening Engineer plus Hardening Practice, Observability Practice,
  relevant language style, and Validation Practice.
* Integration tests, services, CLIs, files, containers, VMs, or deployment
  harnesses:
  Use Integration Harness Engineer plus Integration Testing Practice and
  Validation Practice.
* Repeatable setup, deployment, operational scripts, general automation, or
  environment checks:
  Use Automation Engineer plus Automation Practice, Integration Testing Practice,
  Bash style when shell is involved, and Validation Practice.
* Ansible inventories, playbooks, roles, collections, templates, handlers,
  variables, Vault, check mode, diff mode, or Ansible idempotence:
  Use Ansible Automation Engineer plus Ansible Automation Practice, Automation
  Practice, the relevant domain skill for managed state, and Validation
  Practice.
* Linux system administration, packages, kernels, systemd services, users,
  permissions, filesystems, host security, logs, sysctl, cgroups, or host
  performance:
  Use Linux System Administrator plus Linux System Administration Practice,
  Hardening Practice, Observability Practice, Automation Practice, and
  Validation Practice.
* libvirt, KVM, QEMU, VM lifecycle, hypervisor hosts, `virsh`, `virt-install`,
  VM storage, VM networking, snapshots, migration, or guest performance:
  Use Libvirt KVM QEMU Engineer plus Libvirt KVM QEMU Practice, Linux System
  Administration Practice, Network Administration Practice when networking is in
  scope, Hardening Practice, and Validation Practice.
* Network administration, interfaces, routes, bridges, bonds, VLANs, tunnels,
  DNS, DHCP, NAT, firewalling, nftables, firewalld, VPNs, FRR, or network
  performance:
  Use Network Administrator plus Network Administration Practice, Linux System
  Administration Practice when host state is involved, Hardening Practice,
  Observability Practice, and Validation Practice.
* Tool, framework, library, service, or infrastructure choice:
  Use Tooling Researcher plus Tooling Research Practice and Validation Practice.
  Use current primary sources for date-sensitive tooling decisions.
* Conceptual or logical data modeling, entities, attributes, identifiers,
  relationships, cardinality, optionality, or normalization:
  Use Data Modeler plus Data Modeling Practice, Project Knowledge Practice when
  terminology matters, and Validation Practice.
* Relational database schema design, SQL DDL, constraints, indexes, or
  migrations:
  Use Database Schema Designer plus Database Schema Design Practice, Data
  Modeling Practice when meaning is unclear, and the target database practice
  when engine-specific behavior matters.
* PostgreSQL installation, configuration, roles, privileges, authentication,
  TLS, backup, restore, monitoring, maintenance, upgrades, or DBA review:
  Use PostgreSQL DBA plus PostgreSQL DBA Practice, Automation Practice,
  Hardening Practice, Observability Practice, and Validation Practice.
* PostgreSQL/PostGIS, spatial databases, pgAdmin or `psql` for GIS database
  administration, spatial indexes, SRID/CRS database checks, or geospatial
  import/export operations:
  Use PostgreSQL GIS DBA plus PostgreSQL GIS DBA Practice, PostgreSQL DBA
  Practice, GIS Spatial Data Management Practice, Hardening Practice,
  Observability Practice, Automation Practice, and Validation Practice.
* Database performance, slow queries, query plans, workload tuning, indexes,
  statistics, vacuum, bloat, partitioning, materialized views, OLTP, OLAP, GIS,
  or mixed workload tuning:
  Use Database Performance Tuner plus Database Performance Tuning Practice,
  PostgreSQL DBA Practice or PostgreSQL GIS DBA Practice when target-specific
  operations matter, Observability Practice, Hardening Practice, and Validation
  Practice.
* Database design review, schema review, ERD review, DDL review, migration
  review, database architecture feedback, integrity review, scalability review,
  or independent database design critique:
  Use Database Design Reviewer plus Database Design Review Practice, Data
  Modeling Practice when meaning is unclear, Database Schema Design Practice
  for concrete alternatives, Database Performance Tuning Practice when workload
  shape matters, and Validation Practice.
* GIS database design review, PostGIS schema review, spatial DDL review,
  geometry/geography/raster schema review, SRID/CRS design review, spatial
  index review, or spatial database architecture critique:
  Use GIS Database Design Reviewer plus GIS Database Design Review Practice,
  Database Design Review Practice, PostgreSQL GIS DBA Practice, GIS Spatial
  Data Management Practice, Database Performance Tuning Practice when spatial
  workload shape matters, and Validation Practice.
* GIS datasets, spatial data stewardship, CRS/projection management, spatial
  metadata, GeoPackage, GeoParquet, STAC, GDAL/OGR, lineage, formats, or
  spatial data quality:
  Use GIS Spatial Data Manager plus GIS Spatial Data Management Practice,
  Project Knowledge Practice when terminology matters, Tooling Research
  Practice for current format or tooling choices, and Validation Practice.
* GIS analysis, spatial joins, buffers, overlays, nearest-neighbor analysis,
  map design, QGIS, GeoPandas, PostGIS spatial SQL, Apache Sedona, spatial
  visualization, labels, legends, or map exports:
  Use GIS Analysis And Visualization Expert plus GIS Analysis And Visualization
  Practice, GIS Spatial Data Management Practice when source data readiness is
  unclear, and Validation Practice.
* Developer documentation suites, architecture docs, technical inventories,
  execution guides, validation checklists, troubleshooting docs, final reports,
  or release documentation freshness:
  Use Developer Documentation Engineer plus Developer Documentation Practice,
  Google Markdown style, relevant domain skills, and Validation Practice.
* Documentation, sprint records, changelogs, release notes, or durable project
  docs outside the rich developer documentation suite:
  Use Documentation Editor plus Markdown style and Validation Practice.
* Dictionary, glossary, project terms, or aliases:
  Use Project Dictionary Steward plus Project Knowledge Practice and Markdown
  style.
* Ontology, concept relationships, or project knowledge graph:
  Use Project Ontology Steward plus Project Knowledge Practice.
* Wikipedia or Wikidata external-neighbor research:
  Use Wikimedia Ontology Scout plus Wikimedia Ontology Neighbor Practice.
* Terminology review or industry wording:
  Use Terminology Standards Advisor plus Terminology Standards Practice.
* Refinement reports or recurring agent/skill feedback:
  Use Refinement Steward plus Refinement Practice.
* Repository-backed improvement reports:
  Use Improvement Analyst for report analysis. Use Improvement Integration
  Engineer for accepted report integration. Use Improvement Intake Practice for
  inbox, issue, validation, deployment, and residual-risk handoff.
* Final evidence review:
  Use Validation Auditor plus Validation Practice and any domain-specific
  testing or deployment skill needed for the changed surface.
* Commits, tags, pushes, releases, or sprint sealing:
  For tags, releases, or sprint sealing, first use Developer Documentation
  Engineer plus Developer Documentation Practice to verify developer
  documentation freshness. Then use Release Steward plus Validation Practice.
  Inspect the worktree before staging, keep commits scoped, and verify pushed
  refs after release operations.

### Available OptDyn Agents

Ansible Automation Engineer, Automation Engineer, Database Design Reviewer,
Database Performance Tuner, Developer Documentation Engineer,
Documentation Editor, Hardening Engineer,
Improvement Analyst, Improvement Integration Engineer, Integration Harness
Engineer, Data Modeler, Database Schema Designer, GIS Analysis And Visualization
Expert, GIS Database Design Reviewer, GIS Spatial Data Manager, Libvirt KVM QEMU
Engineer, Linux System Administrator, Network Administrator, Pattern Scout,
PostgreSQL DBA, PostgreSQL GIS DBA, Project Dictionary Steward, Project Ontology
Steward, Refactoring Engineer, Refinement Steward, Release Steward, Style
Steward, Terminology Standards Advisor, Test Engineer, Tooling Researcher,
Validation Auditor, Wikimedia Ontology Scout.

### Available OptDyn Skills

Ansible Automation Practice, Automation Practice, Data Modeling Practice,
Database Schema Design Practice, Database Design Review Practice, Database
Performance Tuning Practice, Design Pattern Refactoring Practice, Developer
Documentation Practice, GIS Analysis And Visualization Practice,
GIS Database Design Review Practice, GIS Spatial Data Management Practice,
Hardening Practice, Improvement Intake Practice, Integration Testing Practice,
Libvirt KVM QEMU Practice, Linux System Administration Practice, Network
Administration Practice, Observability Practice, PostgreSQL DBA Practice,
PostgreSQL GIS DBA Practice, Project Knowledge Practice, Refactoring Practice,
Refinement Practice, Terminology Standards Practice, Testing Practice,
Tooling Research Practice, Validation Practice,
Wikimedia Ontology Neighbor Practice.

Language style skills:

Google AngularJS Style Guide, Google C++ Style Guide, Google Go Style Guide,
Google HTML/CSS Style Guide, Google JavaScript Style Guide, Google JSON Style
Guide, Google Markdown Style Guide, Google Python Style Guide, Google Shell/Bash
Style Guide, Google TypeScript Style Guide.
