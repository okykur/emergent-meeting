"""Backend API tests for Meeting Room Booking app."""
import os
import uuid
import requests
import pytest
from datetime import datetime, timedelta

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://conf-room-nexus.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@roombook.com"
ADMIN_PASSWORD = "Admin@123"


# ---------- Helpers ----------
def _future_date(days: int = 1) -> str:
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")


def _past_date(days: int = 1) -> str:
    return (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def user_creds():
    suffix = uuid.uuid4().hex[:8]
    return {"email": f"TEST_user_{suffix}@example.com", "password": "User@1234", "name": "Test User"}


@pytest.fixture(scope="session")
def user_token(user_creds):
    r = requests.post(f"{API}/auth/register", json=user_creds)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "user"
    assert data["user"]["email"] == user_creds["email"].lower()
    return data["access_token"]


@pytest.fixture(scope="session")
def user_headers(user_token):
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture(scope="session")
def rooms(admin_headers):
    r = requests.get(f"{API}/rooms")
    assert r.status_code == 200
    rooms = r.json()
    assert len(rooms) >= 6, f"Expected >= 6 seeded rooms, got {len(rooms)}"
    return rooms


@pytest.fixture(scope="session")
def active_room(rooms):
    for r in rooms:
        if r["is_active"]:
            return r
    pytest.skip("No active room")


@pytest.fixture(scope="session")
def inactive_room(rooms):
    for r in rooms:
        if not r["is_active"]:
            return r
    return None  # may be None


# ---------- Health/root ----------
def test_root_health():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_register_success(self):
        suffix = uuid.uuid4().hex[:8]
        payload = {"email": f"TEST_reg_{suffix}@example.com", "password": "Pass@1234", "name": "Reg User"}
        r = requests.post(f"{API}/auth/register", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and len(data["access_token"]) > 10
        assert data["user"]["role"] == "user"
        assert data["user"]["email"] == payload["email"].lower()

    def test_register_duplicate(self, user_creds, user_token):
        # user_token fixture already registered user_creds
        r = requests.post(f"{API}/auth/register", json=user_creds)
        assert r.status_code == 400

    def test_login_admin(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["role"] == "admin"
        assert d["token_type"] == "bearer"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_token(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Rooms ----------
class TestRooms:
    def test_list_rooms_seeded(self, rooms):
        assert len(rooms) >= 6
        for room in rooms:
            assert "id" in room and "name" in room and "capacity" in room
            assert "_id" not in room

    def test_get_room_by_id(self, rooms):
        room = rooms[0]
        r = requests.get(f"{API}/rooms/{room['id']}")
        assert r.status_code == 200
        assert r.json()["id"] == room["id"]

    def test_room_availability(self, active_room):
        start = _future_date(0)
        end = _future_date(7)
        r = requests.get(f"{API}/rooms/{active_room['id']}/availability", params={"start_date": start, "end_date": end})
        assert r.status_code == 200
        data = r.json()
        assert data["room_id"] == active_room["id"]
        assert isinstance(data["bookings"], list)

    def test_create_room_non_admin(self, user_headers):
        payload = {"name": "TEST Unauthorized", "location": "x", "capacity": 4, "facilities": [], "description": "", "is_active": True}
        r = requests.post(f"{API}/rooms", json=payload, headers=user_headers)
        assert r.status_code == 403

    def test_admin_room_crud(self, admin_headers):
        payload = {
            "name": f"TEST Room {uuid.uuid4().hex[:6]}",
            "location": "Test Floor",
            "capacity": 8,
            "facilities": ["TV", "Whiteboard"],
            "description": "Test room",
            "is_active": True,
        }
        # Create
        r = requests.post(f"{API}/rooms", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        created = r.json()
        room_id = created["id"]
        assert created["name"] == payload["name"]
        # Update toggle is_active
        r = requests.put(f"{API}/rooms/{room_id}", json={"is_active": False, "capacity": 12}, headers=admin_headers)
        assert r.status_code == 200
        updated = r.json()
        assert updated["is_active"] is False
        assert updated["capacity"] == 12
        # Verify GET
        r = requests.get(f"{API}/rooms/{room_id}")
        assert r.status_code == 200
        assert r.json()["capacity"] == 12
        # Delete
        r = requests.delete(f"{API}/rooms/{room_id}", headers=admin_headers)
        assert r.status_code == 200
        # Verify gone
        r = requests.get(f"{API}/rooms/{room_id}")
        assert r.status_code == 404


# ---------- Bookings ----------
class TestBookings:
    def test_create_booking_pending(self, user_headers, active_room):
        payload = {
            "room_id": active_room["id"],
            "title": "TEST Standup",
            "date": _future_date(2),
            "start_time": "10:00",
            "end_time": "11:00",
            "participants": min(2, active_room["capacity"]),
            "notes": "test",
        }
        r = requests.post(f"{API}/bookings", json=payload, headers=user_headers)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["status"] == "pending"
        assert b["room_id"] == active_room["id"]
        pytest.created_booking_id = b["id"]
        pytest.created_booking_room = active_room["id"]
        pytest.created_booking_date = payload["date"]

    def test_overlap_409(self, user_headers, active_room):
        date = _future_date(3)
        base = {"room_id": active_room["id"], "title": "TEST A", "date": date, "start_time": "14:00", "end_time": "15:00", "participants": 1}
        r1 = requests.post(f"{API}/bookings", json=base, headers=user_headers)
        assert r1.status_code == 200
        # overlapping
        overlap = {**base, "title": "TEST B", "start_time": "14:30", "end_time": "15:30"}
        r2 = requests.post(f"{API}/bookings", json=overlap, headers=user_headers)
        assert r2.status_code == 409

    def test_past_date_400(self, user_headers, active_room):
        payload = {
            "room_id": active_room["id"],
            "title": "TEST Past",
            "date": _past_date(1),
            "start_time": "09:00",
            "end_time": "10:00",
            "participants": 1,
        }
        r = requests.post(f"{API}/bookings", json=payload, headers=user_headers)
        assert r.status_code == 400

    def test_participants_exceed_capacity_400(self, user_headers, active_room):
        payload = {
            "room_id": active_room["id"],
            "title": "TEST Capacity",
            "date": _future_date(4),
            "start_time": "09:00",
            "end_time": "10:00",
            "participants": active_room["capacity"] + 100,
        }
        r = requests.post(f"{API}/bookings", json=payload, headers=user_headers)
        assert r.status_code == 400

    def test_inactive_room_400(self, user_headers, inactive_room):
        if not inactive_room:
            pytest.skip("No inactive room seeded")
        payload = {
            "room_id": inactive_room["id"],
            "title": "TEST Inactive",
            "date": _future_date(5),
            "start_time": "09:00",
            "end_time": "10:00",
            "participants": 1,
        }
        r = requests.post(f"{API}/bookings", json=payload, headers=user_headers)
        assert r.status_code == 400

    def test_my_bookings_only_caller(self, user_headers):
        r = requests.get(f"{API}/bookings/mine", headers=user_headers)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1

    def test_admin_list_bookings(self, admin_headers):
        r = requests.get(f"{API}/bookings", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_list_filters(self, admin_headers):
        r = requests.get(f"{API}/bookings", headers=admin_headers, params={"status": "pending"})
        assert r.status_code == 200
        for b in r.json():
            assert b["status"] == "pending"

    def test_non_admin_list_403(self, user_headers):
        r = requests.get(f"{API}/bookings", headers=user_headers)
        assert r.status_code == 403

    def test_admin_approve(self, admin_headers):
        bid = getattr(pytest, "created_booking_id", None)
        if not bid:
            pytest.skip("No created booking")
        r = requests.patch(f"{API}/bookings/{bid}/status", json={"status": "confirmed"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "confirmed"

    def test_user_cancel_own(self, user_headers, active_room):
        payload = {
            "room_id": active_room["id"],
            "title": "TEST Cancel",
            "date": _future_date(6),
            "start_time": "13:00",
            "end_time": "14:00",
            "participants": 1,
        }
        r = requests.post(f"{API}/bookings", json=payload, headers=user_headers)
        assert r.status_code == 200
        bid = r.json()["id"]
        r2 = requests.post(f"{API}/bookings/{bid}/cancel", headers=user_headers)
        assert r2.status_code == 200
        assert r2.json()["status"] == "cancelled"


# ---------- Admin Stats ----------
class TestAdmin:
    def test_stats(self, admin_headers):
        r = requests.get(f"{API}/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_rooms", "active_rooms", "pending_bookings", "confirmed_bookings", "today_bookings", "total_users"]:
            assert k in d
            assert isinstance(d[k], int)

    def test_stats_non_admin(self, user_headers):
        r = requests.get(f"{API}/admin/stats", headers=user_headers)
        assert r.status_code == 403
