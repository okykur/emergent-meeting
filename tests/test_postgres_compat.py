from datetime import datetime, timezone

from postgres_compat import apply_projection, apply_update, matches


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
