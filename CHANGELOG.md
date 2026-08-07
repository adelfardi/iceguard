# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Configurable database schema** (`iceguard.db.schema`, env `ICEGUARD_DB_SCHEMA`; default
  `public`). IceGuard can now share a database with another application instead of owning
  `public`. Flyway creates the schema and Hibernate validates against it.
  **Upgrading:** the migrations were de-qualified (`public.x` → `x`) to make this possible, so
  their checksums changed. An existing database fails with `Migration checksum mismatch` until
  it is realigned once with `quarkus.flyway.repair-at-start=true` (checksums only, no data
  touched); drop the flag afterwards.

### Changed
- Upgrade **Apache Iceberg 1.10.0 → 1.11.0** (backend, bundled Spark image and the default
  `--packages` coordinates); Parquet moves to **1.17.1** to match what Iceberg 1.11 pulls.
  `TableMetadataParser.read(FileIO, InputFile)` was removed upstream — the Nessie snapshot/
  partition-activity readers now use the `read(FileIO, String)` overload. Added `iceberg-orc`
  (+ `orc-core`): 1.11's `FormatModelRegistry` registers all generic format models eagerly, so
  even Parquet-only reads need the ORC classes on the classpath.

## [0.2.0] - 2026-06-22

### Added
- **Real maintenance via the Iceberg Java API**: actual data-file compaction and orphan-file
  removal on small, append-only tables (hard size/file-count limits; refuses above them, pointing
  to Spark).
- **Delete-file maintenance** (Spark): `rewrite_position_delete_files` and
  `rewrite_equality_delete_files` actions for merge-on-read tables.
- **Local Spark tuning** in Settings — driver/executor memory, cores, instances and free-form
  confs, applied to `local[*]` maintenance runs (registered clusters keep their own config).
- Maintenance UI: in-dialog **result + logs** panel, and a **last-run** date on each action card.
- `docker-compose.images.yml` to run the published images without a local build, and `docs/CI.md`
  documenting the pipelines and security bots.

### Changed
- Upgrade **Apache Iceberg 1.7.1 → 1.10.0** (backend); the bundled Spark image moves to
  **Spark 3.5.8 + Iceberg 1.10.0** (fetched from the dlcdn CDN).
- Removed the fake "Nessie" REST-fixture bridge from the dev stack; the dev sandbox now ships a
  single, **real** Nessie Catalog Server.
- Split the oversized `TableService` / `TableDetail`; tuned **Dependabot** (grouped, monthly).
- README: dynamic **CI**, **release** and **GHCR** badges; documented the no-build images stack.

### Fixed
- Table detail page no longer crashes when a table fails to load — it shows a graceful error state.
- **CORS**: allow the nginx UI origin (`:8090`) in the Docker stacks, so catalog create/edit from
  the browser is no longer rejected.

### Security
- Added `SECURITY.md`, **CodeQL** and **Trivy** image scanning, and protected the `main` branch.
- Stopped leaking internal exception details to clients (opaque error reference IDs).
- Removed a stray `key` token file and ignored `key`/`*.key`.

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
