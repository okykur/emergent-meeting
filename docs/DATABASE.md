# Database

## Runtime Source Of Truth

The active runtime database is PostgreSQL:

- Database: `GASS`
- Schema: `GassBooking`
- Connection variable: `POSTGRES_DSN`

MongoDB is retained only as a rollback snapshot. Do not enable the legacy mirror or route application traffic back to MongoDB without a deliberate rollback plan.

## Storage Model

The application uses `backend/postgres_compat.py` to provide document-style operations over PostgreSQL. Compatibility tables store a canonical `document jsonb` value and may expose generated columns or indexes for identifiers, status, dates, and unique keys.

This means:

- Existing documents may not all have identical optional fields.
- New reads must tolerate older records.
- New required fields need defaults, backfill, or a migration.
- Unique identifiers and state transitions still need database-safe handling.

## Principal Tables/Collections

- `users`
- `companies`
- `departments`
- `positions`
- `rooms`
- `bookings`
- `supervisor_meeting_approvals`
- `vehicles`
- `drivers`
- `vehicle_bookings`
- `password_resets`
- `counters`

Consult the migration scripts and live schema before assuming an exhaustive list.

## Important Data Rules

- Meeting and vehicle booking numbers are immutable public identifiers.
- Daily sequence allocation must be safe under concurrent requests.
- Booking overlap checks must include all active blocking statuses.
- Approval actor, decision, reason, and timestamps must remain auditable.
- Reminder sent flags and lifecycle timestamps make scheduled work idempotent.
- User references to company, department, and position should retain stable codes where available, not only display text.

## Migration Files

Relevant scripts under `deploy/` include:

- `postgres_mirror_schema.sql`
- `mongo_postgres_mirror.py`
- `smoke_postgres_compat.py`
- `add_booking_numbers.sql`
- `add_departments_master.sql`
- `add_positions_master.sql`
- `add_user_department_code.sql`
- `add_user_position_code.sql`

Apply migrations in a controlled order, record what ran, and verify row counts and representative documents afterward.

## Safe Database Work

1. Confirm the target host, database, schema, and current application release.
2. Take a backup before destructive or structural work.
3. Test migrations against a non-production copy where practical.
4. Use transactions for compatible DDL/data updates.
5. Verify indexes, constraints, counts, and application health.
6. Never commit credentials or dumps to the repository.

PostgreSQL should normally remain bound to localhost/private networking. Prefer an SSH tunnel for DBeaver rather than exposing port 5432 to the internet.
