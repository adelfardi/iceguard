# Contributing to IceGuard

Thanks for your interest in improving IceGuard! 🎉 Whether it's a bug report, a feature idea,
docs, or code — contributions are very welcome.

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report bugs** — open an issue with steps to reproduce, expected vs actual behaviour, logs.
- **Suggest features** — open a feature request describing the use case.
- **Pick a `good first issue`** — great entry points for new contributors.
- **Improve docs** — README, `CLAUDE.md`, code comments.
- **Send a PR** — fixes, features, tests.

## Dev setup

Requirements: Docker + Docker Compose, JDK 21 & Maven, Node 18+.

```bash
docker compose up -d                                   # infra (MinIO, Postgres, catalogs)
cd backend  && mvn quarkus:dev -Dquarkus.profile=docker # API on :8080 (Swagger /q/swagger-ui)
cd frontend && npm install && npm run dev               # UI on :5173
./scripts/seed-catalog.sh                               # demo catalogs/tables
```

See [`CLAUDE.md`](CLAUDE.md) for architecture details and known limitations.

## Before opening a PR

Please make sure your change builds and type-checks:

```bash
# Backend
cd backend && mvn -q -DskipTests package

# Frontend
cd frontend && npx tsc --noEmit && npm run lint
```

- Add tests when you fix a bug or add behaviour (backend: JUnit/RestAssured; frontend: type-safe components).
- Keep changes focused; one logical change per PR.
- Match the surrounding code style (no project-wide reformatting in a feature PR).
- Update docs (`README.md` / `CLAUDE.md`) when you change behaviour or config.
- **Never commit secrets.** Use `.env` (git-ignored); credentials must not appear in code, compose files or history.

## Commit & PR conventions

- Write clear commit messages (a [Conventional Commits](https://www.conventionalcommits.org/) style
  such as `feat:`, `fix:`, `docs:`, `refactor:` is appreciated but not required).
- Fill in the PR template; link the issue it closes (`Closes #123`).
- CI (build + type-check) must pass. Maintainers review on a best-effort basis.

## Project structure

```
backend/   Quarkus API — api/ (REST), service/, executor/, model/, repository/, dto/
frontend/  React SPA — src/pages/, src/components/, src/api/client.ts, src/types/
scripts/   seed + helpers
```

## Reporting security issues

Please **do not** open a public issue for security vulnerabilities. Instead, contact the maintainers
privately (see the repository's security policy / contact). Treat catalog credentials and the Postgres
database as sensitive.

## License

By contributing, you agree that your contributions will be licensed under the
[Apache License 2.0](LICENSE).
