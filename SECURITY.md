# Security Policy

## Supported versions

IceGuard is pre-1.0. Security fixes are applied to the latest release and the `main` branch.

| Version        | Supported |
|----------------|-----------|
| latest (`0.x`) | ✅        |
| older releases | ❌        |

## Reporting a vulnerability

**Please do not report security issues in public GitHub issues.**

Use GitHub's private vulnerability reporting:
**Security** tab → **Report a vulnerability** → *Privately report a security vulnerability*.
This opens a private advisory visible only to the maintainers.

Please include:
- affected version or commit,
- reproduction steps,
- impact / severity, and any suggested fix.

We aim to acknowledge a report within **5 business days** and to agree a remediation
timeline after triage. Please give us a reasonable window to release a fix before any
public disclosure.

## Operational notes

- IceGuard connects to **your** Iceberg catalogs and object stores. Credentials you register
  are stored in IceGuard's own PostgreSQL — protect that database and restrict who can register
  or read catalogs.
- **OIDC is disabled by default.** Do not expose an instance publicly without putting
  authentication in front of it (reverse proxy / SSO) and locking down network access.
- Never commit secrets. `.env`, `key`/`*.key`, `*.pem` and credential files are git-ignored; use
  environment variables or a secrets manager instead.
