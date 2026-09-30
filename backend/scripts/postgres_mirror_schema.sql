CREATE TABLE IF NOT EXISTS "GassBooking".users (
    id text PRIMARY KEY,
    document jsonb NOT NULL,
    synced_at timestamptz NOT NULL DEFAULT now(),
    mongo_id text GENERATED ALWAYS AS (document #>> '{_id,$oid}') STORED,
    email text GENERATED ALWAYS AS (document ->> 'email') STORED,
    password_hash text GENERATED ALWAYS AS (document ->> 'password_hash') STORED,
    name text GENERATED ALWAYS AS (document ->> 'name') STORED,
    company_name text GENERATED ALWAYS AS (document ->> 'company_name') STORED,
    job_title text GENERATED ALWAYS AS (document ->> 'job_title') STORED,
    department text GENERATED ALWAYS AS (document ->> 'department') STORED,
    office_address text GENERATED ALWAYS AS (document ->> 'office_address') STORED,
    supervisor_name text GENERATED ALWAYS AS (document ->> 'supervisor_name') STORED,
    supervisor_email text GENERATED ALWAYS AS (document ->> 'supervisor_email') STORED,
    meeting_buildings jsonb GENERATED ALWAYS AS (document -> 'meeting_buildings') STORED,
    fnb_locations jsonb GENERATED ALWAYS AS (document -> 'fnb_locations') STORED,
    role text GENERATED ALWAYS AS (document ->> 'role') STORED,
    is_approved boolean GENERATED ALWAYS AS (NULLIF(document ->> 'is_approved', '')::boolean) STORED,
    approval_status text GENERATED ALWAYS AS (document ->> 'approval_status') STORED,
    approved_at text GENERATED ALWAYS AS (NULLIF(document ->> 'approved_at', '')) STORED,
    approved_by text GENERATED ALWAYS AS (document ->> 'approved_by') STORED,
    rejected_at text GENERATED ALWAYS AS (NULLIF(document ->> 'rejected_at', '')) STORED,
    rejected_by text GENERATED ALWAYS AS (document ->> 'rejected_by') STORED,
    rejection_reason text GENERATED ALWAYS AS (document ->> 'rejection_reason') STORED,
    created_at text GENERATED ALWAYS AS (NULLIF(document ->> 'created_at', '')) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uk ON "GassBooking".users (email);
CREATE INDEX IF NOT EXISTS users_role_idx ON "GassBooking".users (role);
CREATE INDEX IF NOT EXISTS users_approval_status_idx ON "GassBooking".users (approval_status);

CREATE TABLE IF NOT EXISTS "GassBooking".companies (
    id text PRIMARY KEY,
    document jsonb NOT NULL,
    synced_at timestamptz NOT NULL DEFAULT now(),
    mongo_id text GENERATED ALWAYS AS (document #>> '{_id,$oid}') STORED,
    system_number text GENERATED ALWAYS AS (document ->> 'system_number') STORED,
    company_code text GENERATED ALWAYS AS (document ->> 'company_code') STORED,
    company_name text GENERATED ALWAYS AS (document ->> 'company_name') STORED,
    created_at text GENERATED ALWAYS AS (NULLIF(document ->> 'created_at', '')) STORED,
    created_by text GENERATED ALWAYS AS (document ->> 'created_by') STORED,
    created_by_id text GENERATED ALWAYS AS (document ->> 'created_by_id') STORED,
    updated_by text GENERATED ALWAYS AS (document ->> 'updated_by') STORED,
    updated_by_id text GENERATED ALWAYS AS (document ->> 'updated_by_id') STORED,
    datetime_updated text GENERATED ALWAYS AS (NULLIF(document ->> 'datetime_updated', '')) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS companies_system_number_uk ON "GassBooking".companies (system_number);
CREATE UNIQUE INDEX IF NOT EXISTS companies_company_code_uk ON "GassBooking".companies (company_code);

CREATE TABLE IF NOT EXISTS "GassBooking".counters (
    id text PRIMARY KEY,
    document jsonb NOT NULL,
    synced_at timestamptz NOT NULL DEFAULT now(),
    seq bigint GENERATED ALWAYS AS (NULLIF(document ->> 'seq', '')::bigint) STORED
);

CREATE TABLE IF NOT EXISTS "GassBooking".rooms (
    id text PRIMARY KEY,
    document jsonb NOT NULL,
    synced_at timestamptz NOT NULL DEFAULT now(),
    mongo_id text GENERATED ALWAYS AS (document #>> '{_id,$oid}') STORED,
    name text GENERATED ALWAYS AS (document ->> 'name') STORED,
    building text GENERATED ALWAYS AS (document ->> 'building') STORED,
    location text GENERATED ALWAYS AS (document ->> 'location') STORED,
    capacity integer GENERATED ALWAYS AS (NULLIF(document ->> 'capacity', '')::integer) STORED,
    facilities jsonb GENERATED ALWAYS AS (document -> 'facilities') STORED,
    description text GENERATED ALWAYS AS (document ->> 'description') STORED,
    image_url text GENERATED ALWAYS AS (document ->> 'image_url') STORED,
    is_active boolean GENERATED ALWAYS AS (NULLIF(document ->> 'is_active', '')::boolean) STORED,
    operating_start_time text GENERATED ALWAYS AS (NULLIF(document ->> 'operating_start_time', '')) STORED,
    operating_end_time text GENERATED ALWAYS AS (NULLIF(document ->> 'operating_end_time', '')) STORED,
    layout_fixed boolean GENERATED ALWAYS AS (NULLIF(document ->> 'layout_fixed', '')::boolean) STORED,
    created_at text GENERATED ALWAYS AS (NULLIF(document ->> 'created_at', '')) STORED
);

CREATE INDEX IF NOT EXISTS rooms_building_idx ON "GassBooking".rooms (building);

CREATE TABLE IF NOT EXISTS "GassBooking".bookings (
    id text PRIMARY KEY,
    document jsonb NOT NULL,
    synced_at timestamptz NOT NULL DEFAULT now(),
    mongo_id text GENERATED ALWAYS AS (document #>> '{_id,$oid}') STORED,
    room_id text GENERATED ALWAYS AS (document ->> 'room_id') STORED,
    room_name text GENERATED ALWAYS AS (document ->> 'room_name') STORED,
    room_building text GENERATED ALWAYS AS (document ->> 'room_building') STORED,
    user_id text GENERATED ALWAYS AS (document ->> 'user_id') STORED,
    user_name text GENERATED ALWAYS AS (document ->> 'user_name') STORED,
    user_email text GENERATED ALWAYS AS (document ->> 'user_email') STORED,
    title text GENERATED ALWAYS AS (document ->> 'title') STORED,
    "date" text GENERATED ALWAYS AS (NULLIF(document ->> 'date', '')) STORED,
    start_time text GENERATED ALWAYS AS (NULLIF(document ->> 'start_time', '')) STORED,
    end_time text GENERATED ALWAYS AS (NULLIF(document ->> 'end_time', '')) STORED,
    participants integer GENERATED ALWAYS AS (NULLIF(document ->> 'participants', '')::integer) STORED,
    layout_type text GENERATED ALWAYS AS (document ->> 'layout_type') STORED,
    layout_other text GENERATED ALWAYS AS (document ->> 'layout_other') STORED,
    phone_number text GENERATED ALWAYS AS (document ->> 'phone_number') STORED,
    additional_facilities jsonb GENERATED ALWAYS AS (document -> 'additional_facilities') STORED,
    food_beverages text GENERATED ALWAYS AS (document ->> 'food_beverages') STORED,
    fnb_department text GENERATED ALWAYS AS (document ->> 'fnb_department') STORED,
    fnb_division text GENERATED ALWAYS AS (document ->> 'fnb_division') STORED,
    fnb_cost_center text GENERATED ALWAYS AS (document ->> 'fnb_cost_center') STORED,
    fnb_activity_code text GENERATED ALWAYS AS (document ->> 'fnb_activity_code') STORED,
    fnb_activity_name text GENERATED ALWAYS AS (document ->> 'fnb_activity_name') STORED,
    guest_type text GENERATED ALWAYS AS (document ->> 'guest_type') STORED,
    guest_pic text GENERATED ALWAYS AS (document ->> 'guest_pic') STORED,
    guest_counts jsonb GENERATED ALWAYS AS (document -> 'guest_counts') STORED,
    snack_type text GENERATED ALWAYS AS (document ->> 'snack_type') STORED,
    snack_times integer GENERATED ALWAYS AS (NULLIF(document ->> 'snack_times', '')::integer) STORED,
    snack_pax integer GENERATED ALWAYS AS (NULLIF(document ->> 'snack_pax', '')::integer) STORED,
    snack_packaging text GENERATED ALWAYS AS (document ->> 'snack_packaging') STORED,
    meal_types jsonb GENERATED ALWAYS AS (document -> 'meal_types') STORED,
    meal_pax integer GENERATED ALWAYS AS (NULLIF(document ->> 'meal_pax', '')::integer) STORED,
    meal_packaging text GENERATED ALWAYS AS (document ->> 'meal_packaging') STORED,
    fnb_status text GENERATED ALWAYS AS (document ->> 'fnb_status') STORED,
    fnb_reviewed_at text GENERATED ALWAYS AS (NULLIF(document ->> 'fnb_reviewed_at', '')) STORED,
    fnb_reviewed_by text GENERATED ALWAYS AS (document ->> 'fnb_reviewed_by') STORED,
    notes text GENERATED ALWAYS AS (document ->> 'notes') STORED,
    status text GENERATED ALWAYS AS (document ->> 'status') STORED,
    created_at text GENERATED ALWAYS AS (NULLIF(document ->> 'created_at', '')) STORED,
    checked_in_at text GENERATED ALWAYS AS (NULLIF(document ->> 'checked_in_at', '')) STORED,
    checked_out_at text GENERATED ALWAYS AS (NULLIF(document ->> 'checked_out_at', '')) STORED,
    room_reassigned_from_name text GENERATED ALWAYS AS (document ->> 'room_reassigned_from_name') STORED,
    room_reassigned_at text GENERATED ALWAYS AS (NULLIF(document ->> 'room_reassigned_at', '')) STORED,
    room_reassigned_by text GENERATED ALWAYS AS (document ->> 'room_reassigned_by') STORED,
    cancellation_reason text GENERATED ALWAYS AS (document ->> 'cancellation_reason') STORED,
    rejection_reason text GENERATED ALWAYS AS (document ->> 'rejection_reason') STORED,
    rejected_at text GENERATED ALWAYS AS (NULLIF(document ->> 'rejected_at', '')) STORED,
    rejected_by text GENERATED ALWAYS AS (document ->> 'rejected_by') STORED,
    cancelled_at text GENERATED ALWAYS AS (NULLIF(document ->> 'cancelled_at', '')) STORED,
    cancelled_by text GENERATED ALWAYS AS (document ->> 'cancelled_by') STORED,
    fnb_cancelled_at text GENERATED ALWAYS AS (NULLIF(document ->> 'fnb_cancelled_at', '')) STORED,
    fnb_cancelled_by text GENERATED ALWAYS AS (document ->> 'fnb_cancelled_by') STORED,
    supervisor_name text GENERATED ALWAYS AS (document ->> 'supervisor_name') STORED,
    supervisor_email text GENERATED ALWAYS AS (document ->> 'supervisor_email') STORED,
    supervisor_approval_status text GENERATED ALWAYS AS (document ->> 'supervisor_approval_status') STORED,
    supervisor_approval_requested_at text GENERATED ALWAYS AS (NULLIF(document ->> 'supervisor_approval_requested_at', '')) STORED,
    supervisor_approved_at text GENERATED ALWAYS AS (NULLIF(document ->> 'supervisor_approved_at', '')) STORED,
    supervisor_approved_by text GENERATED ALWAYS AS (document ->> 'supervisor_approved_by') STORED,
    meeting_admin_approval_status text GENERATED ALWAYS AS (document ->> 'meeting_admin_approval_status') STORED,
    meeting_admin_reviewed_at text GENERATED ALWAYS AS (NULLIF(document ->> 'meeting_admin_reviewed_at', '')) STORED,
    meeting_admin_reviewed_by text GENERATED ALWAYS AS (document ->> 'meeting_admin_reviewed_by') STORED,
    approval_require_manager_user boolean GENERATED ALWAYS AS (NULLIF(document ->> 'approval_require_manager_user', '')::boolean) STORED,
    approval_require_manager_ga boolean GENERATED ALWAYS AS (NULLIF(document ->> 'approval_require_manager_ga', '')::boolean) STORED,
    manager_user_approval_status text GENERATED ALWAYS AS (document ->> 'manager_user_approval_status') STORED,
    manager_user_reviewed_at text GENERATED ALWAYS AS (NULLIF(document ->> 'manager_user_reviewed_at', '')) STORED,
    manager_user_reviewed_by text GENERATED ALWAYS AS (document ->> 'manager_user_reviewed_by') STORED,
    manager_ga_approval_status text GENERATED ALWAYS AS (document ->> 'manager_ga_approval_status') STORED,
    manager_ga_reviewed_at text GENERATED ALWAYS AS (NULLIF(document ->> 'manager_ga_reviewed_at', '')) STORED,
    manager_ga_reviewed_by text GENERATED ALWAYS AS (document ->> 'manager_ga_reviewed_by') STORED
);

CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON "GassBooking".bookings (user_id);
CREATE INDEX IF NOT EXISTS bookings_room_date_idx ON "GassBooking".bookings (room_id, "date");
CREATE INDEX IF NOT EXISTS bookings_status_idx ON "GassBooking".bookings (status);

CREATE TABLE IF NOT EXISTS "GassBooking".supervisor_meeting_approvals (
    id text PRIMARY KEY,
    document jsonb NOT NULL,
    synced_at timestamptz NOT NULL DEFAULT now(),
    mongo_id text GENERATED ALWAYS AS (document #>> '{_id,$oid}') STORED,
    booking_id text GENERATED ALWAYS AS (document ->> 'booking_id') STORED,
    supervisor_email text GENERATED ALWAYS AS (document ->> 'supervisor_email') STORED,
    token_hash text GENERATED ALWAYS AS (document ->> 'token_hash') STORED,
    decision text GENERATED ALWAYS AS (document ->> 'decision') STORED,
    created_at text GENERATED ALWAYS AS (NULLIF(document ->> 'created_at', '')) STORED,
    expires_at text GENERATED ALWAYS AS (NULLIF(COALESCE(document #>> '{expires_at,$date}', document ->> 'expires_at'), '')) STORED,
    used_at text GENERATED ALWAYS AS (NULLIF(COALESCE(document #>> '{used_at,$date}', document ->> 'used_at'), '')) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS supervisor_approvals_token_hash_uk ON "GassBooking".supervisor_meeting_approvals (token_hash);
CREATE INDEX IF NOT EXISTS supervisor_approvals_booking_idx ON "GassBooking".supervisor_meeting_approvals (booking_id);

CREATE TABLE IF NOT EXISTS "GassBooking".password_resets (
    id text PRIMARY KEY,
    document jsonb NOT NULL,
    synced_at timestamptz NOT NULL DEFAULT now(),
    mongo_id text GENERATED ALWAYS AS (document #>> '{_id,$oid}') STORED,
    user_id text GENERATED ALWAYS AS (document ->> 'user_id') STORED,
    email text GENERATED ALWAYS AS (document ->> 'email') STORED,
    token_hash text GENERATED ALWAYS AS (document ->> 'token_hash') STORED,
    created_at text GENERATED ALWAYS AS (NULLIF(document ->> 'created_at', '')) STORED,
    expires_at text GENERATED ALWAYS AS (NULLIF(COALESCE(document #>> '{expires_at,$date}', document ->> 'expires_at'), '')) STORED,
    used_at text GENERATED ALWAYS AS (NULLIF(COALESCE(document #>> '{used_at,$date}', document ->> 'used_at'), '')) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS password_resets_token_hash_uk ON "GassBooking".password_resets (token_hash);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON "GassBooking".password_resets (user_id);

CREATE TABLE IF NOT EXISTS "GassBooking".vehicles (
    id text PRIMARY KEY,
    document jsonb NOT NULL,
    synced_at timestamptz NOT NULL DEFAULT now(),
    mongo_id text GENERATED ALWAYS AS (document #>> '{_id,$oid}') STORED,
    plate_number text GENERATED ALWAYS AS (document ->> 'plate_number') STORED,
    name text GENERATED ALWAYS AS (document ->> 'name') STORED,
    type text GENERATED ALWAYS AS (document ->> 'type') STORED,
    capacity integer GENERATED ALWAYS AS (NULLIF(document ->> 'capacity', '')::integer) STORED,
    year integer GENERATED ALWAYS AS (NULLIF(document ->> 'year', '')::integer) STORED,
    notes text GENERATED ALWAYS AS (document ->> 'notes') STORED,
    image_url text GENERATED ALWAYS AS (document ->> 'image_url') STORED,
    status text GENERATED ALWAYS AS (document ->> 'status') STORED,
    created_at text GENERATED ALWAYS AS (NULLIF(document ->> 'created_at', '')) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_plate_number_uk ON "GassBooking".vehicles (plate_number);

CREATE TABLE IF NOT EXISTS "GassBooking".drivers (
    id text PRIMARY KEY,
    document jsonb NOT NULL,
    synced_at timestamptz NOT NULL DEFAULT now(),
    mongo_id text GENERATED ALWAYS AS (document #>> '{_id,$oid}') STORED,
    name text GENERATED ALWAYS AS (document ->> 'name') STORED,
    phone text GENERATED ALWAYS AS (document ->> 'phone') STORED,
    license_number text GENERATED ALWAYS AS (document ->> 'license_number') STORED,
    notes text GENERATED ALWAYS AS (document ->> 'notes') STORED,
    status text GENERATED ALWAYS AS (document ->> 'status') STORED,
    created_at text GENERATED ALWAYS AS (NULLIF(document ->> 'created_at', '')) STORED
);

CREATE TABLE IF NOT EXISTS "GassBooking".vehicle_bookings (
    id text PRIMARY KEY,
    document jsonb NOT NULL,
    synced_at timestamptz NOT NULL DEFAULT now(),
    mongo_id text GENERATED ALWAYS AS (document #>> '{_id,$oid}') STORED,
    user_id text GENERATED ALWAYS AS (document ->> 'user_id') STORED,
    user_email text GENERATED ALWAYS AS (document ->> 'user_email') STORED,
    employee_name text GENERATED ALWAYS AS (document ->> 'employee_name') STORED,
    job_title text GENERATED ALWAYS AS (document ->> 'job_title') STORED,
    department text GENERATED ALWAYS AS (document ->> 'department') STORED,
    division text GENERATED ALWAYS AS (document ->> 'division') STORED,
    cost_center text GENERATED ALWAYS AS (document ->> 'cost_center') STORED,
    booking_type text GENERATED ALWAYS AS (document ->> 'booking_type') STORED,
    service_type text GENERATED ALWAYS AS (document ->> 'service_type') STORED,
    with_driver boolean GENERATED ALWAYS AS (NULLIF(document ->> 'with_driver', '')::boolean) STORED,
    pickup_location text GENERATED ALWAYS AS (document ->> 'pickup_location') STORED,
    destination text GENERATED ALWAYS AS (document ->> 'destination') STORED,
    usage_area text GENERATED ALWAYS AS (document ->> 'usage_area') STORED,
    purpose text GENERATED ALWAYS AS (document ->> 'purpose') STORED,
    activity_code text GENERATED ALWAYS AS (document ->> 'activity_code') STORED,
    passengers integer GENERATED ALWAYS AS (NULLIF(document ->> 'passengers', '')::integer) STORED,
    passenger_list jsonb GENERATED ALWAYS AS (document -> 'passenger_list') STORED,
    distance_km integer GENERATED ALWAYS AS (NULLIF(document ->> 'distance_km', '')::integer) STORED,
    require_pro_in boolean GENERATED ALWAYS AS (NULLIF(document ->> 'require_pro_in', '')::boolean) STORED,
    require_dept_head_approval boolean GENERATED ALWAYS AS (NULLIF(document ->> 'require_dept_head_approval', '')::boolean) STORED,
    pro_in_file jsonb GENERATED ALWAYS AS (document -> 'pro_in_file') STORED,
    notes text GENERATED ALWAYS AS (document ->> 'notes') STORED,
    start_date text GENERATED ALWAYS AS (NULLIF(document ->> 'start_date', '')) STORED,
    start_time text GENERATED ALWAYS AS (NULLIF(document ->> 'start_time', '')) STORED,
    end_date text GENERATED ALWAYS AS (NULLIF(document ->> 'end_date', '')) STORED,
    end_time text GENERATED ALWAYS AS (NULLIF(document ->> 'end_time', '')) STORED,
    status text GENERATED ALWAYS AS (document ->> 'status') STORED,
    rejection_notes text GENERATED ALWAYS AS (document ->> 'rejection_notes') STORED,
    vehicle_id text GENERATED ALWAYS AS (document ->> 'vehicle_id') STORED,
    vehicle_name text GENERATED ALWAYS AS (document ->> 'vehicle_name') STORED,
    vehicle_plate text GENERATED ALWAYS AS (document ->> 'vehicle_plate') STORED,
    driver_id text GENERATED ALWAYS AS (document ->> 'driver_id') STORED,
    driver_name text GENERATED ALWAYS AS (document ->> 'driver_name') STORED,
    pickup_schedule text GENERATED ALWAYS AS (document ->> 'pickup_schedule') STORED,
    admin_notes text GENERATED ALWAYS AS (document ->> 'admin_notes') STORED,
    handover jsonb GENERATED ALWAYS AS (document -> 'handover') STORED,
    return_info jsonb GENERATED ALWAYS AS (document -> 'return_info') STORED,
    created_at text GENERATED ALWAYS AS (NULLIF(document ->> 'created_at', '')) STORED
);

CREATE INDEX IF NOT EXISTS vehicle_bookings_user_idx ON "GassBooking".vehicle_bookings (user_id);
CREATE INDEX IF NOT EXISTS vehicle_bookings_vehicle_start_idx ON "GassBooking".vehicle_bookings (vehicle_id, start_date);
CREATE INDEX IF NOT EXISTS vehicle_bookings_driver_idx ON "GassBooking".vehicle_bookings (driver_id);

