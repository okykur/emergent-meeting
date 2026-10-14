BEGIN;

CREATE TABLE IF NOT EXISTS "GassBooking".positions (
    id text PRIMARY KEY,
    document jsonb NOT NULL,
    synced_at timestamptz NOT NULL DEFAULT now(),
    code_position text GENERATED ALWAYS AS (document ->> 'code_position') STORED,
    position_name text GENERATED ALWAYS AS (document ->> 'position_name') STORED,
    created_date text GENERATED ALWAYS AS (NULLIF(document ->> 'created_date', '')) STORED,
    created_by text GENERATED ALWAYS AS (document ->> 'created_by') STORED,
    updated_by text GENERATED ALWAYS AS (document ->> 'updated_by') STORED,
    updated_date text GENERATED ALWAYS AS (NULLIF(document ->> 'updated_date', '')) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS positions_code_position_uk
    ON "GassBooking".positions (code_position);
CREATE UNIQUE INDEX IF NOT EXISTS positions_position_name_lower_uk
    ON "GassBooking".positions (lower(position_name));

GRANT SELECT, INSERT, UPDATE, DELETE ON "GassBooking".positions TO gass_mirror;

COMMIT;
