import asyncio

import pytest
from fastapi import HTTPException

import server


class Result:
    def __init__(self, deleted_count=0):
        self.deleted_count = deleted_count


class FakeCompanies:
    def __init__(self):
        self.docs = []

    async def find_one(self, query, _projection=None):
        for doc in self.docs:
            if "id" in query and isinstance(query["id"], dict):
                if doc.get("id") == query["id"].get("$ne"):
                    continue
            elif "id" in query and doc.get("id") != query["id"]:
                continue
            if "company_code" in query and doc.get("company_code") != query["company_code"]:
                continue
            return {key: value for key, value in doc.items() if key != "_id"}
        return None

    async def insert_one(self, doc):
        self.docs.append(dict(doc))

    async def update_one(self, query, update):
        for doc in self.docs:
            if doc.get("id") == query.get("id"):
                doc.update(update["$set"])
                break

    async def delete_one(self, query):
        before = len(self.docs)
        self.docs = [doc for doc in self.docs if doc.get("id") != query.get("id")]
        return Result(deleted_count=before - len(self.docs))


class FakeCounters:
    async def find_one_and_update(self, *_args, **_kwargs):
        return {"seq": 12}


def super_admin():
    return {"id": "admin-1", "name": "Anne", "email": "anne@example.com", "role": "super_admin"}


def test_company_crud_generates_system_number_and_audit(monkeypatch):
    companies = FakeCompanies()
    monkeypatch.setattr(server, "db", type("FakeDb", (), {"companies": companies, "counters": FakeCounters()})())

    created = asyncio.run(
        server.create_company(
            server.CompanyCreate(company_code=" ati ", company_name=" PT  Aroma Tobacco International "),
            super_admin(),
        )
    )
    assert created.system_number == "CMP-000012"
    assert created.company_code == "ATI"
    assert created.company_name == "PT Aroma Tobacco International"
    assert created.created_by == "Anne"
    assert created.created_by_id == "admin-1"
    assert created.updated_by == "Anne"

    updated = asyncio.run(
        server.update_company(
            created.id,
            server.CompanyUpdate(company_name="PT Aroma Tobacco International Indonesia"),
            {**super_admin(), "name": "Oky"},
        )
    )
    assert updated.system_number == created.system_number
    assert updated.company_name.endswith("Indonesia")
    assert updated.created_by == "Anne"
    assert updated.updated_by == "Oky"
    assert updated.updated_by_id == "admin-1"
    assert updated.datetime_updated

    response = asyncio.run(server.delete_company(created.id, super_admin()))
    assert response == {"ok": True}
    assert companies.docs == []


def test_company_code_must_be_unique(monkeypatch):
    companies = FakeCompanies()
    companies.docs.append({"id": "existing", "company_code": "ATI"})
    monkeypatch.setattr(server, "db", type("FakeDb", (), {"companies": companies, "counters": FakeCounters()})())

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.create_company(server.CompanyCreate(company_code="ati", company_name="Duplicate"), super_admin()))
    assert error.value.status_code == 409


def test_company_master_rejects_non_super_admin():
    with pytest.raises(HTTPException) as error:
        asyncio.run(server.require_super_admin({"role": "meeting_admin"}))
    assert error.value.status_code == 403
