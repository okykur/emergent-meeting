"""
Comprehensive backend tests for KCSI Meeting Room + Vehicle Booking API.
Auth, RBAC, user mgmt, meeting room flow, vehicle booking flow, _id leak guard.
"""
import os
import uuid
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://conf-room-nexus.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER = {"email": "admin@roombook.com", "password": "Admin@123"}
MADMIN = {"email": "meeting_admin@test.com", "password": "Meet@123"}
CADMIN = {"email": "car_admin@test.com", "password": "Car@123"}
USER = {"email": "user@roombook.com", "password": "User@123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login {creds['email']} failed: {r.status_code} {r.text}"
    d = r.json()
    return d["access_token"], d["user"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def tokens():
    return {
        "super": _login(SUPER), "madmin": _login(MADMIN),
        "cadmin": _login(CADMIN), "user": _login(USER),
    }


# ---------------- Auth ----------------
class TestAuth:
    def test_login_all_roles(self, tokens):
        roles = {k: v[1]["role"] for k, v in tokens.items()}
        assert roles == {"super": "super_admin", "madmin": "meeting_admin", "cadmin": "car_admin", "user": "user"}

    def test_me_role(self, tokens):
        for key, role in [("super", "super_admin"), ("madmin", "meeting_admin"), ("cadmin", "car_admin"), ("user", "user")]:
            tok, _ = tokens[key]
            r = requests.get(f"{API}/auth/me", headers=_hdr(tok), timeout=20)
            assert r.status_code == 200 and r.json()["role"] == role

    def test_register_new(self):
        email = f"TEST_reg_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "TestPass123", "name": "Reg", "company_name": "TEST",
        }, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "user" and r.json()["access_token"]

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@roombook.com", "password": "wrong"}, timeout=20)
        assert r.status_code == 401


# ---------------- RBAC ----------------
class TestRBAC:
    def test_madmin_blocked_users(self, tokens):
        assert requests.get(f"{API}/users", headers=_hdr(tokens["madmin"][0]), timeout=20).status_code == 403

    def test_cadmin_blocked_users(self, tokens):
        assert requests.get(f"{API}/users", headers=_hdr(tokens["cadmin"][0]), timeout=20).status_code == 403

    def test_user_blocked_users(self, tokens):
        assert requests.get(f"{API}/users", headers=_hdr(tokens["user"][0]), timeout=20).status_code == 403

    def test_madmin_blocked_vehicle_admin(self, tokens):
        assert requests.get(f"{API}/vehicle-bookings", headers=_hdr(tokens["madmin"][0]), timeout=20).status_code == 403

    def test_madmin_blocked_vehicle_create(self, tokens):
        r = requests.post(f"{API}/vehicles", headers=_hdr(tokens["madmin"][0]),
                          json={"plate_number": "TBLK", "name": "x", "type": "Sedan", "capacity": 4}, timeout=20)
        assert r.status_code == 403

    def test_cadmin_blocked_room_create(self, tokens):
        r = requests.post(f"{API}/rooms", headers=_hdr(tokens["cadmin"][0]),
                          json={"name": "TBLK", "location": "x", "capacity": 5}, timeout=20)
        assert r.status_code == 403

    def test_cadmin_blocked_admin_bookings(self, tokens):
        assert requests.get(f"{API}/bookings", headers=_hdr(tokens["cadmin"][0]), timeout=20).status_code == 403

    def test_user_blocked_admin_bookings(self, tokens):
        assert requests.get(f"{API}/bookings", headers=_hdr(tokens["user"][0]), timeout=20).status_code == 403

    def test_user_blocked_vehicle_admin(self, tokens):
        assert requests.get(f"{API}/vehicle-bookings", headers=_hdr(tokens["user"][0]), timeout=20).status_code == 403


# ---------------- User Management ----------------
class TestUserMgmt:
    @pytest.fixture
    def created(self, tokens):
        tok, _ = tokens["super"]
        email = f"TEST_um_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/users", headers=_hdr(tok), json={
            "email": email, "password": "PassWord1", "name": "UM",
            "company_name": "TEST", "role": "user",
        }, timeout=20)
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        yield uid, email
        requests.delete(f"{API}/users/{uid}", headers=_hdr(tok), timeout=20)

    def test_list_no_leak(self, tokens):
        tok, _ = tokens["super"]
        r = requests.get(f"{API}/users", headers=_hdr(tok), timeout=20)
        assert r.status_code == 200
        for u in r.json():
            assert "_id" not in u and "password_hash" not in u

    def test_update(self, tokens, created):
        tok, _ = tokens["super"]
        uid, _ = created
        r = requests.patch(f"{API}/users/{uid}", headers=_hdr(tok), json={"name": "Updated"}, timeout=20)
        assert r.status_code == 200 and r.json()["name"] == "Updated"

    def test_password_reset_then_login(self, tokens, created):
        tok, _ = tokens["super"]
        uid, email = created
        r = requests.post(f"{API}/users/{uid}/password", headers=_hdr(tok), json={"password": "NewPass456"}, timeout=20)
        assert r.status_code == 200
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "NewPass456"}, timeout=20)
        assert r2.status_code == 200

    def test_meeting_admin_can_reset_password_SECURITY_BUG(self, tokens, created):
        """SECURITY: meeting_admin should NOT be able to reset other users' passwords."""
        tok, _ = tokens["madmin"]
        uid, _ = created
        r = requests.post(f"{API}/users/{uid}/password", headers=_hdr(tok),
                          json={"password": "Hacked123"}, timeout=20)
        assert r.status_code == 403, (
            f"SECURITY: /api/users/{{id}}/password is not super_admin protected (got {r.status_code}). "
            "It currently uses require_admin (=meeting_admin) which is privilege escalation."
        )


# ---------------- Meeting Booking ----------------
class TestMeetingBooking:
    @pytest.fixture(scope="class")
    def room(self, tokens):
        tok, _ = tokens["madmin"]
        r = requests.post(f"{API}/rooms", headers=_hdr(tok), json={
            "name": f"TEST_R_{uuid.uuid4().hex[:6]}", "location": "T",
            "capacity": 10, "facilities": ["TV"], "is_active": True,
        }, timeout=20)
        assert r.status_code == 200, r.text
        rm = r.json()
        yield rm
        requests.delete(f"{API}/rooms/{rm['id']}", headers=_hdr(tok), timeout=20)

    def test_create_overlap_approve_cancel(self, tokens, room):
        utok, _ = tokens["user"]
        atok, _ = tokens["madmin"]
        date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/bookings", headers=_hdr(utok), json={
            "room_id": room["id"], "title": "TEST_BK", "date": date,
            "start_time": "10:00", "end_time": "11:00", "participants": 3,
        }, timeout=20)
        assert r.status_code == 200, r.text
        bk = r.json()
        assert "_id" not in bk and bk["status"] == "pending"
        bid = bk["id"]

        # Overlap rejected
        r2 = requests.post(f"{API}/bookings", headers=_hdr(utok), json={
            "room_id": room["id"], "title": "TEST_OV", "date": date,
            "start_time": "10:30", "end_time": "10:45", "participants": 2,
        }, timeout=20)
        assert r2.status_code == 409

        # Approve
        r3 = requests.patch(f"{API}/bookings/{bid}/status", headers=_hdr(atok),
                            json={"status": "confirmed"}, timeout=20)
        assert r3.status_code == 200 and r3.json()["status"] == "confirmed"

        # Check-in too early
        r4 = requests.post(f"{API}/bookings/{bid}/check-in", headers=_hdr(utok), timeout=20)
        assert r4.status_code == 400

        # Cancel
        r5 = requests.post(f"{API}/bookings/{bid}/cancel", headers=_hdr(utok), timeout=20)
        assert r5.status_code == 200 and r5.json()["status"] == "cancelled"

    def test_check_in_out_now(self, tokens, room):
        utok, _ = tokens["user"]
        atok, _ = tokens["madmin"]
        now = datetime.now()
        date = now.strftime("%Y-%m-%d")
        # start = current minute (== now floored, passes "not in past" check),
        # end = +60min so check-in/out window is open right now
        start = now.strftime("%H:%M")
        end = (now + timedelta(minutes=60)).strftime("%H:%M")
        r = requests.post(f"{API}/bookings", headers=_hdr(utok), json={
            "room_id": room["id"], "title": "TEST_NOW", "date": date,
            "start_time": start, "end_time": end, "participants": 1,
        }, timeout=20)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        assert requests.patch(f"{API}/bookings/{bid}/status", headers=_hdr(atok),
                              json={"status": "confirmed"}, timeout=20).status_code == 200
        ci = requests.post(f"{API}/bookings/{bid}/check-in", headers=_hdr(utok), timeout=20)
        assert ci.status_code == 200 and ci.json()["checked_in_at"]
        co = requests.post(f"{API}/bookings/{bid}/check-out", headers=_hdr(utok), timeout=20)
        assert co.status_code == 200 and co.json()["checked_out_at"] and co.json()["status"] == "completed"

    def test_my_bookings_shape(self, tokens):
        r = requests.get(f"{API}/bookings/mine", headers=_hdr(tokens["user"][0]), timeout=20)
        assert r.status_code == 200
        for b in r.json():
            assert "_id" not in b
            for k in ("room_name", "status", "date", "start_time", "end_time"):
                assert k in b


# ---------------- Vehicle Booking ----------------
class TestVehicleBooking:
    @pytest.fixture(scope="class")
    def vehicle(self, tokens):
        tok, _ = tokens["cadmin"]
        plate = f"TEST{uuid.uuid4().hex[:6].upper()}"
        r = requests.post(f"{API}/vehicles", headers=_hdr(tok), json={
            "plate_number": plate, "name": "TEST Sedan", "type": "Sedan",
            "capacity": 4, "year": 2024, "status": "available",
        }, timeout=20)
        assert r.status_code == 200, r.text
        v = r.json()
        yield v
        requests.delete(f"{API}/vehicles/{v['id']}", headers=_hdr(tok), timeout=20)

    @pytest.fixture(scope="class")
    def driver(self, tokens):
        tok, _ = tokens["cadmin"]
        r = requests.post(f"{API}/drivers", headers=_hdr(tok), json={
            "name": f"TEST_D_{uuid.uuid4().hex[:4]}", "phone": "+62800",
            "license_number": "TEST-001", "status": "available",
        }, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        yield d
        requests.delete(f"{API}/drivers/{d['id']}", headers=_hdr(tok), timeout=20)

    def test_full_flow(self, tokens, vehicle, driver):
        utok, _ = tokens["user"]
        ctok, _ = tokens["cadmin"]
        date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

        r = requests.post(f"{API}/vehicle-bookings", headers=_hdr(utok), json={
            "booking_type": "single_trip", "employee_name": "TEST E",
            "job_title": "Eng", "with_driver": True, "pickup_location": "HQ",
            "destination": "Airport", "purpose": "TEST", "passengers": 2,
            "start_date": date, "start_time": "08:00",
            "end_date": date, "end_time": "17:00",
        }, timeout=20)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        assert "_id" not in r.json()

        assert requests.patch(f"{API}/vehicle-bookings/{bid}/approve", headers=_hdr(ctok), timeout=20).json()["status"] == "approved"

        r3 = requests.patch(f"{API}/vehicle-bookings/{bid}/assign", headers=_hdr(ctok), json={
            "vehicle_id": vehicle["id"], "driver_id": driver["id"],
            "pickup_schedule": "07:30",
        }, timeout=20)
        assert r3.status_code == 200, r3.text
        a = r3.json()
        assert a["status"] == "assigned"
        assert a["vehicle_plate"] == vehicle["plate_number"]
        assert a["driver_name"] == driver["name"]

        r4 = requests.post(f"{API}/vehicle-bookings/{bid}/handover/user", headers=_hdr(utok), json={
            "odometer_start": 12000, "fuel_level_start": "Full",
            "condition_before": "Clean", "signature_name": "TEST U",
        }, timeout=20)
        assert r4.status_code == 200, r4.text
        assert r4.json()["handover"]["odometer_start"] == 12000

        r5 = requests.post(f"{API}/vehicle-bookings/{bid}/handover/admin", headers=_hdr(ctok),
                           json={"signature_name": "TEST A"}, timeout=20)
        assert r5.status_code == 200 and r5.json()["status"] == "in_use"

        r6 = requests.post(f"{API}/vehicle-bookings/{bid}/return/user", headers=_hdr(utok), json={
            "odometer_end": 12150, "fuel_level_end": "3/4",
            "condition_after": "Good", "signature_name": "TEST U",
        }, timeout=20)
        assert r6.status_code == 200, r6.text

        r7 = requests.post(f"{API}/vehicle-bookings/{bid}/return/admin", headers=_hdr(ctok),
                           json={"signature_name": "TEST A2"}, timeout=20)
        assert r7.status_code == 200 and r7.json()["status"] == "completed"

    def test_user_cancel_pending(self, tokens):
        utok, _ = tokens["user"]
        date = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/vehicle-bookings", headers=_hdr(utok), json={
            "booking_type": "single_trip", "employee_name": "T", "job_title": "T",
            "with_driver": False, "purpose": "TEST", "passengers": 1,
            "start_date": date, "start_time": "08:00",
            "end_date": date, "end_time": "10:00",
        }, timeout=20)
        bid = r.json()["id"]
        rc = requests.post(f"{API}/vehicle-bookings/{bid}/cancel", headers=_hdr(utok), timeout=20)
        assert rc.status_code == 200 and rc.json()["status"] == "cancelled"

    def test_my_vehicle_shape(self, tokens):
        r = requests.get(f"{API}/vehicle-bookings/mine", headers=_hdr(tokens["user"][0]), timeout=20)
        assert r.status_code == 200
        for b in r.json():
            assert "_id" not in b
            for k in ("status", "start_date", "end_date", "handover", "return_info"):
                assert k in b


# ---------------- _id leak guard ----------------
class TestNoIdLeaks:
    def test_rooms(self):
        r = requests.get(f"{API}/rooms", timeout=20)
        assert r.status_code == 200
        assert all("_id" not in x for x in r.json())

    def test_vehicles(self):
        r = requests.get(f"{API}/vehicles", timeout=20)
        assert r.status_code == 200
        assert all("_id" not in x for x in r.json())

    def test_drivers(self):
        r = requests.get(f"{API}/drivers", timeout=20)
        assert r.status_code == 200
        assert all("_id" not in x for x in r.json())
