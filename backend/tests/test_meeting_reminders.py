import asyncio
from copy import deepcopy
from datetime import datetime
import unittest
from unittest.mock import AsyncMock, patch

import server


class UpdateResult:
    def __init__(self, modified_count):
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
        for field, expected in query.items():
            if field != "id" and self.booking.get(field) != expected:
                return UpdateResult(0)
        self.booking.update(update["$set"])
        return UpdateResult(1)


def booking(**updates):
    value = {
        "id": "booking-1",
        "booking_number": "MR2610260001",
        "room_id": "room-1",
        "room_name": "Ruang Komodo",
        "room_building": "HO NTI Jakarta",
        "user_id": "user-1",
        "user_name": "Anita Wijaya",
        "user_email": "anita@example.com",
        "title": "Monthly Review",
        "date": "2026-10-26",
        "start_time": "10:00",
        "end_time": "11:00",
        "participants": 8,
        "guest_counts": {"Internal": 8},
        "food_beverages": "Snack",
        "notes": "",
        "status": "confirmed",
        "created_at": "2026-10-20T08:00:00+00:00",
    }
    value.update(updates)
    return value


class MeetingReminderTests(unittest.TestCase):
    def test_matrix_uses_expected_four_notification_windows(self):
        self.assertEqual(
            server._meeting_notification_events(booking(), datetime(2026, 10, 26, 8, 0)),
            ["booking_confirmation"],
        )
        self.assertEqual(
            server._meeting_notification_events(booking(), datetime(2026, 10, 26, 9, 50)),
            ["check_in_reminder"],
        )
        self.assertEqual(
            server._meeting_notification_events(
                booking(status="in_progress", checked_in_at="2026-10-26T03:00:00+00:00"),
                datetime(2026, 10, 26, 10, 50),
            ),
            ["check_out_reminder"],
        )
        self.assertEqual(
            server._meeting_notification_events(
                booking(status="completed", checked_out_at="2026-10-26T04:01:00+00:00"),
                datetime(2026, 10, 26, 11, 1),
            ),
            ["completed"],
        )

    def test_sent_flags_and_check_in_state_prevent_duplicate_or_invalid_reminders(self):
        self.assertEqual(
            server._meeting_notification_events(
                booking(booking_confirmation_email_sent_at="2026-10-26T01:00:00+00:00"),
                datetime(2026, 10, 26, 8, 30),
            ),
            [],
        )
        self.assertEqual(
            server._meeting_notification_events(
                booking(status="in_progress", checked_in_at="2026-10-26T02:55:00+00:00"),
                datetime(2026, 10, 26, 9, 55),
            ),
            [],
        )
        self.assertEqual(
            server._meeting_notification_events(booking(), datetime(2026, 10, 26, 10, 50)),
            [],
        )

    def test_delivery_claim_allows_only_one_send(self):
        fake_bookings = FakeBookings(booking())
        with (
            patch.object(server.db, "bookings", fake_bookings),
            patch.object(server, "_send_meeting_lifecycle_email", return_value=True) as send,
        ):
            first = asyncio.run(server._deliver_meeting_notification(booking(), "booking_confirmation"))
            second = asyncio.run(server._deliver_meeting_notification(booking(), "booking_confirmation"))

        self.assertTrue(first)
        self.assertFalse(second)
        self.assertEqual(send.call_count, 1)
        self.assertFalse(fake_bookings.booking["booking_confirmation_email_sent_at"].startswith("sending:"))

    def test_delivery_failure_releases_claim_for_retry(self):
        fake_bookings = FakeBookings(booking())
        with (
            patch.object(server.db, "bookings", fake_bookings),
            patch.object(server, "_send_meeting_lifecycle_email", side_effect=RuntimeError("network error")),
        ):
            sent = asyncio.run(server._deliver_meeting_notification(booking(), "check_in_reminder"))

        self.assertFalse(sent)
        self.assertIsNone(fake_bookings.booking["check_in_reminder_email_sent_at"])

    def test_all_templates_are_sent_through_resend(self):
        captured = []

        def capture(to, subject, text, html):
            captured.append((to, subject, text, html))
            return True

        with (
            patch.object(server, "RESEND_API_KEY", "test-key"),
            patch.object(server, "_send_resend_email", side_effect=capture),
        ):
            for notification_type in server.MEETING_NOTIFICATION_CONFIG:
                self.assertTrue(server._send_meeting_lifecycle_email(booking(), notification_type))

        self.assertEqual(len(captured), 4)
        subjects = "\n".join(item[1] for item in captured)
        self.assertIn("2 Jam Lagi", subjects)
        self.assertIn("10 Menit Lagi", subjects)
        self.assertIn("Tersisa 10 Menit", subjects)
        self.assertIn("Telah Selesai", subjects)
        self.assertTrue(all(item[0] == "anita@example.com" for item in captured))

    def test_check_out_marks_completed_and_sends_completion_confirmation(self):
        fake_bookings = FakeBookings(
            booking(status="in_progress", checked_in_at="2026-10-26T03:00:00+00:00")
        )
        deliver = AsyncMock(return_value=True)
        with (
            patch.object(server.db, "bookings", fake_bookings),
            patch.object(server, "_app_now_naive", return_value=datetime(2026, 10, 26, 10, 30)),
            patch.object(server, "_deliver_meeting_notification", deliver),
        ):
            result = asyncio.run(
                server.check_out_booking(
                    "booking-1",
                    {"id": "user-1", "email": "anita@example.com", "role": "user"},
                )
            )

        self.assertEqual(result.status, "completed")
        self.assertIsNotNone(result.checked_out_at)
        deliver.assert_awaited_once()
        self.assertEqual(deliver.await_args.args[1], "completed")

    def test_check_in_changes_confirmed_booking_to_in_progress(self):
        fake_bookings = FakeBookings(booking())
        with (
            patch.object(server.db, "bookings", fake_bookings),
            patch.object(server, "_app_now_naive", return_value=datetime(2026, 10, 26, 10, 0)),
        ):
            result = asyncio.run(
                server.check_in_booking(
                    "booking-1",
                    {"id": "user-1", "email": "anita@example.com", "role": "user"},
                )
            )

        self.assertEqual(result.status, "in_progress")
        self.assertIsNotNone(result.checked_in_at)
        self.assertEqual(fake_bookings.booking["status"], "in_progress")

    def test_auto_check_out_runs_five_minutes_after_end_and_sends_completion(self):
        active = booking(status="in_progress", checked_in_at="2026-10-26T03:00:00+00:00")
        fake_bookings = FakeBookings(active)
        deliver = AsyncMock(return_value=True)
        with (
            patch.object(server.db, "bookings", fake_bookings),
            patch.object(server, "_deliver_meeting_notification", deliver),
        ):
            before = asyncio.run(
                server._auto_check_out_booking(active, datetime(2026, 10, 26, 11, 4, 59))
            )
            completed = asyncio.run(
                server._auto_check_out_booking(active, datetime(2026, 10, 26, 11, 5))
            )

        self.assertFalse(before)
        self.assertTrue(completed)
        self.assertEqual(fake_bookings.booking["status"], "completed")
        self.assertIsNotNone(fake_bookings.booking["checked_out_at"])
        self.assertEqual(
            fake_bookings.booking["auto_checked_out_at"],
            fake_bookings.booking["checked_out_at"],
        )
        deliver.assert_awaited_once()
        self.assertEqual(deliver.await_args.args[1], "completed")


if __name__ == "__main__":
    unittest.main()
