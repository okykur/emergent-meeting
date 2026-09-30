#!/usr/bin/env python3
import asyncio
import os

from postgres_compat import PostgresDatabase, ReturnDocument


async def main():
    database = PostgresDatabase(os.environ["POSTGRES_DSN"])
    counters = database.counters
    key = "__postgres_compat_smoke__"
    await counters.delete_one({"_id": key})
    try:
        await counters.insert_one({"_id": key, "seq": 1})
        assert await counters.count_documents({"_id": key}) == 1
        assert (await counters.find_one({"_id": key}))["seq"] == 1
        result = await counters.update_one({"_id": key}, {"$inc": {"seq": 2}})
        assert result.modified_count == 1
        updated = await counters.find_one_and_update(
            {"_id": key}, {"$max": {"seq": 5}}, return_document=ReturnDocument.AFTER
        )
        assert updated["seq"] == 5
        rooms = await database.rooms.find({}, {"_id": 0, "id": 1}).sort("name", 1).to_list(100)
        assert rooms
        assert all(set(room) == {"id"} for room in rooms)
    finally:
        deleted = await counters.delete_one({"_id": key})
        assert deleted.deleted_count in (0, 1)
    print("PostgreSQL compatibility smoke test passed")


if __name__ == "__main__":
    asyncio.run(main())
