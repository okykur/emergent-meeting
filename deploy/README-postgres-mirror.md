# PostgreSQL Runtime and MongoDB Rollback

PostgreSQL is the GASS application source of truth. The backend reads and
writes database `GASS`, schema `GassBooking`, through `POSTGRES_DSN`. Each
collection-compatible table retains the complete document in a `jsonb` column
while exposing frequently used fields as generated columns.

MongoDB is retained temporarily as a rollback snapshot. It is not read or
written by the application runtime. Do not enable the legacy mirror timer after
cutover because it would overwrite PostgreSQL data with the stale MongoDB copy.

## Runtime

- Backend service: `kcsi-backend.service`
- Backend database setting: `POSTGRES_DSN`
- Legacy mirror timer: disabled
- PostgreSQL listener: localhost only
- Tables: `users`, `companies`, `counters`, `rooms`, `bookings`,
  `supervisor_meeting_approvals`, `password_resets`, `vehicles`, `drivers`, and
  `vehicle_bookings`

## Environment

`POSTGRES_DSN` is required and must only be stored in the protected backend
`.env` file. `MONGO_URL`, `DB_NAME`, `POSTGRES_MIRROR_DSN`, and
`MIRROR_COLLECTIONS` are legacy migration settings and are not required by the
application runtime.

## Operations

Inspect the backend and verify that the legacy mirror remains disabled:

```bash
systemctl status kcsi-backend --no-pager
systemctl is-enabled gass-mongo-postgres-mirror.timer
```

Inspect backend logs:

```bash
journalctl -u kcsi-backend -n 100 --no-pager
```

Check PostgreSQL data directly:

```sql
SELECT count(*) FROM "GassBooking".bookings;
```
