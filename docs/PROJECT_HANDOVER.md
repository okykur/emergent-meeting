# Project Handover

Last updated: 2026-11-24

## Current State

GASS currently supports meeting-room and vehicle booking, approval workflows, master data, operational dashboards, email notifications, and the meeting check-in/check-out lifecycle.

The runtime backend uses PostgreSQL through a JSONB compatibility layer. MongoDB is not the active application database. The production application is served at `booking.kcsi-id.com`.

## Last Known Release

- Repository: `https://github.com/okykur/emergent-meeting.git`
- Branch: `main`
- Last deployed commit verified during the preceding work: `82534bf`
- Backend service: `kcsi-backend`
- Backend directory: `/opt/kcsi-booking/backend`
- Frontend web root: `/var/www/kcsi-booking`
- Reverse proxy: nginx

These are handover facts, not a guarantee of current production state. Recheck Git, systemd, nginx, and public endpoints before any production change.

## Implemented Areas

- Four-step meeting booking form.
- Distinct meeting and vehicle booking IDs.
- Meeting Admin approval and optional sequential Manager User/Manager GA approval.
- Room reassignment before meeting start with requester email notification.
- Meeting confirmation, check-in, manual check-out, check-out reminder, auto check-out, and completion email.
- Vehicle request, approval, assignment, handover, return, and completion flow.
- Super Admin master CRUD for companies, departments, and positions.
- Searchable company, department, and position selectors in registration and user administration.
- Combined dashboard module with meeting and vehicle views, controlled by role.
- Resend templates for account and booking events.
- Trial EVA WhatsApp adapter for requester approval/rejection, room reassignment, and meeting lifecycle notifications.
- PostgreSQL runtime migration with MongoDB retained for rollback only.

## Recent Verification Baseline

The release around commit `82534bf` passed frontend build, frontend tests, Python syntax validation, and focused meeting reminder tests. Always rerun checks because dependencies and code may have changed.

## Known Risks And Follow-up Checks

- `backend/server.py` is a large monolith. Prefer incremental extraction only with regression tests.
- JSONB compatibility reduced migration risk but does not provide a fully normalized relational model.
- The legacy `memory/PRD.md` describes an older MongoDB architecture and must not guide new implementation.
- HTTPS on port 443 was not listening during one previous verification. Confirm the current TLS/nginx state before treating this as an active incident.
- Email delivery depends on valid Resend credentials, verified sender/domain, public image URLs, and idempotency flags.
- Scheduler behavior depends on exactly one effective scheduler owner or otherwise idempotent database flags.

## Starting A New Session

1. Read `AGENTS.md` and this handover.
2. Run `git status` and inspect recent commits.
3. Verify the implementation relevant to the request instead of relying only on documentation.
4. Read the matching document in `docs/` and accepted ADRs.
5. Update tests and documentation when behavior changes.
6. Do not push or deploy unless the user explicitly requests it.
