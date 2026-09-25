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
    response = asyncio.run(server.register(payload, FakeBackgroundTasks()))

    assert response.message.startswith("Account created")
    assert users.inserted["email"] == "new.user@gmail.com"
    assert users.inserted["supervisor_email"] == "supervisor@outlook.com"
    assert users.inserted["approval_status"] == "pending"
