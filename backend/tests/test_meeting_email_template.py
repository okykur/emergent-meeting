import asyncio
import json
from datetime import datetime, timedelta, timezone

import server


class FakeResendResponse:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


def test_resend_embeds_brand_logo_with_cid(monkeypatch):
    requests = []

    def capture(request, timeout):
        requests.append((request, timeout))
        return FakeResendResponse()

    monkeypatch.setattr(server, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(server, "APP_PUBLIC_URL", "http://booking.kcsi-id.com")
    monkeypatch.setattr(server, "_brand_logo_base64", lambda: "aW1hZ2UtYnl0ZXM=")
    monkeypatch.setattr(server, "urlopen", capture)

    sent = server._send_resend_email(
        "recipient@example.com",
        "Subject",
        "Plain text",
        '<img src="http://booking.kcsi-id.com/brand-logo.png" alt="KCSI">',
    )

    payload = json.loads(requests[0][0].data.decode("utf-8"))
    assert sent is True
    assert payload["html"] == '<img src="cid:gass-brand-logo" alt="KCSI">'
    assert payload["attachments"] == [
        {
            "content": "aW1hZ2UtYnl0ZXM=",
            "filename": "gass-brand-logo.png",
            "content_type": "image/png",
            "content_id": "gass-brand-logo",
        }
    ]


def test_resend_keeps_public_logo_url_when_local_file_is_unavailable(monkeypatch):
    requests = []

    def capture(request, timeout):
        requests.append((request, timeout))
        return FakeResendResponse()

    monkeypatch.setattr(server, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(server, "APP_PUBLIC_URL", "http://booking.kcsi-id.com")
    monkeypatch.setattr(server, "_brand_logo_base64", lambda: None)
    monkeypatch.setattr(server, "urlopen", capture)

    sent = server._send_resend_email(
        "recipient@example.com",
        "Subject",
        "Plain text",
        '<img src="http://booking.kcsi-id.com/brand-logo.png" alt="KCSI">',
    )

    payload = json.loads(requests[0][0].data.decode("utf-8"))
    assert sent is True
    assert payload["html"] == '<img src="http://booking.kcsi-id.com/brand-logo.png" alt="KCSI">'
    assert "attachments" not in payload


class FakeBookingCounter:
    def __init__(self, seq):
        self.seq = seq
        self.calls = []

    async def find_one_and_update(self, query, update, **kwargs):
        self.calls.append((query, update, kwargs))
        return {"_id": query["_id"], "seq": self.seq}


def test_booking_numbers_use_type_date_and_four_digit_sequence(monkeypatch):
    counter = FakeBookingCounter(42)
    monkeypatch.setattr(server.db, "counters", counter)

    meeting_number = asyncio.run(server._next_booking_number("MR", "2026-10-08"))
    vehicle_number = asyncio.run(server._next_booking_number("BK", "2026-10-08"))

    assert meeting_number == "MR2610080042"
    assert vehicle_number == "BK2610080042"
    assert len(meeting_number) == 12
    assert counter.calls[0][0] == {"_id": "booking_number:MR:261008"}
    assert counter.calls[1][0] == {"_id": "booking_number:BK:261008"}


def test_booking_number_rejects_invalid_date():
    try:
        asyncio.run(server._next_booking_number("MR", "08/10/2026"))
    except server.HTTPException as exc:
        assert exc.status_code == 400
    else:
        raise AssertionError("Invalid booking date should be rejected")


def sample_booking():
    return {
        "id": "BKG-MR-001",
        "user_name": "Anita Wijaya",
        "supervisor_name": "Bagus Prasetyo",
        "supervisor_email": "bagus@example.com",
        "title": "Product Launching Q1 2026",
        "participants": 15,
        "guest_counts": {"Internal": 10, "BOD": 3, "Xternal": 2},
        "date": "2025-09-15",
        "start_time": "08:00",
        "end_time": "14:00",
        "room_name": "Ruang Komodo (Lantai 2)",
        "room_building": "HO NTI Jakarta",
        "snack_type": "Snack",
        "snack_packaging": "Dus",
        "meal_types": ["Makan siang"],
        "meal_packaging": "Dus",
        "additional_facilities": ["Projector", "Whiteboard"],
        "food_beverages": "Snack, Makan siang",
    }


def test_manager_user_approval_expiry_supports_postgres_datetimes():
    now = datetime(2026, 10, 8, 3, 0, tzinfo=timezone.utc)

    assert server._manager_user_approval_is_expired(
        {"expires_at": now + timedelta(days=7)}, now
    ) is False
    assert server._manager_user_approval_is_expired(
        {"expires_at": (now - timedelta(seconds=1)).replace(tzinfo=None)}, now
    ) is True
    assert server._manager_user_approval_is_expired(
        {"expires_at": (now + timedelta(seconds=1)).isoformat()}, now
    ) is False
    assert server._manager_user_approval_is_expired({"expires_at": None}, now) is True


def test_manager_user_reject_confirmation_requires_reason():
    booking = sample_booking()

    reject_html = server._approval_confirmation_page("approval-token", "rejected", booking)
    approve_html = server._approval_confirmation_page("approval-token", "approved", booking)

    assert "name='rejection_reason'" in reject_html
    assert "required maxlength='500'" in reject_html
    assert "Alasan penolakan" in reject_html
    assert "Masukkan alasan penolakan meeting..." in reject_html
    assert "background:#cf171d" in reject_html
    assert "requested by Anita Wijaya" in reject_html
    assert "name='rejection_reason'" not in approve_html


def assert_template_content(message):
    assert message["subject"] == "[GASS] Persetujuan Rapat Diperlukan - Product Launching Q1 2026"
    assert "DIPERLUKAN PERSETUJUAN" in message["html"]
    assert "Permintaan Persetujuan Rapat" in message["html"]
    assert "Internal 10, BOD 3, External 2" in message["html"]
    assert "15 September 2025, 08:00 – 14:00" in message["html"]
    assert "Ruang Komodo (Lantai 2), HO NTI Jakarta" in message["html"]
    assert "Snack Box, Lunch Box, Projector, Whiteboard" in message["html"]
    assert "This is an automated email from GASS" in message["html"]
    assert "bgcolor='#2948b8'" in message["html"]
    assert "bgcolor='#d8ecfb'" in message["html"]
    assert "/brand-logo.png" in message["html"]
    assert "text-align:right" in message["html"]


def test_manager_user_email_uses_resend_and_keeps_decision_links(monkeypatch):
    sent = []

    def capture(to_email, subject, text, html):
        sent.append({"to": to_email, "subject": subject, "text": text, "html": html})
        return True

    monkeypatch.setattr(server, "SUPERVISOR_EMAIL_PROVIDER", "resend")
    monkeypatch.setattr(server, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(server, "_send_resend_email", capture)

    assert server._send_supervisor_approval_email(sample_booking(), "approval-token") is True
    assert sent[0]["to"] == "bagus@example.com"
    assert "Approve Meeting" in sent[0]["html"]
    assert "Reject Meeting" in sent[0]["html"]
    assert "approval-token" in sent[0]["html"]
    assert_template_content(sent[0])


def test_manager_ga_email_uses_resend_template(monkeypatch):
    sent = []

    def capture(to_email, subject, text, html):
        sent.append({"to": to_email, "subject": subject, "text": text, "html": html})
        return True

    monkeypatch.setattr(server, "_send_resend_email", capture)
    server._send_manager_ga_approval_notifications(sample_booking(), ["ga.manager@example.com"])

    assert sent[0]["to"] == "ga.manager@example.com"
    assert "Buka Approval Meeting" in sent[0]["html"]
    assert "Yth. Manager GA" in sent[0]["html"]
    assert_template_content(sent[0])


def test_manager_ga_recipients_are_filtered_by_location(monkeypatch):
    class FakeCursor:
        async def to_list(self, _limit):
            return [
                {
                    "email": "manager.ho@example.com",
                    "fnb_locations": ["HO NTI Jakarta", "Kudus"],
                    "role": "manager",
                },
                {
                    "email": "manager.kudus@example.com",
                    "fnb_locations": ["Kudus"],
                    "role": "manager",
                },
            ]

    class FakeUsers:
        def find(self, *_args, **_kwargs):
            return FakeCursor()

    monkeypatch.setattr(server, "db", type("FakeDb", (), {"users": FakeUsers()})())

    recipients = asyncio.run(server._manager_ga_recipients("HO NTI Jakarta"))
    assert recipients == ["manager.ho@example.com"]


def test_booking_approval_email_uses_final_confirmation_template(monkeypatch):
    sent = []

    def capture(to_email, subject, text, html):
        sent.append({"to": to_email, "subject": subject, "text": text, "html": html})
        return True

    booking = sample_booking()
    booking["user_email"] = "anita@example.com"
    monkeypatch.setattr(server, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(server, "_send_resend_email", capture)

    assert server._send_booking_approval_email(booking) is True
    assert sent[0]["to"] == "anita@example.com"
    assert sent[0]["subject"] == "[GASS] Peminjaman Ruangan Disetujui - Product Launching Q1 2026"
    assert "bgcolor='#0d6645'" in sent[0]["html"]
    assert "PEMINJAMAN DISETUJUI" in sent[0]["html"]
    assert "Pengajuan Peminjaman Ruangan Disetujui" in sent[0]["html"]
    assert "Halo Anita Wijaya" in sent[0]["html"]
    assert "Internal 10, BOD 3, External 2" in sent[0]["html"]
    assert "15 September 2025, 08:00 – 14:00" in sent[0]["html"]
    assert "Ruang Komodo (Lantai 2), HO NTI Jakarta" in sent[0]["html"]
    assert "Snack Box, Lunch Box, Projector, Whiteboard" in sent[0]["html"]
    assert "Login Ke Sistem" in sent[0]["html"]
    assert "/brand-logo.png" in sent[0]["html"]


def test_booking_approval_email_labels_empty_accommodation(monkeypatch):
    sent = []

    def capture(to_email, subject, text, html):
        sent.append({"to": to_email, "subject": subject, "text": text, "html": html})
        return True

    booking = sample_booking()
    booking.update(
        {
            "user_email": "anita@example.com",
            "snack_type": "",
            "meal_types": [],
            "additional_facilities": [],
            "food_beverages": "",
        }
    )
    monkeypatch.setattr(server, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(server, "_send_resend_email", capture)

    assert server._send_booking_approval_email(booking) is True
    assert "Tidak ada akomodasi" in sent[0]["html"]


def test_room_reassignment_email_uses_orange_template(monkeypatch):
    sent = []

    def capture(to_email, subject, text, html):
        sent.append({"to": to_email, "subject": subject, "text": text, "html": html})
        return True

    booking = sample_booking()
    booking.update(
        {
            "user_email": "anita@example.com",
            "room_name": "Ruang Garuda (Lantai 3)",
            "room_building": "HO NTI Jakarta",
        }
    )
    monkeypatch.setattr(server, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(server, "_send_resend_email", capture)

    assert server._send_booking_room_reassignment_email(
        booking,
        {"name": "Ruang Komodo (Lantai 2)", "building": "HO NTI Jakarta"},
    ) is True
    assert sent[0]["to"] == "anita@example.com"
    assert sent[0]["subject"] == "[GASS] Perubahan Ruangan - Product Launching Q1 2026"
    assert "bgcolor='#e47b00'" in sent[0]["html"]
    assert "PERUBAHAN RUANGAN" in sent[0]["html"]
    assert "Ruang Komodo (Lantai 2)" in sent[0]["html"]
    assert "Ruang Garuda (Lantai 3)" in sent[0]["html"]
    assert "Internal 10, BOD 3, External 2" in sent[0]["html"]
    assert "15 September 2025" in sent[0]["html"]
    assert "08:00" in sent[0]["html"]
    assert "14:00" in sent[0]["html"]
    assert "Snack Box, Lunch Box, Projector, Whiteboard" in sent[0]["html"]
    assert "/brand-logo.png" in sent[0]["html"]


def test_booking_rejection_email_uses_meeting_rejection_template(monkeypatch):
    sent = []

    def capture(to_email, subject, text, html):
        sent.append({"to": to_email, "subject": subject, "text": text, "html": html})
        return True

    booking = sample_booking()
    booking["user_email"] = "anita@example.com"
    monkeypatch.setattr(server, "SUPERVISOR_EMAIL_PROVIDER", "resend")
    monkeypatch.setattr(server, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(server, "_send_resend_email", capture)

    assert server._send_booking_rejection_email(booking, "Durasi meeting kurang dari 4 jam", "meeting") is True
    assert sent[0]["to"] == "anita@example.com"
    assert sent[0]["subject"] == "[GASS] Peminjaman Ruangan Ditolak - Product Launching Q1 2026"
    assert "bgcolor='#c91d23'" in sent[0]["html"]
    assert "PEMINJAMAN TIDAK DISETUJUI" in sent[0]["html"]
    assert "Pengajuan Peminjaman Ruangan Ditolak" in sent[0]["html"]
    assert "Halo Anita Wijaya" in sent[0]["html"]
    assert "Internal 10, BOD 3, External 2" in sent[0]["html"]
    assert "15 September 2025, 08:00 – 14:00" in sent[0]["html"]
    assert "Ruang Komodo (Lantai 2), HO NTI Jakarta" in sent[0]["html"]
    assert "Snack Box, Lunch Box, Projector, Whiteboard" in sent[0]["html"]
    assert "Durasi meeting kurang dari 4 jam" in sent[0]["html"]
    assert "/brand-logo.png" in sent[0]["html"]
    assert "automated email from GASS" in sent[0]["html"]


def test_meeting_admin_notification_uses_blue_template(monkeypatch):
    sent = []

    def capture(to_email, subject, text, html):
        sent.append({"to": to_email, "subject": subject, "text": text, "html": html})
        return True

    booking = sample_booking()
    monkeypatch.setattr(server, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(server, "_send_resend_email", capture)
    server._send_meeting_admin_booking_notifications(
        booking,
        ["admin.pulogadung@example.com", "admin.pulogadung@example.com"],
    )

    assert len(sent) == 1
    assert sent[0]["to"] == "admin.pulogadung@example.com"
    assert sent[0]["subject"] == "[GASS] Persetujuan Rapat Diperlukan - Product Launching Q1 2026"
    assert "bgcolor='#2948b8'" in sent[0]["html"]
    assert "DIPERLUKAN PERSETUJUAN" in sent[0]["html"]
    assert "Permintaan Persetujuan Rapat" in sent[0]["html"]
    assert "Yth. Admin Meeting Room" in sent[0]["html"]
    assert "Anita Wijaya" in sent[0]["html"]
    assert "Internal 10, BOD 3, External 2" in sent[0]["html"]
    assert "15 September 2025, 08:00 – 14:00" in sent[0]["html"]
    assert "Ruang Komodo (Lantai 2), HO NTI Jakarta" in sent[0]["html"]
    assert "Snack Box, Lunch Box, Projector, Whiteboard" in sent[0]["html"]
    assert "/admin/bookings" in sent[0]["html"]
    assert "/brand-logo.png" in sent[0]["html"]


def test_meeting_admin_recipients_are_filtered_by_building(monkeypatch):
    class FakeCursor:
        async def to_list(self, _limit):
            return [
                {
                    "email": "pulogadung@example.com",
                    "meeting_buildings": ["Pulogadung", "Kudus"],
                    "role": "meeting_admin",
                },
                {
                    "email": "kudus@example.com",
                    "meeting_buildings": ["Kudus"],
                    "role": "meeting_admin",
                },
            ]

    class FakeUsers:
        def find(self, *_args, **_kwargs):
            return FakeCursor()

    monkeypatch.setattr(server, "db", type("FakeDb", (), {"users": FakeUsers()})())

    recipients = asyncio.run(server._meeting_admin_recipients("Pulogadung"))
    assert recipients == ["pulogadung@example.com"]
