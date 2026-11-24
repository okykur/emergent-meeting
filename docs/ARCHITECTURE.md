# Architecture

## Overview

GASS is a web application with a React single-page frontend, a FastAPI backend, PostgreSQL persistence, and Resend transactional email.

```text
Browser
  -> nginx/static React application
  -> /api requests
  -> FastAPI backend
  -> PostgreSQL GASS.GassBooking
  -> Resend API for transactional email
  -> Internal EVA gateway for trial WhatsApp notifications
```

The backend also runs time-based meeting reminder and auto-checkout processing. Every scheduled action must be idempotent because a process restart or multiple workers can repeat a scan.

## Frontend

- Entry and routing: `frontend/src/App.js`.
- Shared authenticated shell: `frontend/src/components/Layout.jsx`.
- Route authorization: protected-route components and backend authorization.
- Pages cover self-service booking, approval queues, dashboards, user administration, and master data.
- API failures must display actionable messages without exposing internal errors or credentials.

Role-based visibility is a usability feature. Backend role validation remains mandatory for every protected operation.

## Backend

`backend/server.py` currently contains:

- FastAPI routes and request/response models.
- Authentication and role checks.
- Meeting and vehicle domain transitions.
- Master-data CRUD.
- Resend email generation and sending.
- Reminder scheduler and auto-checkout logic.

`backend/postgres_compat.py` exposes Mongo-style collection operations over PostgreSQL JSONB documents. This allows the migrated application code to retain document-oriented access patterns while PostgreSQL is the source of truth.

## Persistence

- Database: `GASS`.
- Schema: `GassBooking`.
- Application connection: `POSTGRES_DSN`.
- Collections are represented by PostgreSQL tables containing a `document jsonb` column plus generated/indexed fields where needed.
- Schema changes are recorded as scripts in `deploy/`.

See `DATABASE.md` for table and migration details.

## External Integrations

### Resend

Resend sends registration, approval, booking, reassignment, reminder, and completion messages. Email assets must use publicly accessible URLs or valid inline content; do not pass inaccessible local URLs as attachments.

### WhatsApp Gateway

`backend/whatsapp_gateway.py` sends best-effort text notifications to the internal EVA gateway. The API key is backend-only, recipient numbers are normalized before sending, and deterministic idempotency keys protect scheduled retries from duplicate messages. During the trial, email remains the primary channel.

### Production Host

nginx serves the frontend and proxies API traffic to the FastAPI service. systemd manages the backend as `kcsi-backend`.

## Architectural Constraints

- Asia/Jakarta is the business time zone even if the server runs in another zone.
- Approval steps are ordered state transitions, not independent flags.
- Booking and email operations require idempotency.
- PostgreSQL is authoritative; do not silently reactivate the legacy MongoDB mirror.
- Changes to shared document shapes must remain compatible with existing records or include a controlled migration.
