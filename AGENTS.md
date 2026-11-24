# GASS Project Instructions

## Purpose

GASS is an internal General Affair Services System for meeting-room and vehicle bookings. It includes sequential approvals, operational dashboards, master data, check-in/check-out, room reassignment, and transactional email notifications.

These instructions apply to every coding agent. Provider-specific files may add workflow hints but must not contradict this file.

## Sources Of Truth

Use this precedence when information conflicts:

1. Executable source code and database migrations.
2. Accepted decisions in `docs/decisions/`.
3. Current documents in `docs/`.
4. Tests.
5. Historical files such as `memory/PRD.md`.

Update the relevant document when a change alters architecture, business rules, database shape, email behavior, or deployment.

## Repository Map

- `backend/server.py`: FastAPI application, API routes, domain workflows, email, and scheduler.
- `backend/postgres_compat.py`: Mongo-like document compatibility layer backed by PostgreSQL.
- `backend/tests/`: backend tests.
- `frontend/src/`: React application, pages, components, routing, and API integration.
- `deploy/`: PostgreSQL migration and production support scripts.
- `docs/`: current handover and engineering knowledge.

## Runtime Architecture

- Frontend: React 18, React Router, Tailwind CSS, CRACO.
- Backend: FastAPI/Python.
- Runtime database: PostgreSQL database `GASS`, schema `GassBooking`.
- PostgreSQL documents use JSONB compatibility tables; MongoDB is retained only as a rollback snapshot and is not the runtime source of truth.
- Transactional email: Resend using `RESEND_API_KEY` and `RESEND_FROM`.
- Trial WhatsApp notifications: internal EVA gateway using `WHATSAPP_GATEWAY_*` environment variables.
- Business time zone: `Asia/Jakarta`, controlled by `APP_TIMEZONE`.

## Roles

- `super_admin`: full administration, user activation, all masters, dashboards, and approvals.
- `meeting_admin`: meeting approval and room operations.
- `car_admin`: vehicle approval and operations.
- `manager`: UI label `Manager GA`; retains the existing Manager GA approval privileges.
- `manager_user`: requester supervisor approval in the meeting workflow.
- `user`: self-service booking and own booking lifecycle.

Never rename a stored role merely to change its UI label. Preserve authorization behavior unless the requested change explicitly includes a privilege migration.

## Critical Invariants

- Meeting booking ID: `MR` + `yymmdd` + four-digit daily sequence.
- Vehicle booking ID: `BK` + `yymmdd` + four-digit daily sequence.
- Meeting slots are blocked while status is `pending`, `confirmed`, `approved`, or `in_progress`.
- Meeting approval is sequential: Meeting Admin, then Manager User when selected, then Manager GA when selected.
- If both managers are selected, Manager GA cannot act before Manager User approves.
- A rejection at any required approval step terminates the approval chain.
- A meeting without required manager approvals becomes confirmed after Meeting Admin approval.
- Check-in changes a confirmed booking to `in_progress`.
- Manual check-out is allowed any time after check-in and changes status to `completed`.
- Auto check-out occurs five minutes after meeting end when still `in_progress`.
- Meeting reminders are based on Asia/Jakarta: confirmation two hours before, check-in ten minutes before, check-out ten minutes before end, completion after check-out.
- Meeting Admin may reassign a room before the meeting starts, but not after check-in. Reassignment notifies the requester.
- Master data must not be deleted or transaction data cleared without an explicit request and a verified backup.

See `docs/BUSINESS_RULES.md` for the complete workflow.

## Development Commands

Backend checks from `backend/`:

```powershell
python -m py_compile server.py
python -m unittest tests/test_meeting_reminders.py
```

Run the available backend suite when changing shared workflows:

```powershell
python -m unittest discover -s tests
```

Frontend checks from `frontend/`:

```powershell
npm test -- --watchAll=false --runInBand
npm run build
```

Prefer focused tests while iterating, then run the broadest practical checks before release.

## Engineering Rules

- Inspect existing code and tests before editing; do not recreate an already implemented workflow.
- Preserve unrelated user changes in a dirty worktree.
- Keep API authorization on the backend; hiding a frontend control is not access control.
- Store and compare timestamps consistently, then render business times in Asia/Jakarta.
- Make scheduler and email operations idempotent. A repeated scan must not send duplicate messages or repeat a state transition.
- Keep WhatsApp best-effort and additive to email. Gateway failure must not roll back a booking state transition.
- Do not log tokens, passwords, Resend keys, database credentials, or approval-link secrets.
- Do not hardcode production hosts or credentials when an environment variable exists.
- Add or update tests for state transitions, role checks, approval order, and error cases.

## Deployment Safety

- Do not deploy merely because code was changed; deploy only when explicitly requested.
- Never commit secrets, SSH keys, `.env` values, database dumps, or production backups.
- Before deployment: inspect the diff, run relevant tests/build, and create a release backup.
- After deployment: verify service status, logs, API health, frontend assets, and a public smoke test.
- Never clear production transactions, alter firewall rules, or expose PostgreSQL publicly without explicit authorization.
- Follow `docs/DEPLOYMENT.md` for the release and rollback sequence.

## Knowledge Map

- Start/session handover: `docs/PROJECT_HANDOVER.md`
- System structure: `docs/ARCHITECTURE.md`
- Domain behavior: `docs/BUSINESS_RULES.md`
- Persistence: `docs/DATABASE.md`
- Email: `docs/EMAIL_WORKFLOWS.md`
- WhatsApp: `docs/WHATSAPP_NOTIFICATIONS.md`
- Production: `docs/DEPLOYMENT.md`
- Decisions: `docs/decisions/`
