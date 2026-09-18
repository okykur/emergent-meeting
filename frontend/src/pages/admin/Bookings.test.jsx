import { canReassignMeetingBooking, canReviewMeetingBooking } from "./Bookings";

describe("meeting admin action rules", () => {
  test("shows Review for a pending booking that has not been reviewed", () => {
    expect(canReviewMeetingBooking({ status: "pending", meeting_admin_approval_status: "pending" })).toBe(true);
    expect(canReviewMeetingBooking({ status: "pending", meeting_admin_approval_status: "approved" })).toBe(false);
    expect(canReviewMeetingBooking({ status: "cancelled", meeting_admin_approval_status: "pending" })).toBe(false);
  });

  test("shows Reassign before the meeting begins when not checked in", () => {
    const now = new Date("2026-09-20T08:00:00");
    const booking = { date: "2026-09-21", start_time: "08:00", checked_in_at: null };

    expect(canReassignMeetingBooking(booking, now)).toBe(true);
    expect(canReassignMeetingBooking({ ...booking, checked_in_at: "2026-09-21T07:55:00" }, now)).toBe(false);
    expect(canReassignMeetingBooking({ ...booking, date: "2026-09-19" }, now)).toBe(false);
  });
});
