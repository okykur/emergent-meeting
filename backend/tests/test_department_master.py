import asyncio
import re

import pytest
from fastapi import HTTPException

import server


class Result:
    def __init__(self, deleted_count=0):
        self.deleted_count = deleted_count


class FakeDepartments:
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


def test_department_crud_normalizes_values_and_tracks_audit(monkeypatch):
    departments = FakeDepartments()
    monkeypatch.setattr(server, "db", type("FakeDb", (), {"departments": departments})())

    created = asyncio.run(
        server.create_department(
            server.DepartmentCreate(code_dept=" it-dev ", dept_name=" Information   Technology "),
            super_admin(),
        )
    )
    assert created.code_dept == "IT-DEV"
    assert created.dept_name == "Information Technology"
    assert created.created_by == "Anne"
    assert created.updated_by == "Anne"
    assert created.created_date == created.updated_date

    updated = asyncio.run(
        server.update_department(
            created.id,
            server.DepartmentUpdate(dept_name="Digital Technology"),
            super_admin("Oky"),
        )
    )
    assert updated.code_dept == "IT-DEV"
    assert updated.dept_name == "Digital Technology"
    assert updated.created_by == "Anne"
    assert updated.updated_by == "Oky"
    assert updated.updated_date

    response = asyncio.run(server.delete_department(created.id, super_admin()))
    assert response == {"ok": True}
    assert departments.docs == []


def test_department_code_and_name_must_be_unique(monkeypatch):
    departments = FakeDepartments()
    departments.docs.append({"id": "existing", "code_dept": "IT", "dept_name": "Information Technology"})
    monkeypatch.setattr(server, "db", type("FakeDb", (), {"departments": departments})())

    with pytest.raises(HTTPException) as code_error:
        asyncio.run(server.create_department(server.DepartmentCreate(code_dept="it", dept_name="Digital"), super_admin()))
    assert code_error.value.status_code == 409

    with pytest.raises(HTTPException) as name_error:
        asyncio.run(server.create_department(server.DepartmentCreate(code_dept="DIG", dept_name="information technology"), super_admin()))
    assert name_error.value.status_code == 409


def test_department_master_requires_super_admin():
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.require_super_admin({"role": "meeting_admin"}))
    assert error.value.status_code == 403


def test_department_options_are_public_and_sorted(monkeypatch):
    departments = FakeDepartments()
    departments.docs.extend(
        [
            {"code_dept": "DEPT060", "dept_name": "OPERATIONAL"},
            {"code_dept": "DEPT001", "dept_name": "CORPORATE STRATEGY"},
        ]
    )
    monkeypatch.setattr(server, "db", type("FakeDb", (), {"departments": departments})())

    options = asyncio.run(server.list_department_options())

    assert [item.dept_name for item in options] == ["CORPORATE STRATEGY", "OPERATIONAL"]
    assert options[0].code_dept == "DEPT001"


def test_department_resolver_requires_master_unless_other_is_selected(monkeypatch):
    departments = FakeDepartments()
    departments.docs.append({"code_dept": "DEPT060", "dept_name": "OPERATIONAL"})
    monkeypatch.setattr(server, "db", type("FakeDb", (), {"departments": departments})())

    assert asyncio.run(server._resolve_department("operational", False)) == ("OPERATIONAL", "DEPT060")
    assert asyncio.run(server._resolve_department("Innovation Office", True)) == ("Innovation Office", "")
    with pytest.raises(HTTPException) as error:
        asyncio.run(server._resolve_department("Innovation Office", False))
    assert error.value.status_code == 400


def test_department_seed_imports_workbook_rows_only_when_empty(monkeypatch):
    departments = FakeDepartments()
    monkeypatch.setattr(server, "db", type("FakeDb", (), {"departments": departments})())

    asyncio.run(server.seed_departments())
    assert len(departments.docs) == 101
    assert departments.docs[0]["code_dept"] == "DEPT001"
    assert departments.docs[0]["dept_name"] == "CORPORATE STRATEGY"
    assert departments.docs[-1]["code_dept"] == "DEPT101"
    assert departments.docs[-1]["dept_name"] == "SECONDARY SUPPLY CHAIN"
    assert all(item["created_by"] == "System Import" for item in departments.docs)
    assert len({item["dept_name"] for item in departments.docs}) == 101

    asyncio.run(server.seed_departments())
    assert len(departments.docs) == 101
