# IceGuard - Apache Iceberg Table Manager

## Project Structure
- `backend/` — Java 21 Quarkus REST API
- `frontend/` — React + TypeScript + Vite + shadcn/ui

## Backend
```bash
cd backend
# Dev mode (H2 in-memory, no PostgreSQL needed)
mvn quarkus:dev
# Runs on http://localhost:8080
# Swagger UI: http://localhost:8080/q/swagger-ui
```

## Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173, proxies /api to :8080
```

## Docker Environment (Multi-Catalog)
```bash
docker compose up -d

# Services:
#   REST Catalog:      http://localhost:8181      (Apache reference)
#   Nessie Catalog:    http://localhost:8183      (second REST catalog)
#   Polaris:           http://localhost:8182      (OAuth2 + real AWS S3)
#   MinIO S3:          http://localhost:9000
#   MinIO Console:     http://localhost:9001      (minioadmin/minioadmin)
#   PostgreSQL:        localhost:5433             (iceguard/iceguard; also DB `polaris`)

# Run backend with Docker profile
cd backend && mvn quarkus:dev -Dquarkus.profile=docker

# Seed all catalogs (after backend is running)
./scripts/seed-catalog.sh
```

### Polaris (persisted in Postgres, real AWS S3)
Polaris state is persisted in the `polaris` Postgres DB (`polaris.persistence.type=relational-jdbc`),
so it survives restarts (no more re-seed). Setup:
```bash
# Fresh DB only — bootstrap the realm/schema once (one-shot, profile-gated):
docker compose --profile bootstrap run --rm polaris-bootstrap

# Start Polaris with AWS creds (S3 writes need valid creds; temporary STS creds expire ~1h):
export POLARIS_AWS_ACCESS_KEY_ID=... POLARIS_AWS_SECRET_ACCESS_KEY=... POLARIS_AWS_SESSION_TOKEN=...
docker compose up -d polaris
```
When the AWS token expires (S3 `400 "token expired"` / `403`), refresh it in the Polaris container env
(re-`up -d polaris`) AND in the IceGuard `polaris` catalog credentials — but the **catalog/namespaces/
tables now persist** across the restart. For no expiry, use a long-lived IAM user or an AssumeRole.

## Multi-Catalog Architecture
- Each catalog is registered as a `CatalogConfig` in PostgreSQL
- The frontend Catalog Switcher (sidebar) allows quick switching between catalogs
- Catalog type (REST, Nessie, Polaris) is inferred from name/URI
- The backend uses `IcebergCatalogClientFactory` to manage connections per catalog

## Known Limitations
- Polaris config (IceGuard catalog): `uri` = REST base `http://polaris:8181/api/catalog`,
  `warehouse` = the Polaris catalog **name** (`polaris-warehouse`), OAuth2 via
  `credential=polaris-root:polaris-secret` (client_credentials, not a static token).
- Polaris **with MinIO**: browsing works, but **table writes fail** — Polaris's server-side `S3FileIO`
  ignores the S3-compatible endpoint and hits real AWS (`301`). MinIO is read/browse only for Polaris.
- Polaris **with real AWS S3**: **fully works** (create table + insert verified, bucket `polaris-iceguard`).
  Set `SKIP_CREDENTIAL_SUBSCOPING_INDIRECTION=true` (static-keys model, no IAM role needed) and pass AWS
  creds to the Polaris container via env: `POLARIS_AWS_ACCESS_KEY_ID`, `POLARIS_AWS_SECRET_ACCESS_KEY`,
  `POLARIS_AWS_SESSION_TOKEN` (for temporary STS creds), region `us-east-1`. The IceGuard catalog also
  carries the AWS `s3.*` creds so the client FileIO can write. Temporary STS creds expire (~1h) — refresh
  them in the Polaris env and the IceGuard catalog credentials when writes start failing with `403`.
- Nessie 0.99 Catalog Server has complex S3 credential config — we use a REST Catalog bridge
- Java API executor only *analyses* data files (no real compaction). Real `rewrite_data_files`
  runs via the Spark executor, which requires `spark-sql` on PATH (or `iceguard.spark.sql-path`).
  In docker-compose the backend is built from `backend/Dockerfile.spark`, which bundles Spark
  3.5.3 (on Java 17) + the Iceberg jars in `$SPARK_HOME/jars`, so local Spark works out of the box.
  The slim `backend/Dockerfile` (no Spark) remains for non-Spark deployments.

## Maintenance Executors
- Pluggable via the `MaintenanceExecutor` interface.
- `JavaApiExecutor` (`@Default`, name `java-api`): Iceberg Java API; rewrite is analyse-only.
- `SparkMaintenanceExecutor` (`@SparkEngine`, name `spark-sql`): launches `spark-sql` as a
  subprocess for real `rewrite_data_files`. The Spark master is per-request: `local[*]` for
  local mode, or a configured cluster's URL. Spark resolves its runtime via `--packages`.
- Rewrite request picks the engine: `MaintenanceRequest.engine` (`"java"`|`"spark"`) +
  optional `sparkClusterId` (null = local Spark).
- Spark clusters (master URL + extra confs) are CRUD-managed via `/api/spark-clusters` and the
  Settings page; stored in `spark_cluster_config` (Flyway `V2`). Config keys: `iceguard.spark.*`.

## Key Architecture Decisions
- REST Catalog client uses Apache Iceberg Java API (`RESTCatalog`)
- `CatalogConfig`, `SparkClusterConfig`, `MaintenanceSchedule`, `ExecutionHistory` stored in PostgreSQL
- OIDC disabled by default, ready for Keycloak integration
