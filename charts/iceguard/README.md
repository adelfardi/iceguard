# IceGuard Helm chart

Deploys the two IceGuard services on Kubernetes: the React UI (nginx) and the Quarkus API.

**It deploys no database.** IceGuard stores its own state — registered catalogs and their
credentials, Spark clusters, maintenance schedules, run history — in a **PostgreSQL you
provide**; point `database.*` at it. That matches the product's Level 1 Compose stack, where
Postgres is a required dependency rather than something IceGuard ships.

The UI's nginx reverse-proxies `/api/` to the backend Service, so the browser only ever talks
to one origin and no cross-origin setup is needed for normal use.

Images currently default to a **snapshot built from this working tree** (Iceberg 1.11), which is
**not published to GHCR** — load it into your nodes before installing, or switch the tags back to
a released version:

| Component | Image | Released alternative |
|---|---|---|
| Backend | `ghcr.io/adelfardi/iceguard-backend:0.3.0-SNAPSHOT` | `:0.2.0` |
| Frontend | `ghcr.io/adelfardi/iceguard-frontend:0.3.0-SNAPSHOT` | `:0.2.0` |

Build and load the snapshot (kind shown; for another cluster, push it to a registry you control):

```bash
docker build -t ghcr.io/adelfardi/iceguard-backend:0.3.0-SNAPSHOT  -f backend/Dockerfile  backend
docker build -t ghcr.io/adelfardi/iceguard-frontend:0.3.0-SNAPSHOT -f frontend/Dockerfile frontend
kind load docker-image ghcr.io/adelfardi/iceguard-{backend,frontend}:0.3.0-SNAPSHOT
```

```bash
helm install iceguard ./charts/iceguard … --set image.tag=0.2.0 \
  --set backend.image.tag=0.2.0 --set frontend.image.tag=0.2.0
```

The backend image is the **slim** one (no bundled Spark). Spark-engine maintenance needs
`spark-sql` on PATH, so use an external Spark cluster (see the main README).

## Install

```bash
helm install iceguard ./charts/iceguard -n iceguard --create-namespace \
  --set database.host=pg.internal \
  --set database.existingSecret=iceguard-db-credentials
```

The schema must be **empty on first install** — Flyway owns it and migrates at backend startup
(Hibernate then runs in `validate`).

### Sharing a database with another application

Set `database.schema` to keep the 15 IceGuard tables out of `public`; Flyway creates the schema
if it does not exist and everything (including its history table) lands there:

```bash
--set database.jdbcUrl='jdbc:postgresql://pg.internal:5432/shared-db' \
--set database.schema=iceguard
```

### Upgrading from a release before the schema became configurable

Making the schema configurable meant de-qualifying every migration (`CREATE TABLE public.x` →
`CREATE TABLE x`), which changes their Flyway checksums. A database migrated by an earlier
version therefore refuses to start with `Migration checksum mismatch for migration version 1`.
Realign it once — the flag only rewrites checksums in `flyway_schema_history`, it touches no
data — then drop the flag again:

```bash
helm upgrade … \
  --set-string 'backend.extraEnv[0].name=QUARKUS_FLYWAY_REPAIR_AT_START' \
  --set-string 'backend.extraEnv[0].value=true'
```

Then open the UI:

```bash
kubectl port-forward -n iceguard svc/iceguard-frontend 8090:80
# http://localhost:8090
```

A render without a database is rejected on purpose:

```
Error: database.host (or database.jdbcUrl) is required — IceGuard needs a PostgreSQL you provide
```

### Without Helm at install time (`kubectl apply`)

The chart renders to plain manifests, so Helm is only needed to *produce* them:

```bash
helm template iceguard ./charts/iceguard \
  --namespace iceguard --skip-tests \
  --set database.host=pg.internal \
  --set database.existingSecret=iceguard-db-credentials \
  > iceguard.yaml

kubectl create namespace iceguard
kubectl apply -n iceguard -f iceguard.yaml
```

`--skip-tests` leaves out the `helm test` pod, which has no meaning outside a Helm release.

## Production notes

- **Use `database.existingSecret`.** An inline `database.password` is written verbatim into a
  Secret rendered by the chart — fine for a quick trial, awkward to rotate and easy to leak
  through a values file in git.
- **The backend holds catalog credentials.** Registered catalogs store their credentials
  (S3 keys, OAuth2 client secrets, tokens) in that database — treat it as sensitive and
  restrict access to it.
- **No authentication by default.** `backend.oidc.enabled=false` means anyone who reaches
  the Service can manage every registered catalog. Enable OIDC (`backend.oidc.*`) or keep
  the release behind your own authenticating proxy before exposing it.
- **S3 identity.** For IRSA, annotate the ServiceAccount
  (`serviceAccount.annotations."eks\.amazonaws\.com/role-arn"`) and register catalogs with the
  *Web identity* storage mode. `automountServiceAccountToken: false` does not interfere — the
  EKS webhook mounts its own projected token volume.

## Values

### Images

| Key | Default | Description |
|---|---|---|
| `image.registry` | `ghcr.io/adelfardi` | Fallback namespace when a component repository is empty |
| `image.tag` | `0.3.0-SNAPSHOT` | Fallback tag; empty ⇒ the chart `appVersion` |
| `image.pullPolicy` | `IfNotPresent` | Keep this for a locally loaded snapshot — `Always` would try to pull it |
| `image.pullSecrets` | `[]` | e.g. `[{name: my-ghcr-creds}]` for a private registry |
| `backend.image.repository` / `.tag` | `ghcr.io/adelfardi/iceguard-backend` / `0.3.0-SNAPSHOT` | |
| `frontend.image.repository` / `.tag` | `ghcr.io/adelfardi/iceguard-frontend` / `0.3.0-SNAPSHOT` | |

### Database (required)

| Key | Default | Description |
|---|---|---|
| `database.host` | `""` | **Required** unless `jdbcUrl` is set |
| `database.port` | `5432` | |
| `database.name` | `iceguard` | |
| `database.schema` | `public` | Schema owning the tables — set it to share a database with another app; Flyway creates it if missing |
| `database.username` | `iceguard` | |
| `database.password` | `""` | Required unless `existingSecret` is set; rendered into a chart-owned Secret |
| `database.jdbcUrl` | `""` | Full URL, overrides host/port/name (e.g. `?sslmode=require`) |
| `database.existingSecret` | `""` | A Secret you manage holding the credentials |
| `database.usernameKey` | `""` | Read the username from that Secret; unset ⇒ use `database.username` |
| `database.passwordKey` | `password` | Key holding the password |

### Backend

| Key | Default | Description |
|---|---|---|
| `backend.replicaCount` | `1` | |
| `backend.service.type` / `.port` / `.nodePort` | `ClusterIP` / `8080` / `""` | |
| `backend.corsOrigins` | `*` | `QUARKUS_HTTP_CORS_ORIGINS`; only matters for cross-origin API calls |
| `backend.maxBodySize` | `64M` | Max HTTP body — data inserts can be large |
| `backend.oidc.enabled` / `.authServerUrl` / `.clientId` | `false` / `""` / `iceguard-backend` | Keycloak & co. |
| `backend.waitForDatabase.enabled` | `true` | initContainer that blocks until the DB accepts TCP; skipped when only `database.jdbcUrl` is set |
| `backend.waitForDatabase.image` / `.timeoutSeconds` | `busybox:1.37` / `180` | |
| `backend.startupProbe.*` | enabled, 3s × 40 | Covers JVM boot + Flyway migration |
| `backend.livenessProbe.*` / `readinessProbe.*` | enabled | `/q/health/live`, `/q/health/ready` |
| `backend.resources` | 100m / 512Mi requests, 1Gi limit | |
| `backend.podSecurityContext` / `.containerSecurityContext` | non-root, read-only rootfs | `/tmp` is an emptyDir |
| `backend.extraEnv` / `.extraEnvFrom` | `[]` | Raw env entries, e.g. `JAVA_OPTS`, `iceguard.spark.*` |
| `backend.podAnnotations`, `.podLabels`, `.nodeSelector`, `.tolerations`, `.affinity`, `.topologySpreadConstraints`, `.priorityClassName` | | Standard scheduling knobs |
| `backend.podDisruptionBudget.enabled` / `.minAvailable` | `false` / `1` | Only created when `replicaCount > 1` |

### Frontend

Same shape as the backend (`frontend.replicaCount`, `.service.*`, `.resources`, probes,
scheduling, `podDisruptionBudget`). `BACKEND_URL` is wired to the backend Service
automatically. The stock nginx image renders its config at startup and writes to
`/var/cache/nginx`, so the chart mounts emptyDirs there and does not force a non-root user.

### Exposure & the rest

| Key | Default | Description |
|---|---|---|
| `ingress.enabled` | `false` | |
| `ingress.className` / `.annotations` / `.tls` | `""` / `{}` / `[]` | |
| `ingress.hosts[].host` / `.paths[]` | `iceguard.local`, `/` → frontend | Each path takes `service: frontend\|backend` — use `backend` to expose the raw API or `/q/swagger-ui` |
| `networkPolicy.enabled` | `false` | Ingress-only policy: only the frontend (and the test pod) may reach the backend. Egress stays open — the backend must reach the database and your catalogs |
| `networkPolicy.backendExtraIngress` | `[]` | Extra `ingress:` rules for the backend policy |
| `serviceAccount.create` / `.name` / `.annotations` / `.automountServiceAccountToken` | `true` / `""` / `{}` / `false` | |
| `commonLabels` / `commonAnnotations` | `{}` | Added to every object |
| `nameOverride` / `fullnameOverride` | `""` | |
| `tests.enabled` / `tests.image` | `true` / `curlimages/curl:8.11.1` | `helm test` pod |

## Examples

Managed database over TLS, exposed through an ingress:

```yaml
database:
  jdbcUrl: jdbc:postgresql://iceguard.abc123.eu-west-1.rds.amazonaws.com:5432/iceguard?sslmode=require
  username: iceguard
  existingSecret: iceguard-db-credentials   # key: password
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: iceguard.example.com
      paths:
        - path: /
          pathType: Prefix
          service: frontend
        # Swagger UI / raw API, which the UI's nginx does not proxy:
        - path: /q
          pathType: Prefix
          service: backend
  tls:
    - secretName: iceguard-tls
      hosts: [iceguard.example.com]
backend:
  corsOrigins: https://iceguard.example.com
```

Local cluster without an ingress controller (kind, minikube), against a Postgres you already
run in the cluster:

```bash
helm install iceguard ./charts/iceguard -n iceguard --create-namespace \
  --set database.host=my-postgres.default.svc.cluster.local \
  --set database.password=iceguard \
  --set frontend.service.type=NodePort --set frontend.service.nodePort=30090
```

## Verify a release

```bash
helm test iceguard -n iceguard --logs
```

The test pod checks the backend's health endpoint, the catalogs API, the UI, and the UI's
`/api` proxy. It is kept after the run so `--logs` works, and replaced on the next run.

## Uninstall

```bash
helm uninstall iceguard -n iceguard
```

Nothing stateful is left behind — your database is untouched, including the IceGuard schema
in it. Drop that schema yourself if you want a clean slate before reinstalling.
