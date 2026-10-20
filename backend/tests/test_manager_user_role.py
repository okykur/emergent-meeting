import asyncio
from copy import deepcopy
import unittest
from unittest.mock import patch

import server


class UpdateResult:
    def __init__(self, modified_count=1):
        self.modified_count = modified_count


class FakeBookings:
    def __init__(self, booking):
        self.booking = deepcopy(booking)

    async def find_one(self, query, _projection=None):
        if query.get("id") != self.booking["id"]:
            return None
        return deepcopy(self.booking)

    async def update_one(self, query, update):
        if query.get("id") != self.booking["id"]:
            return UpdateResult(0)
        if query.get("manager_user_approval_status") != self.booking["manager_user_approval_status"]:
            return UpdateResult(0)
        self.booking.update(update["$set"])
        return UpdateResult()


class FakeApprovals:
    def __init__(self):
        self.calls = []

    async def update_many(self, query, update):
        self.calls.append((query, update))
        return UpdateResult()


def pending_booking():
    return {
        "id": "booking-1",
        "booking_number": "MR2610200001",
        "room_id": "room-1",
        "room_name": "Ruang Komodo",
        "room_building": "HO NTI Jakarta",
        "user_id": "user-1",
        "user_name": "Anita Wijaya",
        "user_email": "anita@example.com",
        "title": "Quarterly Review",
        "date": "2026-10-21",
        "start_time": "09:00",
        "end_time": "13:00",
        "participants": 10,
        "food_beverages": "Snack",
        "notes": "",
        "status": "pending",
        "created_at": "2026-10-20T08:00:00+00:00",
        "supervisor_name": "Budi Manager",
        "supervisor_email": "budi@example.com",
        "supervisor_approval_status": "pending",
        "meeting_admin_approval_status": "approved",
        "approval_require_manager_user": True,
        "approval_require_manager_ga": False,
        "manager_user_approval_status": "pending",
        "manager_ga_approval_status": "not_required",
        "fnb_status": "pending",
    }


class ManagerUserRoleTests(unittest.TestCase):
    def test_manager_user_role_is_accepted_and_does_not_get_ga_privileges(self):
        public = server.UserPublic(
            id="manager-user-1",
            email="budi@example.com",
            name="Budi Manager",
            role="manager_user",
            created_at="2026-10-20T08:00:00+00:00",
        )

        self.assertEqual(public.role, "manager_user")
        self.assertNotIn("manager_user", server.FNB_MANAGER_ROLES)
        self.assertNotIn("manager_user", server.ADMIN_ROLES)

    def test_manager_user_can_approve_only_booking_assigned_to_its_email(self):
        bookings = FakeBookings(pending_booking())
        approvals = FakeApprovals()
        with (
            patch.object(server.db, "bookings", bookings),
            patch.object(server.db, "supervisor_meeting_approvals", approvals),
            patch.object(server, "_send_booking_approval_email", return_value=True),
        ):
            result = asyncio.run(
                server.update_manager_user_status(
                    "booking-1",
                    server.FnbStatusUpdate(status="approved"),
                    {"id": "manager-user-1", "email": "budi@example.com", "role": "manager_user"},
                )
            )

            self.assertEqual(result.status, "confirmed")
            self.assertEqual(result.manager_user_approval_status, "approved")
            self.assertEqual(result.manager_user_reviewed_by, "budi@example.com")
            self.assertEqual(approvals.calls[0][0], {"booking_id": "booking-1", "used_at": None})

            with self.assertRaises(server.HTTPException) as context:
                asyncio.run(
                    server.update_manager_user_status(
                        "booking-1",
                        server.FnbStatusUpdate(status="approved"),
                        {"id": "other-manager", "email": "other@example.com", "role": "manager_user"},
                    )
                )
            self.assertEqual(context.exception.status_code, 403)

    def test_non_manager_user_is_rejected_by_role_guard(self):
        with self.assertRaises(server.HTTPException) as context:
            asyncio.run(
                server.require_manager_user(
                    {"id": "ga-manager", "email": "ga@example.com", "role": "manager"}
                )
            )
        self.assertEqual(context.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
