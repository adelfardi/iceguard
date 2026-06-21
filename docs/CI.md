# CI/CD & automation

This repo uses GitHub Actions for build/test, container publishing, and a set of
security/maintenance bots. Everything below is free because the repository is public.

## Workflows at a glance

| Workflow | File | Trigger | What it does |
|---|---|---|---|
| **CI** | `.github/workflows/ci.yml` | push to `main`, every PR | Build + test backend & frontend |
| **CodeQL** | `.github/workflows/codeql.yml` | push/PR to `main`, weekly | Static security analysis of the source |
| **Release** | `.github/workflows/release.yml` | tag `v*`, manual | Build & push multi-arch images to GHCR + scan |
| **Snapshot images** | `.github/workflows/snapshot.yml` | manual | Per-commit throwaway images (`sha-*`) + scan + prune |
| **Dependabot** | `.github/dependabot.yml` | monthly + security alerts | Opens grouped dependency-update PRs |

All security findings land in the repo's **Security** tab (Code scanning / Dependabot alerts).

---

## CI (`ci.yml`)

Runs on every push to `main` and on **every pull request**. Two parallel jobs; older runs
on the same ref are auto-cancelled (`concurrency`).

- **Backend (Java 21 / Maven)** — `mvn -B -ntp package` (compiles, runs the JUnit tests,
  and performs the Quarkus build/augmentation).
- **Frontend (Node / TypeScript)** — `npm ci` → `tsc --noEmit` (type-check) → `npm run lint`
  (ESLint, incl. `jsx-a11y`) → `npm run build`.

> ⚠️ **CI green ≠ runtime verified.** CI compiles and runs unit tests (the backend tests use
> in-memory H2, no S3). It does **not** exercise the real app against Postgres + a catalog +
> object store. For changes that touch the catalog/Parquet/S3 path (e.g. an Iceberg or Quarkus
> bump), do a quick **runtime smoke test** before merging — see [Smoke-testing a risky bump](#smoke-testing-a-risky-bump).

## Release (`release.yml`)

Triggered by pushing a version tag (`git tag v0.1.0 && git push origin v0.1.0`) or manually.
For both images (`iceguard-backend` from `Dockerfile.spark`, `iceguard-frontend`) it:

1. Logs in to **GHCR** (`ghcr.io/<owner>/…`),
2. Builds **multi-arch** images for **`linux/amd64` + `linux/arm64`** (QEMU + Buildx),
3. Pushes them tagged `X.Y.Z`, `X.Y`, `X`, and `sha-…`,
4. **Trivy**-scans the pushed image and uploads results to the Security tab.

The image namespace follows the repo owner automatically; override with the `IMAGE_NAMESPACE`
repo variable to publish elsewhere.

## Snapshot images (`snapshot.yml`)

Manual (`Actions → Snapshot images → Run workflow`, or `gh workflow run snapshot.yml`). Builds
**throwaway per-commit** images tagged `sha-<short>` (+ a moving `edge`) for the **slim** backend
(no Spark) and the frontend — handy to pull and test a specific commit before cutting a real
release. Includes the same Trivy scan, plus a **prune** job that deletes old `sha-*` versions
(keeps the N most recent; never touches `v*`/`latest`/`edge`).

---

## The bots

### Dependabot — dependency updates 🤖
`.github/dependabot.yml`. The only bot that **opens PRs**. Watches 5 ecosystems: **npm**
(`/frontend`), **Maven** (`/backend`), **github-actions**, and **Docker** (backend + frontend).

Tuned for a solo, pre-1.0 project to keep the queue manageable:
- **monthly**, **grouped** (one `minor`+`patch` PR per ecosystem), `open-pull-requests-limit: 5`;
- **`major` bumps ignored** for libraries and base images → done **manually/deliberately**
  (they tend to break: JDK, Quarkus, …);
- **`org.apache.iceberg:*` and `org.apache.parquet:*` ignored entirely** — these are upgraded
  by hand together, because newer versions drag in ORC + hadoop-mapreduce + JAXB (see
  `CHANGELOG`/git history for the 1.10 upgrade).

Security advisories still come through regardless of these rules, under
**Security → Dependabot alerts**.

### CodeQL — source code scanning 🔎
`.github/workflows/codeql.yml`. On push/PR to `main` and weekly. Analyses **Java** (builds the
backend) and **JavaScript/TypeScript**. Reports to **Security → Code scanning**. Catches issues
in *our* code (injections, unsafe patterns, leaked secrets…), not just dependencies.

### Trivy — container image scanning 🐳
Integrated into `release.yml` and `snapshot.yml`. Scans the **built images** for CVEs (base OS,
system libs, bundled jars) at **CRITICAL/HIGH** severity, `ignore-unfixed`, and uploads SARIF to
**Security → Code scanning**. Currently **advisory** (reports, does not fail the build) — flip by
adding `exit-code: '1'` to the Trivy step.

### Coverage summary
| Bot | Scans | Trigger | Results in |
|---|---|---|---|
| Dependabot | dependencies | monthly + alerts | Pull requests · Security → Dependabot |
| CodeQL | our source code | push/PR + weekly | Security → Code scanning |
| Trivy | Docker images | release / snapshot | Security → Code scanning |

---

## How-to

### Cut a release
```bash
git tag v0.2.0 && git push origin v0.2.0   # triggers release.yml (multi-arch build + Trivy)
```

### Build & test a specific commit's images
`Actions → Snapshot images → Run workflow` (on the branch/commit), then
`docker pull ghcr.io/<owner>/iceguard-backend:sha-<short>`.

### Triaging Dependabot PRs
- **Grouped minor/patch PRs**: merge once CI is green.
- **Action / base-image bumps**: CI doesn't build images, so a base-image bump (node/JDK)
  is only validated by the next **release/snapshot** run — watch it.
- **Framework / catalog bumps** (Quarkus, anything touching Iceberg/Parquet/S3): **smoke-test
  the runtime** first (below). A green CI is not enough.

### Smoke-testing a risky bump
On the bump branch, run the app against the dev stack and check it "doesn't smoke":
```bash
cd backend && mvn quarkus:dev -Dquarkus.http.port=8081
# then, in another shell:
curl -s localhost:8081/q/health                                   # 200 / UP
curl -s localhost:8081/api/catalogs                               # lists catalogs
curl -s "localhost:8081/api/catalogs/1/namespaces/analytics/tables/events/sample?limit=2"
# watch the startup log for ERROR / "Failed to start" / unknown config properties
```
If everything responds and the startup log is clean, the bump is safe to merge.
