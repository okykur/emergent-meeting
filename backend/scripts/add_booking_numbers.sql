BEGIN;

ALTER TABLE "GassBooking".bookings
    ADD COLUMN IF NOT EXISTS booking_number text
    GENERATED ALWAYS AS (document ->> 'booking_number') STORED;

ALTER TABLE "GassBooking".vehicle_bookings
    ADD COLUMN IF NOT EXISTS booking_number text
    GENERATED ALWAYS AS (document ->> 'booking_number') STORED;

WITH existing_max AS (
    SELECT SUBSTRING(booking_number FROM 3 FOR 6) AS date_segment,
           COALESCE(MAX(RIGHT(booking_number, 4)::integer), 0) AS max_seq
    FROM "GassBooking".bookings
    WHERE booking_number ~ '^MR[0-9]{10}$'
    GROUP BY SUBSTRING(booking_number FROM 3 FOR 6)
), missing_base AS (
    SELECT b.id, b.created_at,
           CASE
               WHEN b.created_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
                   THEN to_char(b.created_at::timestamptz AT TIME ZONE 'Asia/Jakarta', 'YYMMDD')
               ELSE to_char(to_date(b."date", 'YYYY-MM-DD'), 'YYMMDD')
           END AS date_segment
    FROM "GassBooking".bookings b
    WHERE COALESCE(b.booking_number, '') = ''
      AND (b.created_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' OR b."date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
), missing AS (
    SELECT b.id, b.date_segment,
           COALESCE(e.max_seq, 0) + ROW_NUMBER() OVER (
               PARTITION BY b.date_segment ORDER BY b.created_at, b.id
           ) AS seq
    FROM missing_base b
    LEFT JOIN existing_max e ON e.date_segment = b.date_segment
)
UPDATE "GassBooking".bookings b
SET document = jsonb_set(
    b.document,
    '{booking_number}',
    to_jsonb('MR' || m.date_segment || lpad(m.seq::text, 4, '0'))
)
FROM missing m
WHERE b.id = m.id;

WITH existing_max AS (
    SELECT SUBSTRING(booking_number FROM 3 FOR 6) AS date_segment,
           COALESCE(MAX(RIGHT(booking_number, 4)::integer), 0) AS max_seq
    FROM "GassBooking".vehicle_bookings
    WHERE booking_number ~ '^BK[0-9]{10}$'
    GROUP BY SUBSTRING(booking_number FROM 3 FOR 6)
), missing_base AS (
    SELECT b.id, b.created_at,
           CASE
               WHEN b.created_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
                   THEN to_char(b.created_at::timestamptz AT TIME ZONE 'Asia/Jakarta', 'YYMMDD')
               ELSE to_char(to_date(b.start_date, 'YYYY-MM-DD'), 'YYMMDD')
           END AS date_segment
    FROM "GassBooking".vehicle_bookings b
    WHERE COALESCE(b.booking_number, '') = ''
      AND (b.created_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' OR b.start_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
), missing AS (
    SELECT b.id, b.date_segment,
           COALESCE(e.max_seq, 0) + ROW_NUMBER() OVER (
               PARTITION BY b.date_segment ORDER BY b.created_at, b.id
           ) AS seq
    FROM missing_base b
    LEFT JOIN existing_max e ON e.date_segment = b.date_segment
)
UPDATE "GassBooking".vehicle_bookings b
SET document = jsonb_set(
    b.document,
    '{booking_number}',
    to_jsonb('BK' || m.date_segment || lpad(m.seq::text, 4, '0'))
)
FROM missing m
WHERE b.id = m.id;

INSERT INTO "GassBooking".counters AS target (id, document)
SELECT
    'booking_number:MR:' || SUBSTRING(booking_number FROM 3 FOR 6),
    jsonb_build_object(
        '_id', 'booking_number:MR:' || SUBSTRING(booking_number FROM 3 FOR 6),
        'seq', MAX(RIGHT(booking_number, 4)::integer)
    )
FROM "GassBooking".bookings
WHERE booking_number ~ '^MR[0-9]{10}$'
GROUP BY SUBSTRING(booking_number FROM 3 FOR 6)
ON CONFLICT (id) DO UPDATE
SET document = jsonb_set(
        target.document,
        '{seq}',
        to_jsonb(GREATEST(
            COALESCE((target.document ->> 'seq')::bigint, 0),
            COALESCE((EXCLUDED.document ->> 'seq')::bigint, 0)
        )),
        true
    ),
    synced_at = now();

INSERT INTO "GassBooking".counters AS target (id, document)
SELECT
    'booking_number:BK:' || SUBSTRING(booking_number FROM 3 FOR 6),
    jsonb_build_object(
        '_id', 'booking_number:BK:' || SUBSTRING(booking_number FROM 3 FOR 6),
        'seq', MAX(RIGHT(booking_number, 4)::integer)
    )
FROM "GassBooking".vehicle_bookings
WHERE booking_number ~ '^BK[0-9]{10}$'
GROUP BY SUBSTRING(booking_number FROM 3 FOR 6)
ON CONFLICT (id) DO UPDATE
SET document = jsonb_set(
        target.document,
        '{seq}',
        to_jsonb(GREATEST(
            COALESCE((target.document ->> 'seq')::bigint, 0),
            COALESCE((EXCLUDED.document ->> 'seq')::bigint, 0)
        )),
        true
    ),
    synced_at = now();

CREATE UNIQUE INDEX IF NOT EXISTS bookings_booking_number_uk
    ON "GassBooking".bookings (booking_number)
    WHERE booking_number IS NOT NULL AND booking_number <> '';

CREATE UNIQUE INDEX IF NOT EXISTS vehicle_bookings_booking_number_uk
    ON "GassBooking".vehicle_bookings (booking_number)
    WHERE booking_number IS NOT NULL AND booking_number <> '';

COMMIT;
