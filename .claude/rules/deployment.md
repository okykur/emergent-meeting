---
paths:
  - "deploy/**"
  - "docs/DEPLOYMENT.md"
---

# Deployment Rules

- Deployment requires an explicit user request; local changes do not imply release approval.
- Never place credentials, SSH keys, `.env` files, database dumps, or production backups in Git.
- Verify the target server, current commit, services, database, and backup before changing production.
- Do not expose PostgreSQL publicly; prefer private networking or an SSH tunnel.
- Do not clear production transactions or master data as part of a release.
- Keep the old MongoDB mirror disabled unless executing an approved rollback plan.
- Validate backend service/logs, nginx, public API, frontend bundle, TLS, and the changed workflow after release.
