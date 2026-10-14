import asyncio
import re

import pytest
from fastapi import HTTPException

import server


class Result:
    def __init__(self, deleted_count=0):
        self.deleted_count = deleted_count


class FakePositions:
    def __init__(self):
        self.docs = []

    @staticmethod
    def _matches(doc, query):
        for key, expected in query.items():
            actual = doc.get(key)
            if isinstance(expected, dict) and "$ne" in expected:
                if actual == expected["$ne"]:
                    return False
            elif isinstance(expected, dict) and "$regex" in expected:
                flags = re.IGNORECASE if "i" in expected.get("$options", "") else 0
                if re.search(expected["$regex"], str(actual or ""), flags) is None:
                    return False
            elif actual != expected:
                return False
        return True

    async def find_one(self, query, _projection=None):
        for doc in self.docs:
            if self._matches(doc, query):
                return dict(doc)
        return None

    async def insert_one(self, doc):
        self.docs.append(dict(doc))

    async def insert_many(self, docs):
        self.docs.extend(dict(doc) for doc in docs)

    async def count_documents(self, _query):
        return len(self.docs)

    async def update_one(self, query, update):
        for doc in self.docs:
            if self._matches(doc, query):
                doc.update(update["$set"])
                break

    async def delete_one(self, query):
        before = len(self.docs)
        self.docs = [doc for doc in self.docs if not self._matches(doc, query)]
        return Result(deleted_count=before - len(self.docs))

    def find(self, _query, _projection=None):
        docs = [dict(doc) for doc in self.docs]

        class Cursor:
            def sort(self, key, direction):
                docs.sort(key=lambda item: item.get(key, ""), reverse=direction < 0)
                return self

            async def to_list(self, _limit):
                return docs

        return Cursor()


def super_admin(name="Anne"):
    return {"id": "admin-1", "name": name, "email": "anne@example.com", "role": "super_admin"}


def test_position_crud_normalizes_values_and_tracks_audit(monkeypatch):
    positions = FakePositions()
    monkeypatch.setattr(server, "db", type("FakeDb", (), {"positions": positions})())

    created = asyncio.run(
        server.create_position(
            server.PositionCreate(code_position=" job-dev ", position_name=" System   Developer "),
            super_admin(),
        )
    )
    assert created.code_position == "JOB-DEV"
    assert created.position_name == "System Developer"
    assert created.created_by == "Anne"
    assert created.updated_by == "Anne"

    updated = asyncio.run(
        server.update_position(
            created.id,
            server.PositionUpdate(position_name="Senior System Developer"),
            super_admin("Oky"),
        )
    )
    assert updated.code_position == "JOB-DEV"
    assert updated.position_name == "Senior System Developer"
    assert updated.created_by == "Anne"
    assert updated.updated_by == "Oky"

    assert asyncio.run(server.delete_position(created.id, super_admin())) == {"ok": True}
    assert positions.docs == []


def test_position_code_and_name_must_be_unique(monkeypatch):
    positions = FakePositions()
    positions.docs.append({"id": "existing", "code_position": "JOB001", "position_name": "SYSTEM ANALYST"})
    monkeypatch.setattr(server, "db", type("FakeDb", (), {"positions": positions})())

    with pytest.raises(HTTPException) as code_error:
        asyncio.run(server.create_position(server.PositionCreate(code_position="job001", position_name="Developer"), super_admin()))
    assert code_error.value.status_code == 409

    with pytest.raises(HTTPException) as name_error:
        asyncio.run(server.create_position(server.PositionCreate(code_position="JOB999", position_name="system analyst"), super_admin()))
    assert name_error.value.status_code == 409


def test_position_options_are_public_and_resolver_supports_other(monkeypatch):
    positions = FakePositions()
    positions.docs.extend(
        [
            {"code_position": "JOB014", "position_name": "IT NETWORK STAFF"},
            {"code_position": "JOB002", "position_name": "MAINTENANCE SUPERVISOR"},
        ]
    )
    monkeypatch.setattr(server, "db", type("FakeDb", (), {"positions": positions})())

    options = asyncio.run(server.list_position_options())
    assert [item.position_name for item in options] == ["IT NETWORK STAFF", "MAINTENANCE SUPERVISOR"]
    assert asyncio.run(server._resolve_position("maintenance supervisor", False)) == (
        "MAINTENANCE SUPERVISOR",
        "JOB002",
    )
    assert asyncio.run(server._resolve_position("Product Owner", True)) == ("Product Owner", "")
    with pytest.raises(HTTPException) as error:
        asyncio.run(server._resolve_position("Product Owner", False))
    assert error.value.status_code == 400


def test_position_seed_imports_unique_workbook_rows_only_when_empty(monkeypatch):
    positions = FakePositions()
    monkeypatch.setattr(server, "db", type("FakeDb", (), {"positions": positions})())

    asyncio.run(server.seed_positions())
    assert len(positions.docs) == 423
    assert positions.docs[0]["code_position"] == "JOB001"
    assert positions.docs[0]["position_name"] == "MECHANICAL TECHNICIAN"
    assert positions.docs[-1]["code_position"] == "JOB423"
    assert positions.docs[-1]["position_name"] == "TAX MANAGER"
    assert all(item["created_by"] == "System Import" for item in positions.docs)
    assert len({item["position_name"] for item in positions.docs}) == 423

    asyncio.run(server.seed_positions())
    assert len(positions.docs) == 423
