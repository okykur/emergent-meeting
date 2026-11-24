# ADR 001: PostgreSQL Is The Runtime Source Of Truth

- Status: Accepted
- Date: 2026-10

## Context

GASS originally used MongoDB. The application needed PostgreSQL while preserving existing document shapes and reducing the risk of a full domain rewrite during migration.

## Decision

Use PostgreSQL database `GASS` and schema `GassBooking` as the runtime source of truth. Retain document-oriented application access through a JSONB compatibility layer in `backend/postgres_compat.py`.

MongoDB remains only as a rollback snapshot. The legacy continuous mirror must remain disabled after cutover.

## Consequences

- Existing business logic can migrate incrementally.
- JSONB document compatibility reduces immediate rewrite risk.
- The schema is not fully normalized and requires careful indexing and migration discipline.
- New code must use PostgreSQL-compatible access and tolerate older document variants.
- Re-enabling MongoDB requires an explicit rollback decision, not an incidental configuration change.
