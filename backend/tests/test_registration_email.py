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
