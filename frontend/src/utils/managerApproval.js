function minutesBetween(startTime, endTime) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

function hasValidFnbRule(booking) {
  const food = (booking.food_beverages || "").trim().toLowerCase();
  if (!food) return false;
  const duration = minutesBetween(booking.start_time, booking.end_time);
  if (duration < 4 * 60) return false;
  if (food.includes("makan") && duration < 5 * 60) return false;
  return true;
}

function needsManagerGaApproval(booking) {
  return booking.status === "pending"
    && booking.meeting_admin_approval_status === "approved"
    && booking.approval_require_manager_ga === true
    && booking.manager_ga_approval_status === "pending"
    && (!booking.approval_require_manager_user || booking.manager_user_approval_status === "approved")
    && hasValidFnbRule(booking);
}

export function isActiveManagerApproval(booking) {
  return needsManagerGaApproval(booking);
}
