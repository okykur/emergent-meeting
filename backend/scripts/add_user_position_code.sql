BEGIN;

ALTER TABLE "GassBooking".users
    ADD COLUMN IF NOT EXISTS position_code text
    GENERATED ALWAYS AS (document ->> 'position_code') STORED;

CREATE INDEX IF NOT EXISTS users_position_code_idx
    ON "GassBooking".users (position_code);

UPDATE "GassBooking".users AS users
SET document = jsonb_set(users.document, '{position_code}', to_jsonb(positions.code_position), true),
    synced_at = now()
FROM "GassBooking".positions AS positions
WHERE lower(btrim(users.job_title)) = lower(btrim(positions.position_name))
  AND COALESCE(users.position_code, '') = '';

GRANT SELECT, INSERT, UPDATE, DELETE ON "GassBooking".users TO gass_mirror;

COMMIT;
