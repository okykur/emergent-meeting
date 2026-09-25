import asyncio

import server


class FakeCursor:
    async def to_list(self, _limit):
        return []


class FakeUsers:
    def __init__(self):
        self.inserted = None

    async def find_one(self, _query):
        return None

    async def insert_one(self, document):
        self.inserted = document

    def find(self, *_args, **_kwargs):
        return FakeCursor()


class FakeBackgroundTasks:
    def __init__(self):
        self.tasks = []

    def add_task(self, function, *args, **kwargs):
        self.tasks.append((function, args, kwargs))


def test_registration_accepts_public_email_domains(monkeypatch):
    users = FakeUsers()
    monkeypatch.setattr(server, "db", type("FakeDb", (), {"users": users})())
    monkeypatch.setattr(server, "hash_password", lambda _password: "hashed")

    payload = server.RegisterRequest(
        email="new.user@gmail.com",
        password="SecurePass123",
        name="New User",
        company_name="External Company",
        job_title="Manager",
        department="Operations",
        office_address="Jakarta",
        supervisor_name="Supervisor",
        supervisor_email="supervisor@outlook.com",
    )
    background_tasks = FakeBackgroundTasks()
    response = asyncio.run(server.register(payload, background_tasks))

    assert response.message.startswith("Account created")
    assert users.inserted["email"] == "new.user@gmail.com"
    assert users.inserted["supervisor_email"] == "supervisor@outlook.com"
    assert users.inserted["approval_status"] == "pending"
    assert [task[0] for task in background_tasks.tasks] == [
        server._send_registration_pending_confirmation,
        server._send_registration_admin_notification,
    ]


def test_pending_registration_email_uses_resend_template(monkeypatch):
    sent = []

    def capture(to_email, subject, text, html):
        sent.append({"to": to_email, "subject": subject, "text": text, "html": html})
        return True

    monkeypatch.setattr(server, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(server, "_send_resend_email", capture)
    server._send_registration_pending_confirmation({"name": "Anita Wijaya", "email": "anita@gmail.com"})

    assert sent[0]["to"] == "anita@gmail.com"
    assert sent[0]["subject"] == "Pengajuan Akun GASS Sedang Diproses"
    assert "bgcolor='#272d91'" in sent[0]["html"]
    assert "MENUNGGU PERSETUJUAN" in sent[0]["html"]
    assert "Pengajuan Akun Anda Sedang Diproses" in sent[0]["html"]
    assert "Halo Anita Wijaya" in sent[0]["html"]
    assert "menunggu persetujuan Admin" in sent[0]["html"]
    assert "/brand-logo.png" in sent[0]["html"]


def test_new_registration_notifies_superadmin_with_blue_template(monkeypatch):
    sent = []

    def capture(to_email, subject, text, html):
        sent.append({"to": to_email, "subject": subject, "text": text, "html": html})
        return True

    user = {
        "name": "Anita Wijaya",
        "email": "anitawijaya@kcsi.com",
        "company_name": "KCSI",
        "department": "IT",
        "job_title": "System Analyst",
        "office_address": "HO Jakarta",
        "supervisor_name": "Oky",
        "supervisor_email": "oky@kcsi.com",
    }
    monkeypatch.setattr(server, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(server, "_send_resend_email", capture)
    server._send_registration_admin_notification(user, ["superadmin@kcsi.com"])

    assert sent[0]["to"] == "superadmin@kcsi.com"
    assert sent[0]["subject"] == "[GASS] Persetujuan Aktivasi Akun - Anita Wijaya"
    assert "bgcolor='#2948b8'" in sent[0]["html"]
    assert "DIPERLUKAN PERSETUJUAN" in sent[0]["html"]
    assert "Permintaan Persetujuan Aktivasi Akun User" in sent[0]["html"]
    assert "Yth. Super Admin" in sent[0]["html"]
    assert "anitawijaya@kcsi.com" in sent[0]["html"]
    assert "System Analyst" in sent[0]["html"]
    assert "HO Jakarta" in sent[0]["html"]
    assert "oky@kcsi.com" in sent[0]["html"]
    assert "Login Ke Sistem" in sent[0]["html"]
    assert "/admin/users" in sent[0]["html"]
    assert "/brand-logo.png" in sent[0]["html"]


def test_approved_registration_email_uses_green_template(monkeypatch):
    sent = []

    def capture(to_email, subject, text, html):
        sent.append({"to": to_email, "subject": subject, "text": text, "html": html})
        return True

    monkeypatch.setattr(server, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(server, "_send_resend_email", capture)
    server._send_user_approval_result(
        {
            "name": "Anita Wijaya",
            "email": "anita@gmail.com",
            "approval_status": "approved",
            "role": "user",
        }
    )

    assert sent[0]["to"] == "anita@gmail.com"
    assert sent[0]["subject"] == "Akun GASS Anda Telah Disetujui"
    assert "bgcolor='#0d6645'" in sent[0]["html"]
    assert "AKUN DISETUJUI" in sent[0]["html"]
    assert "Akun Anda Telah Disetujui" in sent[0]["html"]
    assert "Halo Anita Wijaya" in sent[0]["html"]
    assert "Login Ke Sistem" in sent[0]["html"]
    assert "/brand-logo.png" in sent[0]["html"]
    assert "/login" in sent[0]["html"]
    assert "automated email from GASS" in sent[0]["html"]


def test_rejected_registration_email_uses_red_template(monkeypatch):
    sent = []

    def capture(to_email, subject, text, html):
        sent.append({"to": to_email, "subject": subject, "text": text, "html": html})
        return True

    monkeypatch.setattr(server, "RESEND_API_KEY", "test-key")
    monkeypatch.setattr(server, "_send_resend_email", capture)
    server._send_user_approval_result(
        {
            "name": "Anita Wijaya",
            "email": "anita@gmail.com",
            "approval_status": "rejected",
            "rejection_reason": "Aplikasi hanya untuk internal",
        }
    )

    assert sent[0]["to"] == "anita@gmail.com"
    assert sent[0]["subject"] == "Pengajuan Akun GASS Anda Ditolak"
    assert "bgcolor='#c91d23'" in sent[0]["html"]
    assert "PENGAJUAN DITOLAK" in sent[0]["html"]
    assert "Pengajuan Akun Anda Ditolak" in sent[0]["html"]
    assert "Halo Anita Wijaya" in sent[0]["html"]
    assert "Aplikasi hanya untuk internal" in sent[0]["html"]
    assert "/brand-logo.png" in sent[0]["html"]
    assert "General Affair" in sent[0]["html"]
    assert "automated email from GASS" in sent[0]["html"]
