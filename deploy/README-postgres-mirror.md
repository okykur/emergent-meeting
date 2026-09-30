# MongoDB to PostgreSQL Mirror

MongoDB remains the GASS source of truth. The mirror service copies selected
collections into separate PostgreSQL tables under `GASS.GassBooking`. Each
table exposes MongoDB fields as columns and retains the lossless Extended JSON
document in a `jsonb` column. `GassBooking.documents` remains the consolidated
rollback copy.

## Runtime

- Service: `gass-mongo-postgres-mirror.service`
- Timer: `gass-mongo-postgres-mirror.timer`
- Frequency: every five minutes
- PostgreSQL listener: localhost only
- Sync behavior: upsert current documents and prune deleted source documents
- Tables: `users`, `companies`, `counters`, `rooms`, `bookings`,
  `supervisor_meeting_approvals`, `password_resets`, `vehicles`, `drivers`, and
  `vehicle_bookings`

## Environment

`POSTGRES_MIRROR_DSN` is required and must only be stored in the protected
backend `.env` file. `MIRROR_COLLECTIONS` is optional; when omitted, the script
uses the maintained default collection list.

## Operations

Run an immediate sync:

```bash
sudo systemctl start gass-mongo-postgres-mirror.service
```

Inspect the timer and logs:

```bash
systemctl list-timers gass-mongo-postgres-mirror.timer
journalctl -u gass-mongo-postgres-mirror.service -n 100 --no-pager
```

Check the latest run:

```sql
SELECT *
FROM "GassBooking".sync_runs
ORDER BY id DESC
LIMIT 1;
```

The mirror is not used by the application and is not a PostgreSQL cutover.
