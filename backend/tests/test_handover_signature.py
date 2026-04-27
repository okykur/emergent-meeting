"""
Tests for new handover/return photos + signature_data fields (P2 task).
- photos array is appended across user/admin calls
- signature_data persists into user_signature_data / admin_signature_data
- signature_name remains REQUIRED
- ~1MB realistic payload (random bytes) round-trips through Mongo+ingress
"""
import base64
import os
import secrets
import uuid
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://conf-room-nexus.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER = {"email": "admin@roombook.com", "password": "Admin@123"}
CADMIN = {"email": "car_admin@test.com", "password": "Car@123"}
USER = {"email": "user@roombook.com", "password": "User@123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    return d["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _rand_data_url(approx_bytes: int) -> str:
    # Use random bytes to bypass Cloudflare WAF rule 1010 that rejects repeated bytes.
    raw = secrets.token_bytes(approx_bytes)
    return "data:image/jpeg;base64," + base64.b64encode(raw).decode()


@pytest.fixture(scope="module")
def tokens():
    return {"user": _login(USER), "cadmin": _login(CADMIN)}


@pytest.fixture(scope="module")
def booking_assigned(tokens):
    """Create + approve + assign a fresh booking. Returns booking id ready for handover."""
    utok, ctok = tokens["user"], tokens["cadmin"]
    # vehicle
    plate = f"TST{uuid.uuid4().hex[:5].upper()}"
    rv = requests.post(f"{API}/vehicles", headers=_hdr(ctok), json={
        "plate_number": plate, "name": "TEST V", "type": "Sedan",
        "capacity": 4, "year": 2024, "status": "available",
    }, timeout=20)
    assert rv.status_code == 200, rv.text
    vid = rv.json()["id"]

    date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    r = requests.post(f"{API}/vehicle-bookings", headers=_hdr(utok), json={
        "booking_type": "single_trip", "employee_name": "TEST E", "job_title": "Eng",
        "with_driver": False, "pickup_location": "HQ", "destination": "Air",
        "purpose": "TEST_SIG", "passengers": 1,
        "start_date": date, "start_time": "08:00",
        "end_date": date, "end_time": "17:00",
    }, timeout=20)
    assert r.status_code == 200, r.text
    bid = r.json()["id"]
    assert requests.patch(f"{API}/vehicle-bookings/{bid}/approve", headers=_hdr(ctok), timeout=20).status_code == 200
    ra = requests.patch(f"{API}/vehicle-bookings/{bid}/assign", headers=_hdr(ctok), json={
        "vehicle_id": vid, "pickup_schedule": "07:30",
    }, timeout=20)
    assert ra.status_code == 200, ra.text
    yield bid, vid
    # cleanup vehicle (booking remains for inspection)
    requests.delete(f"{API}/vehicles/{vid}", headers=_hdr(ctok), timeout=20)


class TestHandoverSignaturePhotos:
    def test_signature_name_required_422(self, tokens, booking_assigned):
        bid, _ = booking_assigned
        r = requests.post(f"{API}/vehicle-bookings/{bid}/handover/user", headers=_hdr(tokens["user"]),
                          json={"odometer_start": 100, "fuel_level_start": "Full",
                                "condition_before": "ok"}, timeout=20)
        assert r.status_code == 422, f"expected 422 missing signature_name, got {r.status_code} {r.text}"

    def test_user_handover_with_photos_and_signature(self, tokens, booking_assigned):
        bid, _ = booking_assigned
        sig = _rand_data_url(8 * 1024)  # 8KB sig
        photos = [_rand_data_url(60 * 1024), _rand_data_url(60 * 1024)]
        r = requests.post(f"{API}/vehicle-bookings/{bid}/handover/user", headers=_hdr(tokens["user"]),
                          json={"odometer_start": 1000, "fuel_level_start": "Full",
                                "condition_before": "Clean", "signature_name": "U Sign",
                                "signature_data": sig, "photos": photos}, timeout=60)
        assert r.status_code == 200, r.text
        ho = r.json()["handover"]
        assert ho["user_signature_data"] == sig
        assert ho["user_signature_name"] == "U Sign"
        assert isinstance(ho.get("photos"), list) and len(ho["photos"]) == 2
        assert ho["photos"][0] == photos[0]
        # _id must not leak
        assert "_id" not in r.json()

    def test_admin_handover_appends_photos_and_stores_admin_sig(self, tokens, booking_assigned):
        bid, _ = booking_assigned
        sig_a = _rand_data_url(8 * 1024)
        photos_a = [_rand_data_url(50 * 1024)]  # one more photo
        r = requests.post(f"{API}/vehicle-bookings/{bid}/handover/admin", headers=_hdr(tokens["cadmin"]),
                          json={"signature_name": "A Sign", "signature_data": sig_a,
                                "photos": photos_a}, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "in_use"
        ho = body["handover"]
        assert ho["admin_signature_data"] == sig_a
        assert ho["admin_signature_name"] == "A Sign"
        # APPENDED: prior 2 user photos + 1 admin photo => 3
        assert len(ho["photos"]) == 3, f"photos not appended: {len(ho['photos'])}"
        # original user_signature_data preserved
        assert ho.get("user_signature_data")

    def test_user_return_with_photos_and_signature(self, tokens, booking_assigned):
        bid, _ = booking_assigned
        sig = _rand_data_url(6 * 1024)
        photos = [_rand_data_url(40 * 1024)]
        r = requests.post(f"{API}/vehicle-bookings/{bid}/return/user", headers=_hdr(tokens["user"]),
                          json={"odometer_end": 1100, "fuel_level_end": "3/4",
                                "condition_after": "Good", "signature_name": "U Ret",
                                "signature_data": sig, "photos": photos}, timeout=60)
        assert r.status_code == 200, r.text
        ri = r.json()["return_info"]
        assert ri["user_signature_data"] == sig
        assert len(ri["photos"]) == 1

    def test_admin_return_appends_and_completes(self, tokens, booking_assigned):
        bid, _ = booking_assigned
        sig = _rand_data_url(6 * 1024)
        photos = [_rand_data_url(40 * 1024), _rand_data_url(40 * 1024)]
        r = requests.post(f"{API}/vehicle-bookings/{bid}/return/admin", headers=_hdr(tokens["cadmin"]),
                          json={"signature_name": "A Ret", "signature_data": sig,
                                "photos": photos}, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "completed"
        ri = body["return_info"]
        assert ri["admin_signature_data"] == sig
        assert len(ri["photos"]) == 3  # 1 user + 2 admin


class TestLargePayload:
    """End-to-end ~1MB payload (4 photos x 200KB random b64 + signature)."""
    @pytest.fixture(scope="class")
    def fresh_assigned(self, ):
        ctok = _login(CADMIN)
        utok = _login(USER)
        plate = f"TST{uuid.uuid4().hex[:5].upper()}"
        rv = requests.post(f"{API}/vehicles", headers=_hdr(ctok), json={
            "plate_number": plate, "name": "TEST L", "type": "Sedan",
            "capacity": 4, "year": 2024, "status": "available",
        }, timeout=20)
        vid = rv.json()["id"]
        date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/vehicle-bookings", headers=_hdr(utok), json={
            "booking_type": "single_trip", "employee_name": "TEST L", "job_title": "x",
            "with_driver": False, "purpose": "TEST_LP", "passengers": 1,
            "start_date": date, "start_time": "08:00",
            "end_date": date, "end_time": "17:00",
        }, timeout=20)
        bid = r.json()["id"]
        requests.patch(f"{API}/vehicle-bookings/{bid}/approve", headers=_hdr(ctok), timeout=20)
        requests.patch(f"{API}/vehicle-bookings/{bid}/assign", headers=_hdr(ctok),
                       json={"vehicle_id": vid, "pickup_schedule": "07:30"}, timeout=20)
        yield bid, utok, ctok
        requests.delete(f"{API}/vehicles/{vid}", headers=_hdr(ctok), timeout=20)

    def test_one_megabyte_payload(self, fresh_assigned):
        bid, utok, _ = fresh_assigned
        photos = [_rand_data_url(200 * 1024) for _ in range(4)]
        sig = _rand_data_url(20 * 1024)
        payload = {"odometer_start": 0, "fuel_level_start": "Full",
                   "condition_before": "ok", "signature_name": "Big",
                   "signature_data": sig, "photos": photos}
        r = requests.post(f"{API}/vehicle-bookings/{bid}/handover/user",
                          headers=_hdr(utok), json=payload, timeout=120)
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        ho = r.json()["handover"]
        assert len(ho["photos"]) == 4
        assert ho["user_signature_data"] == sig
