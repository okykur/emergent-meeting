# Deployment

## Production Layout

- Public host: `booking.kcsi-id.com`
- Git branch: `main`
- Backend service: `kcsi-backend`
- Backend path: `/opt/kcsi-booking/backend`
- Frontend path: `/var/www/kcsi-booking`
- Reverse proxy: nginx
- Release backups: `/opt/kcsi-booking/backups/release-<commit>`

Verify these values on the server before use; production configuration may evolve.

## Release Preconditions

1. Confirm the requested scope and that deployment was explicitly authorized.
2. Inspect `git status`, the diff, and the target commit.
3. Ensure migrations and environment changes are documented.
4. Run backend syntax/tests relevant to the change.
5. Run frontend tests and production build for frontend changes.
6. Confirm no secrets, dumps, keys, or backups are included.

## Safe Release Sequence

1. Record the current commit and service state.
2. Create a timestamped/commit-named backup of backend and frontend artifacts.
3. Apply required database migrations before code only when backward compatibility permits; otherwise use a staged migration plan.
4. Stage backend files, install them atomically where practical, and restart `kcsi-backend`.
5. Check service status and recent logs before continuing.
6. Stage the frontend build and synchronize it to `/var/www/kcsi-booking`.
7. Validate nginx configuration and reload nginx.
8. Run API, frontend, authentication, and changed-workflow smoke tests.

Do not leave a partially deployed mixed version without recording and resolving it.

## Post-deployment Checks

- `kcsi-backend` is active and stable.
- Recent backend logs contain no startup, database, scheduler, or Resend errors.
- An unauthenticated health/read endpoint returns the expected response.
- The deployed HTML references the new frontend bundle.
- Login and one representative changed workflow work through the public host.
- PostgreSQL connectivity is healthy.
- nginx configuration is valid.
- HTTPS listener and certificate are healthy. A previous check found port 443 unavailable, so verify rather than assume.

## Rollback

1. Stop further changes and capture failure evidence.
2. Restore the previous backend and frontend artifacts from the release backup.
3. Roll back database changes only with a tested reverse migration or backup restore plan.
4. Restart/reload services.
5. Repeat health and public smoke tests.
6. Record the failed release, symptoms, and rollback result.

## Prohibited Shortcuts

- Do not deploy from an unreviewed dirty worktree.
- Do not edit production `.env` values into Git.
- Do not expose PostgreSQL publicly as a deployment convenience.
- Do not clear transaction data during release validation.
- Do not run old MongoDB mirroring after the PostgreSQL cutover.
