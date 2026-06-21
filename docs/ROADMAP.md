# IceGuard — Hardening Roadmap

Goal: bring the project to production-grade standards across **tests, quality,
documentation, security and CI/CD**. This is a living checklist; items are
grouped by theme and tagged with a phase (P0 = quick foundations, P1 = depth,
P2 = polish). Draft for discussion — priorities not final.

## Current baseline (2026-06)
- Backend: Quarkus 21, **1 test** (`CatalogResourceTest`); JUnit5 + Mockito +
  REST-assured + Surefire available. No coverage/formatting/static analysis.
- Frontend: React/TS/Vite, ESLint configured, **no tests**, no formatter.
- Repo: CI (build/test/lint/typecheck), release + snapshot workflows, PR/issue
  templates, CONTRIBUTING, CODE_OF_CONDUCT. No Dependabot/CodeQL/image scan.

---

## 1. Tests
- [ ] **P0** Frontend: add Vitest + React Testing Library; `test` + `test:coverage` scripts.
- [ ] **P0** Frontend: first unit tests — `api/client` params builder, `guessCatalogType`, a couple of pure helpers.
- [ ] **P0** Backend: JaCoCo coverage report (and surface it in CI).
- [ ] **P1** Backend: integration tests with **Testcontainers** (Postgres + an Iceberg REST catalog) covering catalog CRUD, namespace/table create, statistics, executions search.
- [ ] **P1** Frontend: component tests for the key flows (Create Catalog page, Create Table page, Executions filters/pagination).
- [ ] **P1** Wire `npm run test` into the frontend CI job; fail on test failure.
- [ ] **P2** Coverage gates (e.g. fail under N%); start advisory, then enforce.
- [ ] **P2** Optional E2E smoke test (Playwright) against the `docker-compose.images.yml` stack.

## 2. Code quality & style
- [ ] **P0** Frontend: **Prettier** + `format`/`format:check` scripts; check in CI.
- [ ] **P0** Backend: **Spotless** (google-java-format or palantir) + `mvn spotless:check` in CI.
- [ ] **P1** Pre-commit hooks: Husky + lint-staged (lint/format staged files) for fast local feedback.
- [ ] **P1** Resolve the remaining ESLint warnings (unused eslint-disable directives, exhaustive-deps) rather than leaving them.
- [ ] **P2** Backend static analysis: SpotBugs or Error Prone (advisory first).
- [ ] **P2** Editorconfig + consistent import ordering.

## 3. Documentation & comments
- [ ] **P0** `SECURITY.md` — supported versions + vulnerability disclosure process.
- [ ] **P1** Javadoc on public service/REST classes and non-obvious logic (maintenance executors, catalog factory).
- [ ] **P1** JSDoc/TSdoc on non-trivial frontend modules (api client, hooks, type guards).
- [ ] **P1** Publish/annotate the OpenAPI spec (Quarkus smallrye-openapi already exposes `/q/openapi`); link it from the README.
- [ ] **P2** Architecture doc + a few ADRs (catalog abstraction, Spark-as-subprocess, multi-catalog model).
- [ ] **P2** Keep README/CONTRIBUTING in sync as features land.

## 4. Security
- [x] **P0** **Dependabot** (`.github/dependabot.yml`) for npm, maven, github-actions, docker — *done (grouped, monthly)*.
- [x] **P0** **CodeQL** workflow (Java + JavaScript/TS) on push/PR + schedule — *done*.
- [ ] **P0** Enable GitHub **secret scanning + push protection** (repo setting).
- [ ] **P0** Pin third-party GitHub Actions to commit SHAs (supply-chain).
- [x] **P1** **Trivy** image scan in the release/snapshot workflows — *done (advisory; flip to fail on HIGH/CRITICAL later)*.
- [ ] **P1** `npm audit` / OWASP dependency check step (advisory → enforced).
- [ ] **P1** **Encrypt catalog credentials at rest** — currently plaintext JSON in `catalog_config`. See [#49](https://github.com/adelfardi/iceguard/issues/49).
- [ ] **P1** **API authentication (OIDC)** — disabled by default; wire Quarkus OIDC + role-protected endpoints. See [#50](https://github.com/adelfardi/iceguard/issues/50).
- [ ] **P1** Review app security: input validation (hibernate-validator), CORS origins, error messages not leaking internals.
- [ ] **P2** Generate and attach an **SBOM** on release (e.g. Syft/CycloneDX).
- [ ] **P2** Run containers as non-root + add Docker `HEALTHCHECK` to images.

## 5. CI/CD & governance
- [ ] **P0** **Branch protection** on `main`: require PR + green CI before merge.
- [ ] **P0** `CODEOWNERS`.
- [ ] **P1** Add a "build images (no push)" job (or reuse snapshot) so Dockerfile breakage is caught on PRs, not at release.
- [ ] **P1** Upload coverage as a CI artifact / badge.
- [ ] **P2** Release notes / `CHANGELOG.md` automation (e.g. release-please or conventional commits).
- [ ] **P2** Require the OpenAPI/SBOM artifacts on tagged releases.

## 6. Observability & ops (lower priority)
- [ ] **P2** Confirm/structure logging; expose Micrometer metrics + smallrye-health (already present) and document them.
- [ ] **P2** Document production configuration (env vars, profiles) and a minimal prod deployment example.

---

## Suggested sequencing
1. **P0 wave** — Dependabot, CodeQL, secret scanning, pin actions, Prettier+Spotless checks, SECURITY.md, JaCoCo, Vitest scaffold + first tests, branch protection, CODEOWNERS.
2. **P1 wave** — real test depth (Testcontainers backend, component tests frontend), Trivy, audit, docs/Javadoc, images-build CI job.
3. **P2 wave** — coverage gates, E2E, SBOM, ADRs, changelog automation, pre-commit hooks, non-root containers.
