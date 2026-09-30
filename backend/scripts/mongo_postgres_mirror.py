#!/usr/bin/env python3
"""Mirror selected MongoDB collections into PostgreSQL JSONB tables.

MongoDB remains the source of truth. Each run performs a full, idempotent
upsert and removes mirror rows that no longer exist in MongoDB.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any

from bson import json_util
from dotenv import load_dotenv
from pymongo import MongoClient
from psycopg import connect
from psycopg.types.json import Jsonb


DEFAULT_COLLECTIONS = (
    "users",
    "companies",
    "counters",
    "rooms",
    "bookings",
    "supervisor_meeting_approvals",
    "password_resets",
    "vehicles",
    "drivers",
    "vehicle_bookings",
)

SCHEMA_SQL = """
CREATE SCHEMA IF NOT EXISTS mongo_mirror;

CREATE TABLE IF NOT EXISTS mongo_mirror.documents (
    collection_name text NOT NULL,
    document_key text NOT NULL,
    document jsonb NOT NULL,
    source_updated_at timestamptz NULL,
    synced_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (collection_name, document_key)
);

CREATE INDEX IF NOT EXISTS documents_collection_idx
    ON mongo_mirror.documents (collection_name);
CREATE INDEX IF NOT EXISTS documents_payload_gin_idx
    ON mongo_mirror.documents USING gin (document);

CREATE TABLE IF NOT EXISTS mongo_mirror.sync_runs (
    id bigserial PRIMARY KEY,
    started_at timestamptz NOT NULL,
    finished_at timestamptz NULL,
    status text NOT NULL,
    collection_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
    error text NULL
);
"""

UPSERT_SQL = """
INSERT INTO mongo_mirror.documents (
    collection_name, document_key, document, source_updated_at, synced_at
) VALUES (%s, %s, %s, %s, now())
ON CONFLICT (collection_name, document_key) DO UPDATE SET
    document = EXCLUDED.document,
    source_updated_at = EXCLUDED.source_updated_at,
    synced_at = now()
"""


def _document_key(document: dict[str, Any]) -> str:
    key = document.get("id", document.get("_id"))
    if key is None:
        raise ValueError("MongoDB document has neither id nor _id")
    return str(key)


def _json_document(document: dict[str, Any]) -> dict[str, Any]:
    # Extended JSON preserves ObjectId and datetime values without data loss.
    return json.loads(json_util.dumps(document))


def _source_updated_at(document: dict[str, Any]) -> datetime | None:
    for field in ("datetime_updated", "updated_at", "created_at"):
        value = document.get(field)
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
            except ValueError:
                continue
    return None


def _configured_collections() -> tuple[str, ...]:
    configured = os.getenv("MIRROR_COLLECTIONS", "").strip()
    if not configured:
        return DEFAULT_COLLECTIONS
    return tuple(item.strip() for item in configured.split(",") if item.strip())


def sync() -> dict[str, int]:
    load_dotenv()
    mongo_url = os.environ["MONGO_URL"]
    database_name = os.environ["DB_NAME"]
    postgres_dsn = os.environ["POSTGRES_MIRROR_DSN"]
    collections = _configured_collections()
    started_at = datetime.now(timezone.utc)

    mongo = MongoClient(mongo_url, serverSelectionTimeoutMS=10_000)
    mongo.admin.command("ping")
    source = mongo[database_name]
    counts: dict[str, int] = {}

    try:
        with connect(postgres_dsn) as postgres:
            with postgres.cursor() as cursor:
                cursor.execute(SCHEMA_SQL)
                cursor.execute("SELECT pg_try_advisory_xact_lock(hashtext(%s))", ("gass-mongo-mirror",))
                if not cursor.fetchone()[0]:
                    logging.info("Another mirror run is active; skipping")
                    return {}

                cursor.execute(
                    "INSERT INTO mongo_mirror.sync_runs (started_at, status) VALUES (%s, 'running') RETURNING id",
                    (started_at,),
                )
                run_id = cursor.fetchone()[0]

                for collection_name in collections:
                    documents = list(source[collection_name].find({}))
                    keys: list[str] = []
                    rows = []
                    for document in documents:
                        key = _document_key(document)
                        keys.append(key)
                        rows.append(
                            (
                                collection_name,
                                key,
                                Jsonb(_json_document(document)),
                                _source_updated_at(document),
                            )
                        )

                    if rows:
                        cursor.executemany(UPSERT_SQL, rows)
                        cursor.execute(
                            "DELETE FROM mongo_mirror.documents WHERE collection_name = %s AND NOT (document_key = ANY(%s))",
                            (collection_name, keys),
                        )
                    else:
                        cursor.execute(
                            "DELETE FROM mongo_mirror.documents WHERE collection_name = %s",
                            (collection_name,),
                        )

                    cursor.execute(
                        "SELECT count(*) FROM mongo_mirror.documents WHERE collection_name = %s",
                        (collection_name,),
                    )
                    mirror_count = cursor.fetchone()[0]
                    if mirror_count != len(documents):
                        raise RuntimeError(
                            f"Count mismatch for {collection_name}: MongoDB={len(documents)}, PostgreSQL={mirror_count}"
                        )
                    counts[collection_name] = mirror_count

                cursor.execute(
                    """
                    UPDATE mongo_mirror.sync_runs
                    SET finished_at = now(), status = 'success', collection_counts = %s
                    WHERE id = %s
                    """,
                    (Jsonb(counts), run_id),
                )
        return counts
    finally:
        mongo.close()


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    try:
        counts = sync()
    except Exception:
        logging.exception("MongoDB to PostgreSQL mirror failed")
        return 1
    logging.info("Mirror completed: %s", counts)
    return 0


if __name__ == "__main__":
    sys.exit(main())
