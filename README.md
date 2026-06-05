<div align="center">

<img src="frontend/public/ice.png" alt="IceGuard" width="96" height="96" />

# IceGuard

**A modern web console to manage, inspect and maintain Apache Iceberg™ tables across multiple catalogs.**

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Backend](https://img.shields.io/badge/backend-Java%2021%20%C2%B7%20Quarkus-4695EB.svg)](backend)
[![Frontend](https://img.shields.io/badge/frontend-React%20%C2%B7%20TypeScript%20%C2%B7%20Vite-61DAFB.svg)](frontend)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

> ⚠️ **Independent community project — not affiliated with or endorsed by the Apache Software Foundation.**
> "Apache", "Apache Iceberg", "Iceberg" and "Apache Polaris" are trademarks of the ASF.

---

## What is IceGuard?

IceGuard is an admin & maintenance console for the **Apache Iceberg** lakehouse. Point it at one or
more catalogs (REST, Nessie, Polaris) and get a single UI to browse namespaces and tables, evolve
schemas and partitions, edit properties, sample data, inspect storage layout, view lineage, and run
(or schedule) maintenance like snapshot expiration and data-file compaction.

It is **not** a catalog — it sits on top of your existing Iceberg catalogs.

### What IceGuard actually is

IceGuard is **two components**:

1. **Frontend** — the React/TypeScript web UI.
2. **Backend** — the Quarkus REST API.

It has **one required dependency**: a **PostgreSQL** database (you provide it), where the backend
stores IceGuard's own state — registered catalogs, pipelines, schedules, alerts and execution
history. Postgres is not part of IceGuard; it's infrastructure IceGuard needs to run, like a JVM.

IceGuard then **connects to your own** Iceberg catalog(s) and object store.

> The `docker-compose.yml` in this repo (MinIO, an Iceberg REST Catalog, Nessie, Apache Polaris,
> optionally Spark) is **only a local test sandbox** so you can try IceGuard end-to-end without
> bringing your own infrastructure. **It is not part of the product** — in production you point
> IceGuard at your existing catalogs and storage.

## Features

- **Multi-catalog** — register and switch between REST, Nessie and Polaris catalogs (OAuth2/Bearer/Basic supported).
- **Namespaces & tables** — browse the tree, create namespaces, create/drop/rename tables, insert sample rows.
- **Schema editor** — add / rename / retype / re-doc / drop multiple columns, applied in a **single commit**.
- **Properties editor** — add / update / remove table properties in a **single commit**.
- **Partition evolution** — add or drop partition fields (identity, bucket, truncate, year/month/day/hour).
- **Storage tab** — point-in-time storage state: totals, file-size histogram, per-partition aggregates
  (server-side paginated), and file drill-down.
- **Lineage / history** — schema-version history with column diffs, and a visual snapshot-to-snapshot diff.
- **Maintenance** — expire snapshots, rewrite data files, rewrite manifests, remove orphan files, rollback.
  Pluggable executors: a **Java API** executor (analyse) and a **Spark** executor (real `rewrite_data_files`,
  local `local[*]` or a remote Spark cluster).
- **Pipelines** — chain maintenance actions with per-action parameters and a cron schedule (Airflow-style run view).
- **Alerts** — threshold rules on table metrics with optional SMTP email notifications.
- **Timeline** — snapshots + executions on one timeline, click any item for its output/logs.

## Stack

| Layer | Tech |
|-------|------|
| Frontend (product) | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, Recharts |
| Backend (product) | Java 21, Quarkus 3.17, RESTEasy Reactive, Hibernate Panache, Flyway, Apache Iceberg 1.7 |
| Required dependency | PostgreSQL (backend state) |
| Test sandbox only | Docker Compose: MinIO (S3), Iceberg REST Catalog, Nessie, Apache Polaris, (optional) Spark |

## Quick start (local test sandbox)

This spins up IceGuard **plus** a throwaway test stack so you can try everything immediately.
Requirements: Docker + Docker Compose, JDK 21 & Maven, Node 18+.

```bash
# 1. Start the test sandbox (MinIO, Postgres, REST + Nessie + Polaris catalogs)
docker compose up -d

# 2. Backend (Quarkus, dev mode) — http://localhost:8080  (Swagger: /q/swagger-ui)
cd backend && mvn quarkus:dev -Dquarkus.profile=docker

# 3. Frontend (Vite) — http://localhost:5173
cd frontend && npm install && npm run dev

# 4. Seed demo catalogs/tables (after the backend is up)
./scripts/seed-catalog.sh
```

The **REST Catalog** and **Nessie** demo catalogs work out of the box on MinIO.
**Polaris writes require real AWS S3** credentials — copy `.env.example` to `.env` and see
[`CLAUDE.md`](CLAUDE.md) for the Polaris + Postgres-persistence setup.

### Using IceGuard for real

Deploy the **frontend** and **backend**, point the backend at a **PostgreSQL** you provide
(`QUARKUS_DATASOURCE_JDBC_URL` / username / password), then add your own catalog(s) from the UI
(**Catalogs → Add Catalog**): REST / Nessie / Polaris URI, warehouse, auth (OAuth2 / Bearer / Basic)
and, if needed, S3 credentials. No MinIO/Spark/sandbox containers required.

## Architecture

```
        IceGuard (the product)            required dep            your existing systems
   ┌───────────────────────────────┐
   │ React + Vite (UI, :5173)       │
   │           │                    │
   │ Quarkus REST API (:8080) ──────┼──> PostgreSQL ─────────┐
   └───────────────────────────────┘   (IceGuard state)     │
                   │                                         │
                   └──────────────────> Iceberg catalogs (REST / Nessie / Polaris)
                                                  └──> S3 / object store (data & metadata)
```

IceGuard's own state (registered catalogs, pipelines, schedules, alerts, execution history) lives in
the PostgreSQL you provide; table data & metadata live in **your** object store via **your** Iceberg
catalogs.

## Project layout

```
backend/    Quarkus REST API (com.iceguard.*)
frontend/   React + TypeScript SPA
scripts/    seed + helper scripts
docker-compose.yml
CLAUDE.md   detailed architecture notes & known limitations
```

## Known limitations

- The **Java** rewrite-data-files executor is analyse-only; real compaction needs the **Spark** executor.
- **Polaris + MinIO**: browsing works, but writes fail (Polaris ignores the S3-compatible endpoint) — use real AWS S3.
- Catalog credentials are stored in PostgreSQL (not encrypted at rest) — treat the DB as sensitive.
- Test coverage is early-stage. Contributions very welcome 🙂

## Contributing

Contributions, issues and ideas are welcome! Please read **[CONTRIBUTING.md](CONTRIBUTING.md)** and our
**[Code of Conduct](CODE_OF_CONDUCT.md)**. Good first issues are labelled `good first issue`.

## License

[Apache License 2.0](LICENSE).
