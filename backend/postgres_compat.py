"""Small async Mongo-style compatibility layer backed by PostgreSQL JSONB.

The application historically used Motor directly. This module preserves the
limited collection API used by the application while making PostgreSQL the
only runtime datastore.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable

from bson import json_util
from psycopg import AsyncConnection, sql
from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError


COLLECTIONS = {
    "users",
    "companies",
    "departments",
    "counters",
    "rooms",
    "bookings",
    "supervisor_meeting_approvals",
    "password_resets",
    "vehicles",
    "drivers",
    "vehicle_bookings",
}

MISSING = object()


@dataclass
class UpdateResult:
    matched_count: int = 0
    modified_count: int = 0
    upserted_id: str | None = None


@dataclass
class DeleteResult:
    deleted_count: int = 0


@dataclass
class InsertOneResult:
    inserted_id: str


@dataclass
class InsertManyResult:
    inserted_ids: list[str]


def _encode(document: dict[str, Any]) -> dict[str, Any]:
    return json.loads(json_util.dumps(document))


def _decode(document: dict[str, Any]) -> dict[str, Any]:
    return json_util.loads(json.dumps(document))


def _document_key(document: dict[str, Any]) -> str:
    key = document.get("id", document.get("_id"))
    if key is None:
        raise ValueError("Document must contain id or _id")
    return str(key)


def _get_value(document: dict[str, Any], path: str):
    value: Any = document
    for part in path.split("."):
        if not isinstance(value, dict) or part not in value:
            return MISSING
        value = value[part]
    return value


def _set_value(document: dict[str, Any], path: str, value: Any) -> None:
    target = document
    parts = path.split(".")
    for part in parts[:-1]:
        child = target.get(part)
        if not isinstance(child, dict):
            child = {}
            target[part] = child
        target = child
    target[parts[-1]] = value


def _regex_matches(actual: Any, pattern: str, options: str = "") -> bool:
    flags = re.IGNORECASE if "i" in options else 0
    compiled = re.compile(pattern, flags)
    if isinstance(actual, list):
        return any(_regex_matches(item, pattern, options) for item in actual)
    if actual is MISSING or actual is None:
        return False
    return compiled.search(str(actual)) is not None


def _equals(actual: Any, expected: Any) -> bool:
    if expected is None:
        return actual is MISSING or actual is None
    if actual is MISSING:
        return False
    if isinstance(actual, list) and not isinstance(expected, list):
        return expected in actual
    return actual == expected


def _operator_matches(actual: Any, operator: str, expected: Any) -> bool:
    if operator == "$exists":
        return (actual is not MISSING) is bool(expected)
    if operator == "$regex":
        return True  # Evaluated with $options by _condition_matches.
    if operator == "$options":
        return True
    if operator == "$ne":
        return not _equals(actual, expected)
    if operator == "$in":
        if actual is MISSING:
            return False
        if isinstance(actual, list):
            return any(item in expected for item in actual)
        return actual in expected
    if operator == "$nin":
        if actual is MISSING:
            return True
        if isinstance(actual, list):
            return all(item not in expected for item in actual)
        return actual not in expected
    if actual is MISSING or actual is None:
        return False
    try:
        if operator == "$gt":
            return actual > expected
        if operator == "$gte":
            return actual >= expected
        if operator == "$lt":
            return actual < expected
        if operator == "$lte":
            return actual <= expected
    except TypeError:
        return False
    raise ValueError(f"Unsupported query operator: {operator}")


def _condition_matches(actual: Any, condition: Any) -> bool:
    if not isinstance(condition, dict) or not any(str(key).startswith("$") for key in condition):
        return _equals(actual, condition)
    if "$regex" in condition and not _regex_matches(
        actual, condition["$regex"], condition.get("$options", "")
    ):
        return False
    return all(_operator_matches(actual, operator, expected) for operator, expected in condition.items())


def matches(document: dict[str, Any], query: dict[str, Any] | None) -> bool:
    query = query or {}
    for key, condition in query.items():
        if key == "$or":
            if not any(matches(document, item) for item in condition):
                return False
        elif key == "$and":
            if not all(matches(document, item) for item in condition):
                return False
        elif not _condition_matches(_get_value(document, key), condition):
            return False
    return True


def apply_projection(document: dict[str, Any], projection: dict[str, int] | None):
    if not projection:
        return dict(document)
    included = {key for key, enabled in projection.items() if enabled and key != "_id"}
    if included:
        result = {key: document[key] for key in included if key in document}
        if projection.get("_id", 1) and "_id" in document:
            result["_id"] = document["_id"]
        return result
    return {key: value for key, value in document.items() if projection.get(key, 1)}


def apply_update(document: dict[str, Any], update: dict[str, Any]) -> dict[str, Any]:
    updated = dict(document)
    if not any(str(key).startswith("$") for key in update):
        return dict(update)
    for path, value in update.get("$set", {}).items():
        _set_value(updated, path, value)
    for path, amount in update.get("$inc", {}).items():
        current = _get_value(updated, path)
        _set_value(updated, path, amount if current is MISSING else current + amount)
    for path, value in update.get("$max", {}).items():
        current = _get_value(updated, path)
        if current is MISSING or current < value:
            _set_value(updated, path, value)
    return updated


def _sort_value(value: Any):
    if value is MISSING or value is None:
        return (1, "")
    if isinstance(value, datetime):
        return (0, value.timestamp())
    if isinstance(value, (int, float, str, bool)):
        return (0, value)
    return (0, json.dumps(_encode({"value": value}), sort_keys=True))


class PostgresCursor:
    def __init__(
        self,
        collection: "PostgresCollection",
        query: dict[str, Any] | None,
        projection: dict[str, int] | None,
    ):
        self.collection = collection
        self.query = query or {}
        self.projection = projection
        self.sort_fields: list[tuple[str, int]] = []

    def sort(self, key_or_list, direction: int | None = None):
        if isinstance(key_or_list, list):
            self.sort_fields = list(key_or_list)
        else:
            self.sort_fields = [(key_or_list, direction or 1)]
        return self

    def __aiter__(self):
        async def iterate():
            for document in await self.to_list():
                yield document

        return iterate()

    async def to_list(self, length: int | None = None):
        documents = await self.collection._all_documents()
        documents = [document for document in documents if matches(document, self.query)]
        for field, direction in reversed(self.sort_fields):
            documents.sort(
                key=lambda item: _sort_value(_get_value(item, field)),
                reverse=direction < 0,
            )
        if length is not None:
            documents = documents[:length]
        return [apply_projection(document, self.projection) for document in documents]


class PostgresCollection:
    def __init__(self, dsn: str, name: str, schema: str):
        if name not in COLLECTIONS:
            raise AttributeError(f"Unknown collection: {name}")
        self.dsn = dsn
        self.name = name
        self.schema = schema

    @property
    def table(self):
        return sql.Identifier(self.schema, self.name)

    async def _all_documents(self, *, connection=None, for_update: bool = False):
        statement = sql.SQL("SELECT document FROM {}{}").format(
            self.table, sql.SQL(" FOR UPDATE") if for_update else sql.SQL("")
        )
        if connection is not None:
            async with connection.cursor() as cursor:
                await cursor.execute(statement)
                rows = await cursor.fetchall()
                return [_decode(row[0]) for row in rows]
        async with await AsyncConnection.connect(self.dsn) as connection:
            return await self._all_documents(connection=connection, for_update=for_update)

    async def _upsert(self, connection, document: dict[str, Any]):
        key = _document_key(document)
        statement = sql.SQL(
            """
            INSERT INTO {} (id, document, synced_at)
            VALUES (%s, %s, now())
            ON CONFLICT (id) DO UPDATE SET document = EXCLUDED.document, synced_at = now()
            """
        ).format(self.table)
        async with connection.cursor() as cursor:
            await cursor.execute(statement, (key, Jsonb(_encode(document))))
        return key

    def find(self, query=None, projection=None):
        return PostgresCursor(self, query, projection)

    async def find_one(self, query=None, projection=None):
        results = await self.find(query, projection).to_list(1)
        return results[0] if results else None

    async def count_documents(self, query):
        documents = await self._all_documents()
        return sum(1 for document in documents if matches(document, query))

    async def insert_one(self, document):
        try:
            async with await AsyncConnection.connect(self.dsn) as connection:
                key = _document_key(document)
                statement = sql.SQL(
                    "INSERT INTO {} (id, document, synced_at) VALUES (%s, %s, now())"
                ).format(self.table)
                async with connection.cursor() as cursor:
                    await cursor.execute(statement, (key, Jsonb(_encode(document))))
            return InsertOneResult(key)
        except UniqueViolation as exc:
            raise DuplicateKeyError(str(exc)) from exc

    async def insert_many(self, documents: Iterable[dict[str, Any]]):
        inserted_ids = []
        try:
            async with await AsyncConnection.connect(self.dsn) as connection:
                statement = sql.SQL(
                    "INSERT INTO {} (id, document, synced_at) VALUES (%s, %s, now())"
                ).format(self.table)
                rows = []
                for document in documents:
                    key = _document_key(document)
                    inserted_ids.append(key)
                    rows.append((key, Jsonb(_encode(document))))
                async with connection.cursor() as cursor:
                    await cursor.executemany(statement, rows)
            return InsertManyResult(inserted_ids)
        except UniqueViolation as exc:
            raise DuplicateKeyError(str(exc)) from exc

    async def _update(self, query, update, *, many: bool, upsert: bool = False):
        async with await AsyncConnection.connect(self.dsn) as connection:
            documents = await self._all_documents(connection=connection, for_update=True)
            selected = [document for document in documents if matches(document, query)]
            if not many:
                selected = selected[:1]
            if not selected and upsert:
                base = {
                    key: value
                    for key, value in query.items()
                    if not key.startswith("$") and not isinstance(value, dict)
                }
                selected = [base]
            modified = 0
            upserted_id = None
            for document in selected:
                updated = apply_update(document, update)
                if updated != document or upsert:
                    key = await self._upsert(connection, updated)
                    modified += 1
                    if not documents:
                        upserted_id = key
            return UpdateResult(len(selected), modified, upserted_id)

    async def update_one(self, query, update, upsert: bool = False):
        return await self._update(query, update, many=False, upsert=upsert)

    async def update_many(self, query, update, upsert: bool = False):
        return await self._update(query, update, many=True, upsert=upsert)

    async def find_one_and_update(self, query, update, upsert=False, return_document=False):
        if (
            upsert
            and set(query) == {"_id"}
            and set(update) == {"$inc"}
            and set(update["$inc"]) == {"seq"}
        ):
            key = str(query["_id"])
            increment = int(update["$inc"]["seq"])
            initial = {"_id": key, "seq": increment}
            statement = sql.SQL(
                """
                INSERT INTO {} AS target (id, document, synced_at)
                VALUES (%s, %s, now())
                ON CONFLICT (id) DO UPDATE
                SET document = jsonb_set(
                        target.document,
                        '{{seq}}',
                        to_jsonb(COALESCE((target.document ->> 'seq')::bigint, 0) + %s),
                        true
                    ),
                    synced_at = now()
                RETURNING document
                """
            ).format(self.table)
            async with await AsyncConnection.connect(self.dsn) as connection:
                async with connection.cursor() as cursor:
                    await cursor.execute(statement, (key, Jsonb(initial), increment))
                    updated = _decode((await cursor.fetchone())[0])
            return updated if return_document == ReturnDocument.AFTER else {"_id": key, "seq": updated["seq"] - increment}

        async with await AsyncConnection.connect(self.dsn) as connection:
            documents = await self._all_documents(connection=connection, for_update=True)
            original = next((item for item in documents if matches(item, query)), None)
            if original is None and not upsert:
                return None
            if original is None:
                original = {
                    key: value
                    for key, value in query.items()
                    if not key.startswith("$") and not isinstance(value, dict)
                }
            updated = apply_update(original, update)
            await self._upsert(connection, updated)
            return updated if return_document == ReturnDocument.AFTER else original

    async def delete_one(self, query):
        async with await AsyncConnection.connect(self.dsn) as connection:
            documents = await self._all_documents(connection=connection, for_update=True)
            selected = next((item for item in documents if matches(item, query)), None)
            if selected is None:
                return DeleteResult(0)
            statement = sql.SQL("DELETE FROM {} WHERE id = %s").format(self.table)
            async with connection.cursor() as cursor:
                await cursor.execute(statement, (_document_key(selected),))
            return DeleteResult(1)

    async def create_index(self, *args, **kwargs):
        # PostgreSQL indexes are managed by postgres_mirror_schema.sql.
        return None


class PostgresDatabase:
    def __init__(self, dsn: str, schema: str = "GassBooking"):
        self.dsn = dsn
        self.schema = schema
        self._collections = {
            name: PostgresCollection(dsn, name, schema) for name in COLLECTIONS
        }

    def __getattr__(self, name: str):
        try:
            return self._collections[name]
        except KeyError as exc:
            raise AttributeError(name) from exc

    def close(self):
        return None


__all__ = [
    "DuplicateKeyError",
    "PostgresDatabase",
    "ReturnDocument",
    "apply_projection",
    "apply_update",
    "matches",
]
