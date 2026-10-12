import asyncio
from datetime import datetime, timezone

from postgres_compat import PostgresCursor, apply_projection, apply_update, matches


DOCUMENT = {
    "id": "1",
    "name": "Aurora Boardroom",
    "status": "pending",
    "capacity": 12,
    "facilities": ["LCD", "Zoom"],
    "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
}


def test_query_operators():
    assert matches(DOCUMENT, {"status": {"$in": ["pending", "confirmed"]}})
    assert matches(DOCUMENT, {"status": {"$nin": ["cancelled"]}})
    assert matches(DOCUMENT, {"capacity": {"$gte": 10, "$lte": 20}})
    assert matches(DOCUMENT, {"facilities": {"$regex": "zoom", "$options": "i"}})
    assert matches(DOCUMENT, {"missing": {"$exists": False}})
    assert matches(DOCUMENT, {"$or": [{"status": "confirmed"}, {"capacity": 12}]})
    assert not matches(DOCUMENT, {"$and": [{"status": "pending"}, {"capacity": 1}]})


def test_updates_and_projection():
    updated = apply_update(DOCUMENT, {"$set": {"status": "confirmed"}, "$inc": {"capacity": 1}})
    assert updated["status"] == "confirmed"
    assert updated["capacity"] == 13
    projected = apply_projection(updated, {"_id": 0, "id": 1, "status": 1})
    assert projected == {"id": "1", "status": "confirmed"}


def test_cursor_supports_async_iteration_with_sort_and_projection():
    class Collection:
        async def _all_documents(self):
            return [
                {"id": "2", "status": "cancelled", "priority": 1},
                {"id": "1", "status": "pending", "priority": 2},
            ]

    async def collect():
        cursor = PostgresCursor(
            Collection(),
            {"status": {"$in": ["pending"]}},
            {"_id": 0, "id": 1},
        ).sort("priority", -1)
        return [document async for document in cursor]

    assert asyncio.run(collect()) == [{"id": "1"}]
