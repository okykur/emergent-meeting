import asyncio

import server
from postgres_compat import PostgresCursor


class MemoryCollection:
    def __init__(self, documents):
        self.documents = documents

    async def _all_documents(self):
        return self.documents

    def find(self, query=None, projection=None):
        return PostgresCursor(self, query, projection)


def test_meeting_overlap_uses_postgres_async_cursor(monkeypatch):
    bookings = MemoryCollection(
        [
            {
                "id": "meeting-1",
                "room_id": "room-1",
                "date": "2026-10-14",
                "start_time": "09:00",
                "end_time": "10:00",
                "status": "pending",
            },
            {
                "id": "meeting-2",
                "room_id": "room-1",
                "date": "2026-10-14",
                "start_time": "13:00",
                "end_time": "14:00",
                "status": "cancelled",
            },
        ]
    )
    monkeypatch.setattr(server, "db", type("FakeDb", (), {"bookings": bookings})())

    conflicts = asyncio.run(server._find_overlaps("room-1", "2026-10-14", "08:00", "17:00"))

    assert [booking["id"] for booking in conflicts] == ["meeting-1"]


def test_vehicle_overlap_uses_postgres_async_cursor(monkeypatch):
    vehicle_bookings = MemoryCollection(
        [
            {
                "id": "vehicle-booking-1",
                "vehicle_id": "vehicle-1",
                "start_date": "2026-10-14",
                "end_date": "2026-10-15",
                "status": "assigned",
            },
            {
                "id": "vehicle-booking-2",
                "vehicle_id": "vehicle-1",
                "start_date": "2026-10-14",
                "end_date": "2026-10-15",
                "status": "cancelled",
            },
        ]
    )
    monkeypatch.setattr(
        server,
        "db",
        type("FakeDb", (), {"vehicle_bookings": vehicle_bookings})(),
    )

    overlaps = asyncio.run(server._vehicle_overlap("vehicle-1", "2026-10-15", "2026-10-16"))

    assert overlaps is True
