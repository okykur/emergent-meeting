BEGIN;

CREATE TABLE IF NOT EXISTS "GassBooking".departments (
    id text PRIMARY KEY,
    document jsonb NOT NULL,
    synced_at timestamptz NOT NULL DEFAULT now(),
    code_dept text GENERATED ALWAYS AS (document ->> 'code_dept') STORED,
    dept_name text GENERATED ALWAYS AS (document ->> 'dept_name') STORED,
    created_date text GENERATED ALWAYS AS (NULLIF(document ->> 'created_date', '')) STORED,
    created_by text GENERATED ALWAYS AS (document ->> 'created_by') STORED,
    updated_by text GENERATED ALWAYS AS (document ->> 'updated_by') STORED,
    updated_date text GENERATED ALWAYS AS (NULLIF(document ->> 'updated_date', '')) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS departments_code_dept_uk
    ON "GassBooking".departments (code_dept);
CREATE UNIQUE INDEX IF NOT EXISTS departments_dept_name_lower_uk
    ON "GassBooking".departments (lower(dept_name));

GRANT SELECT, INSERT, UPDATE, DELETE ON "GassBooking".departments TO gass_mirror;

COMMIT;
