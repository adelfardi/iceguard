# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Removed the fake "Nessie" REST-fixture bridge from the dev stack; the dev sandbox now ships a
  single, **real** Nessie Catalog Server.
- README: replaced static badges with dynamic **CI status**, **release** and **GHCR** badges.

### Fixed
- Table detail page no longer crashes when a table fails to load (catalog unreachable, table
  dropped, auth error) — it shows a graceful error state instead.

### Security
- Added `SECURITY.md` (private vulnerability reporting + operational notes).
- Stopped tracking `CLAUDE.md`; removed a stray `key` token file and ignored `key`/`*.key`.

## [0.1.0] - 2026-06-20

Initial release — an open-source web console for Apache Iceberg™ tables.

### Added
- **Multi-catalog** support: REST, Nessie, Polaris and **Unity Catalog** (auth: None / Bearer /
  OAuth2). The catalog **vendor is persisted** and drives vendor-specific behaviour such
  as Nessie commit-log history.
- **Browse**: namespaces & tables tree; create namespaces; create / drop / rename tables; insert
  sample rows; data preview.
- **Schema & metadata**: multi-column schema editor, properties editor and partition evolution,
  each applied in a single commit.
- **Storage**: point-in-time totals, file-size histogram, per-partition aggregates and file
  drill-down.
- **Lineage & history**: schema-version history with column diffs and snapshot-to-snapshot diff.
- **Maintenance**: expire snapshots, rewrite data files, rewrite manifests, remove orphan files,
  rollback — via a Java API executor (analyse) or a Spark executor (real `rewrite_data_files`).
- **Pipelines**: chain maintenance actions on a cron schedule with an Airflow-style run view.
- **Alerts**: threshold rules on table metrics with optional SMTP notifications.
- **Timeline**: snapshots + executions on one timeline.
- Per-table override of the Overview gauge thresholds (data files / snapshots).
- A real Nessie Catalog Server in the Docker dev sandbox.
- Published container images on GHCR (`iceguard-backend`, `iceguard-frontend`).

[Unreleased]: https://github.com/adelfardi/iceguard/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/adelfardi/iceguard/releases/tag/v0.1.0
