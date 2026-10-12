BEGIN;

ALTER TABLE "GassBooking".users
    ADD COLUMN IF NOT EXISTS department_code text
    GENERATED ALWAYS AS (document ->> 'department_code') STORED;

CREATE INDEX IF NOT EXISTS users_department_code_idx
    ON "GassBooking".users (department_code);

UPDATE "GassBooking".users AS users
SET document = jsonb_set(users.document, '{department_code}', to_jsonb(departments.code_dept), true),
    synced_at = now()
FROM "GassBooking".departments AS departments
WHERE lower(btrim(users.department)) = lower(btrim(departments.dept_name))
  AND COALESCE(users.department_code, '') = '';

GRANT SELECT, INSERT, UPDATE, DELETE ON "GassBooking".users TO gass_mirror;

COMMIT;
