import server


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


def assert_template_content(message):
    assert message["subject"] == "[GASS] Approval Required - Product Launching Q1 2026"
    assert "APPROVAL REQUIRED" in message["html"]
    assert "Meeting Approval Request" in message["html"]
    assert "Internal 10, BOD 3, External 2" in message["html"]
    assert "15 September 2025, 08:00 – 14:00" in message["html"]
    assert "Ruang Komodo (Lantai 2), HO NTI Jakarta" in message["html"]
    assert "Snack Box, Lunch Box, Projector, Whiteboard" in message["html"]
    assert "This is an automated email from GASS" in message["html"]
    assert "bgcolor='#0b6642'" in message["html"]
    assert "bgcolor='#fff0c2'" in message["html"]
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
    assert "Approve" in sent[0]["html"]
    assert "Reject" in sent[0]["html"]
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
    assert "Review in GASS" in sent[0]["html"]
    assert_template_content(sent[0])


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
